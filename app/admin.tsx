import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BarChart3, Boxes, ClipboardList, ShieldAlert, Store, Users } from 'lucide-react-native';
import { useApp } from '@/lib/store/AppContext';
import {
  Badge,
  Card,
  Chip,
  Divider,
  EmptyState,
  InfoBanner,
  ScreenHeader,
  Txt,
} from '@/components/ui';
import { categoryLabels, colors, spacing } from '@/lib/theme';
import { formatINR, relativeTime } from '@/lib/format';
import { buildGroceryList } from '@/lib/engine/grocery';
import { ingredients } from '@/lib/data/ingredients';
import { products, retailers } from '@/lib/data/products';
import { getRetailerCapabilityView } from '@/lib/retailers/adapters';
import { IngredientCategory } from '@/lib/types';

type Tab = 'overview' | 'recipes' | 'ingredients' | 'retailers' | 'audit';

const TABS: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'recipes', label: 'Recipes', icon: ClipboardList },
  { id: 'ingredients', label: 'Ingredients', icon: Boxes },
  { id: 'retailers', label: 'Retailers', icon: Store },
  { id: 'audit', label: 'Audit', icon: Users },
];

export default function AdminScreen() {
  const router = useRouter();
  const { state, allRecipes, activePlan, toggleRecipeVerification } = useApp();
  const [tab, setTab] = useState<Tab>('overview');

  const analytics = useMemo(() => {
    const meals = state.plans.reduce(
      (total, plan) => total + plan.days.reduce((sum, day) => sum + Object.values(day.meals).reduce((count, list) => count + list.length, 0), 0),
      0,
    );
    const uniqueRecipes = new Set(state.plans.flatMap((plan) => plan.days.flatMap((day) => Object.values(day.meals).flat().map((meal) => meal.recipeId))));
    const grocery =
      activePlan && state.preferences
        ? buildGroceryList({
            plan: activePlan,
            recipes: allRecipes,
            pantry: state.pantry,
            autoDeduct: state.autoDeductPantry,
            extras: state.extras,
            checked: state.checkedItems,
          })
        : null;
    return {
      plans: state.plans.length,
      meals,
      uniqueRecipes: uniqueRecipes.size,
      favorites: state.favorites.length,
      orders: state.orders.length,
      audit: state.auditLogs.length,
      basket: grocery?.totals.estimated ?? 0,
      lines: grocery?.totals.lineCount ?? 0,
      custom: state.customRecipes.length,
      verified: allRecipes.filter((recipe) => recipe.verified || state.verifiedRecipeIds.includes(recipe.id)).length,
    };
  }, [state, allRecipes, activePlan]);

  const byCategory = useMemo(() => {
    const map = new Map<IngredientCategory, number>();
    for (const ingredient of ingredients) {
      map.set(ingredient.category, (map.get(ingredient.category) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, []);

  if (!state.user?.isAdmin) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
        <ScreenHeader title="Admin" onBack={() => router.back()} />
        <EmptyState
          icon={<ShieldAlert size={24} color={colors.red} />}
          title="Admins only"
          message="This demo console is limited to admin accounts. Sign in with the demo kitchen to explore it."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
      <ScreenHeader title="Admin console" subtitle="Demo data · this device only" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <InfoBanner
          tone="neutral"
          message="This is a local demo console over the same on-device data. In production these views would be role-protected server routes with an immutable audit trail."
        />

        <View style={styles.tabs}>
          {TABS.map((item) => (
            <Chip key={item.id} label={item.label} selected={tab === item.id} onPress={() => setTab(item.id)} />
          ))}
        </View>

        {tab === 'overview' ? (
          <>
            <View style={styles.grid}>
              <Metric label="Meal plans" value={`${analytics.plans}`} />
              <Metric label="Meals planned" value={`${analytics.meals}`} />
              <Metric label="Recipes in use" value={`${analytics.uniqueRecipes}`} />
              <Metric label="Verified recipes" value={`${analytics.verified}/${allRecipes.length}`} />
              <Metric label="Basket estimate" value={formatINR(analytics.basket)} />
              <Metric label="Grocery lines" value={`${analytics.lines}`} />
              <Metric label="Favourites" value={`${analytics.favorites}`} />
              <Metric label="Retailer hand-offs" value={`${analytics.orders}`} />
              <Metric label="Custom recipes" value={`${analytics.custom}`} />
            </View>
            <Card style={{ marginTop: spacing.lg }}>
              <Txt variant="h3">Recent activity</Txt>
              <Txt variant="tiny" color={colors.inkSoft} style={{ marginBottom: spacing.sm }}>
                {analytics.audit} audit entries retained (latest 120)
              </Txt>
              {state.auditLogs.slice(0, 6).map((entry) => (
                <View key={entry.id} style={styles.auditRow}>
                  <View style={{ flex: 1 }}>
                    <Txt variant="small" style={{ fontWeight: '600' }}>
                      {entry.action.replace(/_/g, ' ')}
                    </Txt>
                    <Txt variant="tiny" color={colors.inkSoft}>
                      {entry.detail}
                    </Txt>
                  </View>
                  <Txt variant="tiny" color={colors.inkFaint}>
                    {relativeTime(entry.at)}
                  </Txt>
                </View>
              ))}
              {state.auditLogs.length === 0 ? (
                <Txt variant="tiny" color={colors.inkFaint}>
                  No activity recorded yet.
                </Txt>
              ) : null}
            </Card>
          </>
        ) : null}

        {tab === 'recipes' ? (
          <>
            <Txt variant="h3" style={{ marginBottom: spacing.sm }}>
              Recipe verification
            </Txt>
            <Txt variant="tiny" color={colors.inkSoft} style={{ marginBottom: spacing.md }}>
              Mark recipes as reviewed for allergens, nutrition and method. Verification is demo state stored locally.
            </Txt>
            {allRecipes.map((recipe) => {
              const verified = Boolean(recipe.verified) || state.verifiedRecipeIds.includes(recipe.id);
              return (
                <Card key={recipe.id} style={{ marginBottom: spacing.sm }} padded={false}>
                  <Pressable
                    onPress={() => toggleRecipeVerification(recipe.id)}
                    style={({ pressed }) => [styles.recipeRow, pressed && { opacity: 0.75 }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Txt variant="bodyStrong">{recipe.name}</Txt>
                      <Txt variant="tiny" color={colors.inkSoft}>
                        {recipe.cuisine} · {recipe.ingredients.length} ingredients · {recipe.steps.length} steps
                        {recipe.curated ? ' · curated' : ' · custom'}
                      </Txt>
                    </View>
                    <Badge label={verified ? 'Verified' : 'Unverified'} tone={verified ? 'mint' : 'neutral'} />
                  </Pressable>
                </Card>
              );
            })}
          </>
        ) : null}

        {tab === 'ingredients' ? (
          <>
            <Txt variant="h3">Ingredient master</Txt>
            <Txt variant="tiny" color={colors.inkSoft} style={{ marginBottom: spacing.md }}>
              {ingredients.length} canonical ingredients. Prices are demo values per base unit and must be replaced by a live
              catalogue before production.
            </Txt>
            <Card style={{ marginBottom: spacing.md }}>
              {byCategory.map(([category, count], index) => (
                <View key={category}>
                  {index > 0 ? <Divider /> : null}
                  <View style={styles.row}>
                    <Txt variant="small">{categoryLabels[category] ?? category}</Txt>
                    <Txt variant="small" style={{ fontWeight: '700' }}>
                      {count}
                    </Txt>
                  </View>
                </View>
              ))}
            </Card>
            {ingredients.slice(0, 40).map((ingredient) => (
              <View key={ingredient.id} style={styles.ingredientRow}>
                <View style={{ flex: 1 }}>
                  <Txt variant="small" style={{ fontWeight: '600' }}>
                    {ingredient.name}
                  </Txt>
                  <Txt variant="tiny" color={colors.inkFaint}>
                    {ingredient.dimension} · {formatINR(ingredient.pricePerBase)}/{ingredient.dimension === 'piece' ? 'pc' : ingredient.dimension === 'volume' ? 'ml' : 'g'}
                    {ingredient.staple ? ' · staple' : ''}
                  </Txt>
                </View>
                {ingredient.allergens.length > 0 ? (
                  <Badge label={ingredient.allergens.join(', ')} tone="orange" />
                ) : null}
              </View>
            ))}
            <Txt variant="tiny" color={colors.inkFaint} style={{ marginTop: spacing.sm }}>
              Showing first 40 of {ingredients.length}.
            </Txt>
          </>
        ) : null}

        {tab === 'retailers' ? (
          <>
            <Txt variant="h3" style={{ marginBottom: spacing.md }}>
              Retailer integrations
            </Txt>
            {retailers.map((retailer) => {
              const view = getRetailerCapabilityView(retailer.id);
              const catalogue = products.filter((product) => product.retailerId === retailer.id).length;
              return (
                <Card key={retailer.id} style={{ marginBottom: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <View style={[styles.dot, { backgroundColor: view.accent }]} />
                    <Txt variant="bodyStrong" style={{ flex: 1 }}>
                      {view.name}
                    </Txt>
                    <Badge
                      label={view.modeLabel}
                      tone={view.status === 'sandbox' ? 'mint' : 'neutral'}
                    />
                  </View>
                  <Txt variant="tiny" color={colors.inkSoft} style={{ marginTop: 4 }}>
                    {view.description}
                  </Txt>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' }}>
                    <Badge label={`Mode ${view.mode}`} tone="blue" />
                    <Badge label={`${catalogue} demo SKUs`} tone="neutral" />
                    <Badge label={view.deepLink ? 'Deep link ready' : 'No deep link'} tone="neutral" />
                    <Badge label={view.sandboxCart ? 'Sandbox cart' : 'No cart API'} tone={view.sandboxCart ? 'mint' : 'neutral'} />
                    <Badge label="Live price: no" tone="orange" />
                    <Badge label="Live stock: no" tone="orange" />
                  </View>
                </Card>
              );
            })}
            <InfoBanner
              tone="orange"
              message="No live retailer API is connected in this build. Mode A is a local sandbox; Mode B is an approved deep-link hand-off. Never represent either as a completed real order."
            />
          </>
        ) : null}

        {tab === 'audit' ? (
          <>
            <Txt variant="h3" style={{ marginBottom: spacing.md }}>
              Audit log
            </Txt>
            <Card padded={false}>
              {state.auditLogs.map((entry, index) => (
                <View key={entry.id}>
                  {index > 0 ? <Divider style={{ marginHorizontal: spacing.lg }} /> : null}
                  <View style={styles.auditRow}>
                    <View style={{ flex: 1 }}>
                      <Txt variant="small" style={{ fontWeight: '600' }}>
                        {entry.action.replace(/_/g, ' ')}
                      </Txt>
                      <Txt variant="tiny" color={colors.inkSoft}>
                        {entry.detail}
                      </Txt>
                      <Txt variant="tiny" color={colors.inkFaint}>
                        {entry.actor}
                      </Txt>
                    </View>
                    <Txt variant="tiny" color={colors.inkFaint}>
                      {relativeTime(entry.at)}
                    </Txt>
                  </View>
                </View>
              ))}
              {state.auditLogs.length === 0 ? (
                <View style={{ padding: spacing.lg }}>
                  <Txt variant="tiny" color={colors.inkFaint}>
                    No audit entries yet.
                  </Txt>
                </View>
              ) : null}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Txt variant="h2">{value}</Txt>
      <Txt variant="tiny" color={colors.inkSoft}>
        {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: {
    width: '31.5%',
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    padding: spacing.md,
    minHeight: 76,
    justifyContent: 'center',
  },
  auditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
