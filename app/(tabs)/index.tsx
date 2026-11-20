import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowRight,
  Bell,
  CalendarDays,
  ChefHat,
  ChevronRight,
  Clock,
  Flame,
  Leaf,
  Package,
  Play,
  Plus,
  ShoppingBasket,
  Sparkles,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react-native';
import { defaultPreferences, useApp } from '@/lib/store/AppContext';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  FoodImage,
  ProgressBar,
  SectionHeader,
  Sheet,
  Txt,
  ToggleRow,
} from '@/components/ui';
import { DietMark } from '@/components/RecipeCard';
import { colors, mealSlotLabels, radius, shadow, spacing } from '@/lib/theme';
import {
  currentSeason,
  formatDay,
  formatINR,
  greeting,
  relativeTime,
  seasonLabel,
  todayISO,
} from '@/lib/format';
import { planBudgetStatus, planCost } from '@/lib/engine/planner';
import { recommendRecipes } from '@/lib/engine/recommendation';
import { MealSlot, Recipe } from '@/lib/types';

export default function HomeScreen() {
  const {
    state,
    activePlan,
    allRecipes,
    updateNotifications,
  } = useApp();
  const router = useRouter();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const prefs = state.preferences ?? defaultPreferences;
  const household = state.household ?? { adults: 2, children: 0, defaultServings: 2, members: [] };
  const today = todayISO();
  const firstName = (state.user?.name ?? 'there').split(' ')[0];
  const todayPlan = activePlan?.days.find((day) => day.date === today);
  const continueCooking = state.cooking
    ? allRecipes.find((recipe) => recipe.id === state.cooking?.recipeId)
    : null;

  const pantryIds = state.pantry.map((item) => item.ingredientId);

  const recommended = useMemo(
    () =>
      recommendRecipes(
        {
          prefs,
          recipes: allRecipes,
          recentRecipeIds: state.recentRecipeIds,
          pantryIngredientIds: pantryIds,
        },
        {},
        8,
      ),
    [prefs, allRecipes, state.recentRecipeIds, pantryIds],
  );

  const seasonal = useMemo(() => {
    const season = currentSeason();
    return recommendRecipes(
      { prefs, recipes: allRecipes, recentRecipeIds: state.recentRecipeIds, pantryIngredientIds: pantryIds },
      { maxTime: 60 },
      30,
    )
      .filter((entry) => entry.recipe.season === season)
      .slice(0, 5);
  }, [prefs, allRecipes, state.recentRecipeIds, pantryIds]);

  const budget = useMemo(
    () => (activePlan ? planBudgetStatus(activePlan, allRecipes, prefs) : null),
    [activePlan, allRecipes, prefs],
  );
  const cost = useMemo(
    () => (activePlan ? planCost(activePlan, allRecipes) : { total: 0, perServing: 0, servings: 0 }),
    [activePlan, allRecipes],
  );

  const favorites = state.favorites
    .map((id) => allRecipes.find((recipe) => recipe.id === id))
    .filter((recipe): recipe is Recipe => Boolean(recipe));

  const recent = state.recentRecipeIds
    .map((id) => allRecipes.find((recipe) => recipe.id === id))
    .filter((recipe): recipe is Recipe => Boolean(recipe))
    .slice(0, 5);

  const dinnerMeal = todayPlan?.meals.dinner[0] ?? todayPlan?.meals.lunch[0] ?? null;
  const dinnerRecipe = dinnerMeal ? allRecipes.find((recipe) => recipe.id === dinnerMeal.recipeId) : null;
  const slots: MealSlot[] = prefs.mealTypes.length ? prefs.mealTypes : ['breakfast', 'lunch', 'dinner'];

  const openRecipe = (id: string) => router.push({ pathname: '/recipe/[id]', params: { id } });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Txt variant="tiny" color={colors.inkFaint} style={{ fontWeight: '700' }}>
                {formatDay(today, 'long').toUpperCase()}
              </Txt>
              <Txt variant="h1" style={{ marginTop: 2 }}>
                {greeting()}, {firstName}
              </Txt>
            </View>
            <Pressable
              onPress={() => setNotificationsOpen(true)}
              style={styles.iconButton}
              accessibilityLabel="Notification settings"
            >
              <Bell size={19} color={colors.ink} />
              {state.notifications.weeklyPlan ? <View style={styles.bellDot} /> : null}
            </Pressable>
            <Pressable onPress={() => router.push('/(tabs)/profile')} accessibilityLabel="Open profile">
              <Avatar name={state.user?.name ?? 'Rasoi'} size={42} />
            </Pressable>
          </View>
          <View style={styles.chipRow}>
            <View style={styles.contextChip}>
              <ChefHat size={12} color={colors.forest} />
              <Txt variant="tiny" color={colors.forest} style={{ fontWeight: '600' }}>
                {household.defaultServings} servings
              </Txt>
            </View>
            <View style={styles.contextChip}>
              <Leaf size={12} color={colors.forest} />
              <Txt variant="tiny" color={colors.forest} style={{ fontWeight: '600' }}>
                {prefs.diet.replace(/_/g, ' ')}
              </Txt>
            </View>
            <View style={styles.contextChip}>
              <Package size={12} color={colors.forest} />
              <Txt variant="tiny" color={colors.forest} style={{ fontWeight: '600' }} numberOfLines={1}>
                {prefs.locality || prefs.city}
              </Txt>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.xl }}>
          {continueCooking && state.cooking ? (
            <Pressable
              onPress={() => router.push({ pathname: '/cook/[id]', params: { id: continueCooking.id } })}
              style={styles.continueCard}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={styles.continueIcon}>
                  <Flame size={16} color={colors.forest} />
                </View>
                <Txt variant="tiny" color={colors.mintStrong} style={{ fontWeight: '800', letterSpacing: 0.8 }}>
                  CONTINUE COOKING
                </Txt>
                <Txt variant="tiny" color={colors.mintStrong} style={{ marginLeft: 'auto' }}>
                  Step {state.cooking.stepIndex + 1} of {continueCooking.steps.length}
                </Txt>
              </View>
              <Txt variant="h3" color={colors.white} style={{ marginTop: spacing.sm }}>
                {continueCooking.name}
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <ProgressBar
                    value={(state.cooking.stepIndex + 1) / continueCooking.steps.length}
                    tone={colors.mintStrong}
                    height={6}
                  />
                </View>
                <View style={styles.resumePill}>
                  <Play size={13} color={colors.forest} fill={colors.forest} />
                  <Txt variant="tiny" color={colors.forest} style={{ fontWeight: '800' }}>
                    Resume
                  </Txt>
                </View>
              </View>
            </Pressable>
          ) : null}

          <View style={{ marginTop: continueCooking ? spacing.lg : 0 }}>
            {dinnerRecipe && dinnerMeal ? (
              <Card padded={false} style={{ overflow: 'hidden' }}>
                <FoodImage uri={dinnerRecipe.image} height={186} borderRadius={0}>
                  <View style={styles.heroTop}>
                    <View style={styles.heroBadge}>
                      <Txt variant="tiny" color={colors.forest} style={{ fontWeight: '800' }}>
                        TONIGHT
                      </Txt>
                    </View>
                    <View style={styles.heroBadge}>
                      <Clock size={12} color={colors.forest} />
                      <Txt variant="tiny" color={colors.forest} style={{ fontWeight: '700' }}>
                        {dinnerRecipe.prepMinutes + dinnerRecipe.cookMinutes} min
                      </Txt>
                    </View>
                  </View>
                </FoodImage>
                <View style={{ padding: spacing.lg }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <DietMark foodType={dinnerRecipe.foodType} />
                    <Txt variant="tiny" color={colors.orange} style={{ fontWeight: '800', textTransform: 'uppercase' }}>
                      {dinnerRecipe.cuisine}
                    </Txt>
                    <View style={styles.dot} />
                    <Txt variant="tiny" color={colors.inkFaint}>
                      Serves {dinnerMeal.servings}
                    </Txt>
                  </View>
                  <Txt variant="h2" style={{ marginTop: 4 }}>
                    {dinnerRecipe.name}
                  </Txt>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                    <Button
                      label="Start cooking"
                      size="sm"
                      onPress={() => router.push({ pathname: '/cook/[id]', params: { id: dinnerRecipe.id } })}
                      icon={<Play size={15} color={colors.white} fill={colors.white} />}
                      style={{ flex: 1 }}
                    />
                    <Button
                      label="Recipe"
                      size="sm"
                      variant="secondary"
                      onPress={() => openRecipe(dinnerRecipe.id)}
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              </Card>
            ) : (
              <Card style={{ backgroundColor: colors.forest, borderColor: colors.forest }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Sparkles size={16} color={colors.mintStrong} />
                  <Txt variant="tiny" color={colors.mintStrong} style={{ fontWeight: '800', letterSpacing: 0.8 }}>
                    YOUR WEEK IS WAITING
                  </Txt>
                </View>
                <Txt variant="h2" color={colors.white} style={{ marginTop: spacing.sm }}>
                  What’s for dinner tonight?
                </Txt>
                <Txt variant="small" color={colors.mintStrong} style={{ marginTop: 4 }}>
                  Build a week of meals from your preferences, then turn it into one grocery list.
                </Txt>
                <Button
                  label="Plan my week"
                  variant="secondary"
                  size="sm"
                  onPress={() => router.push('/(tabs)/plan')}
                  icon={<ArrowRight size={15} color={colors.forest} />}
                  style={{ marginTop: spacing.lg, alignSelf: 'flex-start' }}
                  fullWidth={false}
                />
              </Card>
            )}
          </View>

          <View style={styles.quickRow}>
            {[
              { label: 'Plan', sub: '7 days', icon: CalendarDays, href: '/(tabs)/plan' as const },
              { label: 'Recipes', sub: 'Discover', icon: UtensilsCrossed, href: '/(tabs)/recipes' as const },
              { label: 'Grocery', sub: 'Smart list', icon: ShoppingBasket, href: '/(tabs)/grocery' as const },
              { label: 'Pantry', sub: 'At home', icon: Package, href: '/pantry' as const },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <Pressable
                  key={action.label}
                  onPress={() => router.push(action.href)}
                  style={({ pressed }) => [styles.quickTile, pressed && { opacity: 0.8 }]}
                >
                  <View style={styles.quickIcon}>
                    <Icon size={18} color={colors.forest} />
                  </View>
                  <Txt variant="small" style={{ fontWeight: '700', marginTop: 6 }}>
                    {action.label}
                  </Txt>
                  <Txt variant="tiny" color={colors.inkFaint}>
                    {action.sub}
                  </Txt>
                </Pressable>
              );
            })}
          </View>

          <Card style={{ marginTop: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.budgetIcon}>
                <Wallet size={18} color={colors.forest} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Txt variant="bodyStrong">This week’s food spend</Txt>
                <Txt variant="tiny" color={colors.inkSoft}>
                  {cost.servings} planned servings · {formatINR(cost.perServing)} per serving
                </Txt>
              </View>
              <Badge label="Estimate" tone="neutral" />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing.md }}>
              <Txt variant="display" style={{ fontSize: 26 }}>
                {formatINR(budget?.total ?? 0)}
              </Txt>
              <Txt variant="small" color={colors.inkSoft} style={{ marginBottom: 3, marginLeft: 4 }}>
                of {formatINR(prefs.budget.weekly)}
              </Txt>
              <Pressable
                onPress={() => router.push('/(tabs)/grocery')}
                style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 2 }}
              >
                <Txt variant="tiny" color={colors.forest} style={{ fontWeight: '700' }}>
                  Grocery list
                </Txt>
                <ChevronRight size={14} color={colors.forest} />
              </Pressable>
            </View>
            <View style={{ marginTop: spacing.sm }}>
              <ProgressBar
                value={Math.min(1, (budget?.ratio ?? 0))}
                tone={budget?.overBudget ? colors.orange : colors.forest}
              />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Txt variant="tiny" color={budget?.overBudget ? colors.orange : colors.inkSoft}>
                {budget?.label ?? 'No plan yet'}
              </Txt>
              <Txt variant="tiny" color={colors.inkFaint}>
                Demo estimates
              </Txt>
            </View>
          </Card>

          <SectionHeader
            title="Today’s menu"
            actionLabel="Open planner"
            onAction={() => router.push('/(tabs)/plan')}
          />
          <Card padded={false}>
            {slots.map((slot, index) => {
              const meals = todayPlan?.meals[slot] ?? [];
              const recipe = meals[0] ? allRecipes.find((item) => item.id === meals[0].recipeId) : null;
              return (
                <View key={slot}>
                  {index > 0 ? <Divider /> : null}
                  <Pressable
                    onPress={() =>
                      recipe
                        ? openRecipe(recipe.id)
                        : router.push({ pathname: '/plan/add', params: { date: today, slot } })
                    }
                    style={({ pressed }) => [styles.slotRow, pressed && { opacity: 0.75 }]}
                  >
                    <View style={styles.slotLabel}>
                      <Txt variant="tiny" color={colors.inkFaint} style={{ fontWeight: '800' }}>
                        {mealSlotLabels[slot].toUpperCase()}
                      </Txt>
                    </View>
                    <View style={{ flex: 1 }}>
                      {recipe ? (
                        <>
                          <Txt variant="bodyStrong" numberOfLines={1}>
                            {recipe.name}
                          </Txt>
                          <Txt variant="tiny" color={colors.inkSoft}>
                            {recipe.prepMinutes + recipe.cookMinutes} min · serves {meals[0]?.servings}
                          </Txt>
                        </>
                      ) : (
                        <>
                          <Txt variant="bodyStrong" color={colors.inkFaint}>
                            Nothing planned
                          </Txt>
                          <Txt variant="tiny" color={colors.inkFaint}>
                            Tap to add a recipe
                          </Txt>
                        </>
                      )}
                    </View>
                    {recipe ? (
                      <ChevronRight size={16} color={colors.inkFaint} />
                    ) : (
                      <View style={styles.addSlot}>
                        <Plus size={15} color={colors.forest} />
                      </View>
                    )}
                  </Pressable>
                </View>
              );
            })}
          </Card>

          <SectionHeader
            title="Picked for you"
            subtitle="Personalised to your household and pantry"
            actionLabel="See all"
            onAction={() => router.push('/(tabs)/recipes')}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
            {recommended.slice(0, 6).map(({ recipe, reasons }) => (
              <MiniRecipe
                key={recipe.id}
                recipe={recipe}
                reason={reasons[0]}
                onPress={() => openRecipe(recipe.id)}
              />
            ))}
          </ScrollView>

          {seasonal.length > 0 ? (
            <>
              <SectionHeader
                title={seasonLabel(currentSeason())}
                subtitle="Cooking with what is fresh right now"
                actionLabel="Explore"
                onAction={() => router.push('/(tabs)/recipes')}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
                {seasonal.map(({ recipe }) => (
                  <MiniRecipe key={recipe.id} recipe={recipe} onPress={() => openRecipe(recipe.id)} />
                ))}
              </ScrollView>
            </>
          ) : null}

          {favorites.length > 0 ? (
            <>
              <SectionHeader
                title="Saved recipes"
                actionLabel={`${favorites.length} saved`}
                onAction={() => router.push('/(tabs)/recipes')}
              />
              {favorites.slice(0, 3).map((recipe) => (
                <Pressable
                  key={recipe.id}
                  onPress={() => openRecipe(recipe.id)}
                  style={({ pressed }) => [styles.savedRow, pressed && { opacity: 0.8 }]}
                >
                  <FoodImage uri={recipe.image} height={58} borderRadius={12}>
                    <View />
                  </FoodImage>
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyStrong" numberOfLines={1}>
                      {recipe.name}
                    </Txt>
                    <Txt variant="tiny" color={colors.inkSoft}>
                      {recipe.cuisine} · {recipe.prepMinutes + recipe.cookMinutes} min
                    </Txt>
                  </View>
                  <ChevronRight size={16} color={colors.inkFaint} />
                </Pressable>
              ))}
            </>
          ) : null}

          {recent.length > 0 ? (
            <>
              <SectionHeader title="Recently viewed" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {recent.map((recipe) => (
                  <Pressable
                    key={recipe.id}
                    onPress={() => openRecipe(recipe.id)}
                    style={styles.recentChip}
                  >
                    <Txt variant="tiny" color={colors.inkSoft} style={{ fontWeight: '600' }}>
                      {recipe.name}
                    </Txt>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          <View style={styles.demoNote}>
            <TrendingUp size={14} color={colors.inkFaint} />
            <Txt variant="tiny" color={colors.inkFaint} style={{ flex: 1 }}>
              Demo build: recipes, pantry and retailer prices are sample data. No real order is placed from Rasoi.
            </Txt>
          </View>
        </View>
      </ScrollView>

      <Sheet visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} title="Notifications">
        <Txt variant="small" color={colors.inkSoft} style={{ marginBottom: spacing.md }}>
          Choose what you want to hear about. Push delivery needs FCM configuration; preferences are saved on this device.
        </Txt>
        <ToggleRow
          title="Weekly meal planning"
          description="A gentle nudge to plan the week ahead"
          value={state.notifications.weeklyPlan}
          onValueChange={(value) => updateNotifications({ weeklyPlan: value })}
        />
        <ToggleRow
          title="Grocery reminders"
          description="When your smart basket is ready"
          value={state.notifications.groceryReminder}
          onValueChange={(value) => updateNotifications({ groceryReminder: value })}
        />
        <ToggleRow
          title="Pantry expiry"
          description="Before staples go past their date"
          value={state.notifications.pantryExpiry}
          onValueChange={(value) => updateNotifications({ pantryExpiry: value })}
        />
        <ToggleRow
          title="Cooking reminders"
          description="Resume a recipe you started"
          value={state.notifications.cookingReminder}
          onValueChange={(value) => updateNotifications({ cookingReminder: value })}
        />
        <ToggleRow
          title="Offers"
          description="Only with explicit consent"
          value={state.notifications.offers}
          onValueChange={(value) => updateNotifications({ offers: value })}
        />
      </Sheet>
    </SafeAreaView>
  );
}

function MiniRecipe({ recipe, reason, onPress }: { recipe: Recipe; reason?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.miniCard, pressed && { opacity: 0.88 }]}
    >
      <FoodImage uri={recipe.image} height={116} borderRadius={radius.md}>
        <View style={{ padding: spacing.sm, flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={styles.miniDiet}>
            <DietMark foodType={recipe.foodType} />
          </View>
          <View style={styles.miniTime}>
            <Clock size={10} color={colors.ink} />
            <Txt variant="tiny" color={colors.ink} style={{ fontWeight: '700', fontSize: 10 }}>
              {recipe.prepMinutes + recipe.cookMinutes}m
            </Txt>
          </View>
        </View>
      </FoodImage>
      <View style={{ padding: spacing.md }}>
        <Txt variant="tiny" color={colors.orange} style={{ fontWeight: '800', textTransform: 'uppercase' }}>
          {recipe.cuisine}
        </Txt>
        <Txt variant="bodyStrong" numberOfLines={2} style={{ marginTop: 2, minHeight: 42 }}>
          {recipe.name}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <Txt variant="tiny" color={colors.inkSoft}>
            {formatINR(recipe.costPerServing)}/serve
          </Txt>
          {reason ? (
            <Txt variant="tiny" color={colors.forest} numberOfLines={1} style={{ marginLeft: 'auto', maxWidth: 108 }}>
              {reason}
            </Txt>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: colors.cream,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  bellDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.orange,
    borderWidth: 1,
    borderColor: colors.white,
  },
  chipRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' },
  contextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.mintPale,
    paddingHorizontal: 9,
    height: 26,
    borderRadius: radius.pill,
    maxWidth: 160,
  },
  continueCard: {
    backgroundColor: colors.forest,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.raised,
  },
  continueIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.mint,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 9,
    height: 26,
    borderRadius: radius.pill,
  },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.inkFaint },
  quickRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  quickTile: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    paddingVertical: spacing.md,
    paddingHorizontal: 8,
    alignItems: 'flex-start',
  },
  quickIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.mintPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  slotLabel: { width: 74 },
  addSlot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCard: {
    width: 214,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    overflow: 'hidden',
    ...shadow.card,
  },
  miniDiet: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    padding: 3,
    borderRadius: 4,
  },
  miniTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 6,
    height: 20,
    borderRadius: radius.pill,
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  recentChip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  demoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: spacing.xxl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
});
