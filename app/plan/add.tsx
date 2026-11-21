import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Search, Sparkles } from 'lucide-react-native';
import { useApp } from '@/lib/store/AppContext';
import { RecipeCard } from '@/components/RecipeCard';
import { Badge, Button, EmptyState, Field, InfoBanner, ScreenHeader, Stepper, Txt } from '@/components/ui';
import { colors, mealSlotLabels, spacing } from '@/lib/theme';
import { formatDay } from '@/lib/format';
import { recommendRecipes } from '@/lib/engine/recommendation';
import { MealSlot } from '@/lib/types';

export default function AddMealScreen() {
  const params = useLocalSearchParams<{
    date?: string;
    slot?: string;
    replaceId?: string;
    recipeId?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, allRecipes, addRecipeToPlan, swapMeal } = useApp();
  const prefs = state.preferences;

  const date = params.date ?? '';
  const slot = (params.slot as MealSlot) ?? 'dinner';
  const replaceId = params.replaceId;

  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(params.recipeId ?? null);
  const [servings, setServings] = useState(state.household?.defaultServings ?? 2);
  const [error, setError] = useState<string | null>(null);

  const scored = useMemo(() => {
    if (!prefs) return [];
    return recommendRecipes(
      {
        prefs,
        recipes: allRecipes,
        recentRecipeIds: state.recentRecipeIds,
        pantryIngredientIds: state.pantry.map((item) => item.ingredientId),
      },
      { mealType: slot, query },
      80,
    );
  }, [prefs, allRecipes, state.recentRecipeIds, state.pantry, slot, query]);

  const selected = allRecipes.find((recipe) => recipe.id === selectedId) ?? null;

  const confirm = () => {
    if (!selected) return setError('Pick a recipe first.');
    if (!date) return setError('This day is missing. Go back and choose a day again.');
    if (replaceId) {
      swapMeal(date, replaceId, selected.id);
    } else {
      const plan = addRecipeToPlan(selected.id, date, slot, servings);
      if (!plan) return setError('Create a meal plan before adding meals.');
    }
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
      <ScreenHeader
        title={replaceId ? 'Replace meal' : 'Add a meal'}
        subtitle={date ? `${mealSlotLabels[slot]} · ${formatDay(date, 'long')}` : mealSlotLabels[slot]}
        onBack={() => router.back()}
      />
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: 140 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.searchRow}>
          <Search size={17} color={colors.inkFaint} />
          <View style={{ flex: 1 }}>
            <Field
              placeholder="Search recipes for this slot"
              value={query}
              onChangeText={setQuery}
              style={{ marginBottom: 0 }}
            />
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
          <Badge label={`${scored.length} safe matches`} tone="mint" />
          <Txt variant="tiny" color={colors.inkSoft}>
            Allergens and diet are enforced automatically
          </Txt>
        </View>

        {selected ? (
          <View style={{ marginBottom: spacing.lg }}>
            <InfoBanner
              message={`Selected: ${selected.name}. ${replaceId ? 'This will swap the current meal.' : 'Add servings below, then confirm.'}`}
              tone="mint"
            />
            <View style={styles.servingsRow}>
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong">Servings</Txt>
                <Txt variant="tiny" color={colors.inkSoft}>
                  Grocery quantities scale automatically
                </Txt>
              </View>
              <Stepper value={servings} onChange={setServings} min={1} max={12} />
            </View>
          </View>
        ) : null}

        {scored.length === 0 ? (
          <EmptyState
            icon={<Sparkles size={24} color={colors.forest} />}
            title="No recipes match this slot"
            message="Try a different search, or loosen your filters in preferences. Allergens are always respected."
            actionLabel="Edit preferences"
            onAction={() => router.push('/preferences')}
          />
        ) : (
          scored.map(({ recipe, reasons }) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              variant="row"
              reasons={reasons}
              isFavorite={state.favorites.includes(recipe.id)}
              onPress={() => {
                setSelectedId(recipe.id);
                setError(null);
              }}
            />
          ))
        )}

        {error ? (
          <View style={{ marginTop: spacing.md }}>
            <InfoBanner message={error} tone="red" />
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: spacing.lg + insets.bottom }]}>
        <View style={{ flex: 1 }}>
          <Txt variant="tiny" color={colors.inkFaint}>
            {selected ? selected.name : 'No recipe selected'}
          </Txt>
          <Txt variant="small" color={colors.inkSoft}>
            {mealSlotLabels[slot]}
            {date ? ` · ${formatDay(date)}` : ''}
          </Txt>
        </View>
        <Button
          label={replaceId ? 'Replace meal' : 'Add to plan'}
          disabled={!selected}
          onPress={confirm}
          fullWidth={false}
          style={{ minWidth: 140 }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
    backgroundColor: colors.cream,
  },
});
