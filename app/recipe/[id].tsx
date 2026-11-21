import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  ChevronLeft,
  Clock,
  Flame,
  Heart,
  Plus,
  Share2,
  ShoppingBasket,
  Timer,
  Trash2,
  Users,
} from 'lucide-react-native';
import { useApp } from '@/lib/store/AppContext';
import {
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  FoodImage,
  InfoBanner,
  ScreenHeader,
  Stepper,
  Txt,
} from '@/components/ui';
import { DietMark } from '@/components/RecipeCard';
import { allergenLabels, colors, difficultyLabels, equipmentLabels, radius, spacing } from '@/lib/theme';
import { formatINR, todayISO } from '@/lib/format';
import { getIngredient } from '@/lib/data/ingredients';
import { toBase, fromBase, displayUnitFor, formatQuantity } from '@/lib/engine/units';
import { missingEquipment, recipeAllergens, safetyConflicts } from '@/lib/engine/allergens';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { allRecipes, state, toggleFavorite, deleteCustomRecipe, addAudit } = useApp();
  const recipe = allRecipes.find((item) => item.id === id) ?? null;
  const [servings, setServings] = useState(state.household?.defaultServings ?? 2);

  const isFavorite = recipe ? state.favorites.includes(recipe.id) : false;
  const isCustom = recipe ? state.customRecipes.some((item) => item.id === recipe.id) : false;
  const allergens = useMemo(() => (recipe ? recipeAllergens(recipe) : []), [recipe]);
  const conflicts = useMemo(
    () => (recipe && state.preferences ? safetyConflicts(recipe, state.preferences) : []),
    [recipe, state.preferences],
  );
  const equipmentGaps = useMemo(
    () => (recipe && state.preferences ? missingEquipment(recipe, state.preferences) : []),
    [recipe, state.preferences],
  );

  if (!recipe) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
        <ScreenHeader title="Recipe" onBack={() => router.back()} />
        <EmptyState
          title="Recipe not found"
          message="This recipe may have been removed. Browse the library to find something else."
          actionLabel="Browse recipes"
          onAction={() => router.replace('/(tabs)/recipes')}
        />
      </SafeAreaView>
    );
  }

  const multiplier = servings / recipe.baseServings;
  const totalTime = recipe.prepMinutes + recipe.cookMinutes;
  const nutrition = {
    calories: Math.round(recipe.nutrition.calories * multiplier),
    protein: Math.round(recipe.nutrition.protein * multiplier),
    carbs: Math.round(recipe.nutrition.carbs * multiplier),
    fat: Math.round(recipe.nutrition.fat * multiplier),
    fibre: recipe.nutrition.fibre ? Math.round(recipe.nutrition.fibre * multiplier) : null,
  };

  const scaledIngredients = recipe.ingredients.map((item) => {
    const ingredient = getIngredient(item.ingredientId);
    if (!ingredient) {
      return { key: item.ingredientId, name: item.ingredientId.replace(/_/g, ' '), display: `${item.quantity} ${item.unit}`, note: item.note, optional: item.optional };
    }
    try {
      const base = toBase(item.quantity, item.unit, ingredient) * multiplier;
      const unit = displayUnitFor(ingredient, base);
      const value = fromBase(base, ingredient, unit);
      return {
        key: item.ingredientId,
        name: ingredient.name,
        display: formatQuantity(value, unit),
        note: item.note,
        optional: item.optional,
      };
    } catch {
      return { key: item.ingredientId, name: ingredient.name, display: `${item.quantity} ${item.unit}`, note: item.note, optional: item.optional };
    }
  });

  const shareRecipe = async () => {
    try {
      await Share.share({
        message: `${recipe.name} — ${totalTime} min, serves ${servings}. Planned with Rasoi.`,
      });
    } catch {
      addAudit('recipe_share_failed', `Could not share ${recipe.name}`);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        <FoodImage uri={recipe.image} height={310} borderRadius={0}>
          <View style={styles.heroTop}>
            <Pressable onPress={() => router.back()} style={styles.heroButton} accessibilityLabel="Go back">
              <ChevronLeft size={22} color={colors.ink} />
            </Pressable>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Pressable onPress={shareRecipe} style={styles.heroButton} accessibilityLabel="Share recipe">
                <Share2 size={18} color={colors.ink} />
              </Pressable>
              <Pressable
                onPress={() => toggleFavorite(recipe.id)}
                style={styles.heroButton}
                accessibilityLabel={isFavorite ? 'Remove from favourites' : 'Save to favourites'}
              >
                <Heart
                  size={18}
                  color={isFavorite ? colors.orange : colors.ink}
                  fill={isFavorite ? colors.orange : 'transparent'}
                />
              </Pressable>
            </View>
          </View>
        </FoodImage>

        <View style={{ padding: spacing.xl }}>
          <Txt variant="tiny" color={colors.orange} style={{ fontWeight: '800', letterSpacing: 1.5, marginBottom: spacing.sm }}>COOK SOMETHING GOOD</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <DietMark foodType={recipe.foodType} size={15} />
            <Txt variant="tiny" color={colors.orange} style={{ fontWeight: '800', textTransform: 'uppercase' }}>
              {recipe.cuisine} · {recipe.region}
            </Txt>
          </View>
          <Txt variant="h1" style={{ marginTop: 4 }}>
            {recipe.name}
          </Txt>
          <Txt variant="small" color={colors.inkSoft} style={{ marginTop: 6 }}>
            {recipe.description}
          </Txt>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Clock size={15} color={colors.forest} />
              <Txt variant="small" color={colors.inkSoft}>
                {totalTime} min
              </Txt>
            </View>
            <View style={styles.metaItem}>
              <Users size={15} color={colors.forest} />
              <Txt variant="small" color={colors.inkSoft}>
                Serves {servings}
              </Txt>
            </View>
            <View style={styles.metaItem}>
              <Flame size={15} color={colors.forest} />
              <Txt variant="small" color={colors.inkSoft}>
                {difficultyLabels[recipe.difficulty]}
              </Txt>
            </View>
            <Txt variant="small" color={colors.forest} style={{ fontWeight: '800', marginLeft: 'auto' }}>
              {formatINR(recipe.costPerServing * servings)} total
            </Txt>
          </View>

          {conflicts.length > 0 ? (
            <View style={{ marginTop: spacing.lg }}>
              <InfoBanner
                tone="red"
                title="Check before cooking"
                message={`This recipe conflicts with your saved safety settings: ${conflicts.join(', ')}. Rasoi will never hide or silently substitute these ingredients.`}
                icon={<AlertTriangle size={16} color={colors.red} />}
              />
            </View>
          ) : null}

          {equipmentGaps.length > 0 ? (
            <View style={{ marginTop: spacing.md }}>
              <InfoBanner
                tone="orange"
                title="Equipment not in your kitchen"
                message={`You have not listed ${equipmentGaps.join(', ')}. You can still cook this with an alternative method.`}
              />
            </View>
          ) : null}

          <View style={{ marginTop: spacing.xl, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Txt variant="tiny" color={colors.orange} style={{ fontWeight: '800', letterSpacing: 1.2 }}>GET EVERYTHING READY</Txt>
              <Txt variant="h2" style={{ marginTop: 3 }}>Ingredients</Txt>
            </View>
            <Txt variant="tiny" color={colors.inkFaint}>STEP 1 OF 2</Txt>
          </View>
          <Card style={{ marginTop: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Txt variant="bodyStrong">Adjust your servings</Txt>
                <Txt variant="tiny" color={colors.inkSoft}>
                  Scaled for {servings} {servings === 1 ? 'serving' : 'servings'}
                </Txt>
              </View>
              <Stepper value={servings} onChange={setServings} min={1} max={12} />
            </View>

            {allergens.length > 0 ? (
              <View style={styles.allergenRow}>
                {allergens.map((allergen) => (
                  <Badge key={allergen} label={allergenLabels[allergen] ?? allergen} tone="orange" />
                ))}
              </View>
            ) : (
              <View style={{ marginTop: spacing.sm }}>
                <Badge label="No declared allergens" tone="mint" />
              </View>
            )}

            <View style={{ marginTop: spacing.md }}>
              {scaledIngredients.map((item, index) => (
                <View key={`${item.key}-${index}`}>
                  {index > 0 ? <Divider style={{ marginVertical: 0 }} /> : null}
                  <View style={styles.ingredientRow}>
                    <View style={{ flex: 1 }}>
                      <Txt variant="bodyStrong">
                        {item.name}
                        {item.optional ? (
                          <Txt variant="tiny" color={colors.inkFaint}>
                            {'  '}optional
                          </Txt>
                        ) : null}
                      </Txt>
                      {item.note ? (
                        <Txt variant="tiny" color={colors.inkFaint}>
                          {item.note}
                        </Txt>
                      ) : null}
                    </View>
                    <Txt variant="small" color={colors.inkSoft} style={{ fontWeight: '600' }}>
                      {item.display}
                    </Txt>
                  </View>
                </View>
              ))}
            </View>

            <Button
              label="View on grocery list"
              variant="secondary"
              size="sm"
              icon={<ShoppingBasket size={15} color={colors.forest} />}
              style={{ marginTop: spacing.lg }}
              onPress={() => router.push('/(tabs)/grocery')}
            />
          </Card>

          <Card style={{ marginTop: spacing.lg }}>
            <Txt variant="h3">Nutrition per serving</Txt>
            <View style={styles.nutritionRow}>
              <NutritionCell label="Calories" value={`${Math.round(nutrition.calories / servings)}`} unit="kcal" />
              <NutritionCell label="Protein" value={`${Math.round(nutrition.protein / servings)}`} unit="g" />
              <NutritionCell label="Carbs" value={`${Math.round(nutrition.carbs / servings)}`} unit="g" />
              <NutritionCell label="Fat" value={`${Math.round(nutrition.fat / servings)}`} unit="g" />
            </View>
            <Txt variant="tiny" color={colors.inkFaint} style={{ marginTop: spacing.sm }}>
              Estimates only, calculated from ingredient quantities. Not medical or dietary advice.
            </Txt>
          </Card>

          <Card style={{ marginTop: spacing.lg }}>
            <Txt variant="h3">Method</Txt>
            <Txt variant="tiny" color={colors.inkSoft} style={{ marginBottom: spacing.md }}>
              {recipe.steps.length} steps · {recipe.prepMinutes} min prep · {recipe.cookMinutes} min cook
            </Txt>
            {recipe.steps.map((step, index) => (
              <View key={index} style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <Txt variant="tiny" color={colors.white} style={{ fontWeight: '800' }}>
                    {index + 1}
                  </Txt>
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="body">{step.text}</Txt>
                  {step.tip ? (
                    <Txt variant="tiny" color={colors.forest} style={{ marginTop: 3 }}>
                      Tip: {step.tip}
                    </Txt>
                  ) : null}
                  {step.timerMinutes ? (
                    <View style={styles.timerPill}>
                      <Timer size={11} color={colors.forest} />
                      <Txt variant="tiny" color={colors.forest} style={{ fontWeight: '700' }}>
                        {step.timerMinutes} min
                      </Txt>
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </Card>

          <Card style={{ marginTop: spacing.lg }}>
            <Txt variant="h3">Kitchen equipment</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
              {recipe.equipment.map((equipment) => (
                <Badge key={equipment} label={equipmentLabels[equipment] ?? equipment} tone="neutral" />
              ))}
            </View>
            {recipe.tags.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
                {recipe.tags.map((tag) => (
                  <Badge key={tag} label={tag} tone="mint" />
                ))}
              </View>
            ) : null}
          </Card>

          {isCustom ? (
            <Button
              label="Delete this custom recipe"
              variant="danger"
              size="sm"
              icon={<Trash2 size={15} color={colors.red} />}
              style={{ marginTop: spacing.lg }}
              onPress={() => {
                deleteCustomRecipe(recipe.id);
                router.replace('/(tabs)/recipes');
              }}
            />
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Start cooking"
          icon={<Flame size={16} color={colors.white} />}
          onPress={() =>
            router.push({ pathname: '/cook/[id]', params: { id: recipe.id, servings: `${servings}` } })
          }
          style={{ flex: 1 }}
        />
        <Button
          label="Add to plan"
          variant="secondary"
          icon={<Plus size={16} color={colors.forest} />}
          onPress={() =>
            router.push({
              pathname: '/plan/add',
              params: { date: todayISO(), slot: recipe.mealTypes[0] ?? 'dinner', recipeId: recipe.id },
            })
          }
          style={{ flex: 1 }}
        />
      </View>
    </SafeAreaView>
  );
}

function NutritionCell({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Txt variant="h3">
        {value}
        <Txt variant="tiny" color={colors.inkFaint}>
          {' '}
          {unit}
        </Txt>
      </Txt>
      <Txt variant="tiny" color={colors.inkSoft}>
        {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  heroButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    flexWrap: 'wrap',
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  allergenRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  nutritionRow: { flexDirection: 'row', marginTop: spacing.md, gap: spacing.sm },
  stepRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.creamDeep,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
    backgroundColor: colors.cream,
  },
});
