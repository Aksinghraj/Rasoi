import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, Search, Trash2 } from 'lucide-react-native';
import { useApp } from '@/lib/store/AppContext';
import {
  Badge,
  Button,
  Card,
  Chip,
  Field,
  InfoBanner,
  ScreenHeader,
  Sheet,
  Stepper,
  Txt,
} from '@/components/ui';
import {
  colors,
  dietLabels,
  equipmentLabels,
  mealSlotLabels,
  mealSlotOrder,
  radius,
  spacing,
} from '@/lib/theme';
import { uid } from '@/lib/format';
import { ingredients } from '@/lib/data/ingredients';
import { toBase, unitLabels, canonicalUnitFor } from '@/lib/engine/units';
import {
  cleanRecipeSteps,
  hasValidIngredientQuantities,
  safeBaseServings,
} from '@/lib/engine/customRecipe';
import {
  DietType,
  Difficulty,
  EquipmentId,
  FoodType,
  IngredientCategory,
  MealSlot,
  Recipe,
  RecipeIngredient,
  RecipeStep,
  Unit,
} from '@/lib/types';

const STOCK_IMAGE =
  'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop';

const UNIT_OPTIONS: Unit[] = ['g', 'kg', 'ml', 'l', 'piece', 'tbsp', 'tsp', 'cup'];

const MACROS: Record<IngredientCategory, { kcal: number; protein: number; carbs: number; fat: number }> = {
  grains: { kcal: 350, protein: 9, carbs: 70, fat: 2 },
  pulses: { kcal: 340, protein: 24, carbs: 55, fat: 2 },
  dairy: { kcal: 200, protein: 12, carbs: 8, fat: 13 },
  vegetables: { kcal: 40, protein: 2, carbs: 7, fat: 0.4 },
  fruits: { kcal: 55, protein: 0.8, carbs: 13, fat: 0.3 },
  spices: { kcal: 250, protein: 10, carbs: 40, fat: 8 },
  meat_seafood: { kcal: 190, protein: 22, carbs: 1, fat: 11 },
  frozen: { kcal: 150, protein: 6, carbs: 20, fat: 5 },
  snacks: { kcal: 300, protein: 6, carbs: 45, fat: 11 },
  household: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  other: { kcal: 120, protein: 4, carbs: 15, fat: 5 },
};

interface DraftIngredient extends RecipeIngredient {
  key: string;
}

export default function CreateRecipeScreen() {
  const router = useRouter();
  const { addCustomRecipe, addAudit, state } = useApp();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cuisine, setCuisine] = useState('Indian');
  const [region, setRegion] = useState(state.preferences?.region ?? 'India');
  const [image, setImage] = useState('');
  const [prep, setPrep] = useState('10');
  const [cook, setCook] = useState('20');
  const [servings, setServings] = useState(state.household?.defaultServings ?? 2);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [foodType, setFoodType] = useState<FoodType>('veg');
  const [diet, setDiet] = useState<DietType>(state.preferences?.diet ?? 'vegetarian');
  const [mealTypes, setMealTypes] = useState<MealSlot[]>(['dinner']);
  const [equipment, setEquipment] = useState<EquipmentId[]>(state.preferences?.equipment ?? ['gas_stove']);
  const [draftIngredients, setDraftIngredients] = useState<DraftIngredient[]>([]);
  const [steps, setSteps] = useState<RecipeStep[]>([{ text: '' }]);
  const [error, setError] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filteredIngredients = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = [...ingredients].sort((a, b) => a.name.localeCompare(b.name));
    if (!term) return list.slice(0, 40);
    return list
      .filter(
        (item) =>
          item.name.toLowerCase().includes(term) ||
          item.aliases.some((alias) => alias.includes(term)),
      )
      .slice(0, 40);
  }, [query]);

  const toggleMealType = (slot: MealSlot) => {
    setMealTypes((prev) =>
      prev.includes(slot) ? prev.filter((item) => item !== slot) : [...prev, slot],
    );
  };

  const toggleEquipment = (id: EquipmentId) => {
    setEquipment((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const addIngredient = (ingredientId: string) => {
    const ingredient = ingredients.find((item) => item.id === ingredientId);
    if (!ingredient) return;
    const unit = canonicalUnitFor(ingredient);
    const quantity = ingredient.dimension === 'piece' ? 1 : ingredient.dimension === 'volume' ? 200 : 100;
    setDraftIngredients((prev) => {
      const existing = prev.find((item) => item.ingredientId === ingredientId && item.unit === unit);
      if (existing) {
        return prev.map((item) =>
          item.key === existing.key ? { ...item, quantity: item.quantity + quantity } : item,
        );
      }
      return [...prev, { key: uid('ing'), ingredientId, quantity, unit }];
    });
    setPickerOpen(false);
    setQuery('');
  };

  const updateIngredient = (key: string, patch: Partial<DraftIngredient>) => {
    setDraftIngredients((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  };

  const estimateNutrition = () => {
    let calories = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;
    let cost = 0;
    const safeServings = safeBaseServings(servings);
    for (const draft of draftIngredients) {
      const ingredient = ingredients.find((item) => item.id === draft.ingredientId);
      if (!ingredient) continue;
      let grams = draft.quantity;
      try {
        grams = toBase(draft.quantity, draft.unit, ingredient);
      } catch {
        grams = draft.quantity;
      }
      const per100 = MACROS[ingredient.category];
      const factor = grams / 100;
      calories += per100.kcal * factor;
      protein += per100.protein * factor;
      carbs += per100.carbs * factor;
      fat += per100.fat * factor;
      cost += grams * ingredient.pricePerBase;
    }
    return {
      nutrition: {
        calories: Math.round(calories / safeServings),
        protein: Math.round(protein / safeServings),
        carbs: Math.round(carbs / safeServings),
        fat: Math.round(fat / safeServings),
      },
      costPerServing: Math.round((cost / safeServings) * 10) / 10,
    };
  };

  const submit = () => {
    if (!name.trim()) return setError('Give your recipe a name.');
    if (draftIngredients.length === 0) return setError('Add at least one ingredient.');
    if (!hasValidIngredientQuantities(draftIngredients)) {
      return setError('Every ingredient needs a quantity above zero.');
    }
    const cleanSteps = cleanRecipeSteps(steps);
    if (cleanSteps.length === 0) return setError('Add at least one cooking step.');
    if (mealTypes.length === 0) return setError('Choose at least one meal type.');

    const estimate = estimateNutrition();
    const recipe: Recipe = {
      id: uid('custom'),
      name: name.trim(),
      description: description.trim() || 'A recipe from my kitchen.',
      cuisine: cuisine.trim() || 'Indian',
      region: region.trim() || 'India',
      mealTypes,
      dietTypes: [diet],
      foodType,
      image: image.trim() || STOCK_IMAGE,
      prepMinutes: Math.max(0, Number(prep) || 0),
      cookMinutes: Math.max(0, Number(cook) || 0),
      difficulty,
      baseServings: safeBaseServings(servings),
      ingredients: draftIngredients.map(({ key, ...item }) => item),
      steps: cleanSteps,
      nutrition: estimate.nutrition,
      tags: ['my recipe'],
      equipment,
      season: 'all',
      costPerServing: estimate.costPerServing,
      curated: false,
      verified: false,
    };
    addCustomRecipe(recipe);
    addAudit('custom_recipe_created', `Created ${recipe.name}`);
    router.replace({ pathname: '/recipe/[id]', params: { id: recipe.id } });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
      <ScreenHeader title="Create a recipe" subtitle="Saved to this device" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <InfoBanner
          message="Custom recipes are stored locally and never published. Nutrition and cost are estimates calculated from the ingredients you add."
          tone="neutral"
        />

        <Card style={{ marginTop: spacing.lg }}>
          <Field label="Recipe name" placeholder="e.g. Sunday paneer bhurji" value={name} onChangeText={setName} />
          <Field
            label="Short description"
            placeholder="What makes this dish yours?"
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Field label="Cuisine" value={cuisine} onChangeText={setCuisine} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Region" value={region} onChangeText={setRegion} />
            </View>
          </View>
          <Field
            label="Image URL (optional)"
            placeholder="https://…"
            value={image}
            onChangeText={setImage}
            autoCapitalize="none"
            helper="Leave blank to use a stock food photo."
          />
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Txt variant="h3">Meal types</Txt>
          <View style={styles.chipWrap}>
            {mealSlotOrder.map((slot) => (
              <Chip
                key={slot}
                label={mealSlotLabels[slot]}
                selected={mealTypes.includes(slot)}
                onPress={() => toggleMealType(slot)}
              />
            ))}
          </View>

          <Txt variant="h3" style={{ marginTop: spacing.lg }}>
            Diet
          </Txt>
          <View style={styles.chipWrap}>
            {(Object.keys(dietLabels) as DietType[]).map((option) => (
              <Chip key={option} label={dietLabels[option]} selected={diet === option} onPress={() => setDiet(option)} />
            ))}
          </View>

          <Txt variant="h3" style={{ marginTop: spacing.lg }}>
            Food type
          </Txt>
          <View style={styles.chipWrap}>
            {(['veg', 'egg', 'non_veg'] as FoodType[]).map((option) => (
              <Chip
                key={option}
                label={option === 'veg' ? 'Vegetarian' : option === 'egg' ? 'Contains egg' : 'Non-vegetarian'}
                selected={foodType === option}
                onPress={() => setFoodType(option)}
              />
            ))}
          </View>

          <Txt variant="h3" style={{ marginTop: spacing.lg }}>
            Difficulty
          </Txt>
          <View style={styles.chipWrap}>
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((option) => (
              <Chip key={option} label={option} selected={difficulty === option} onPress={() => setDifficulty(option)} />
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
            <View style={{ flex: 1 }}>
              <Field label="Prep (min)" value={prep} onChangeText={setPrep} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Cook (min)" value={cook} onChangeText={setCook} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Txt variant="small" color={colors.inkSoft} style={{ fontWeight: '600', marginBottom: 6 }}>
                Servings
              </Txt>
              <Stepper value={servings} onChange={setServings} min={1} max={12} />
            </View>
          </View>
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Txt variant="h3">Ingredients</Txt>
            <Button
              label="Add"
              size="sm"
              variant="secondary"
              fullWidth={false}
              icon={<Plus size={14} color={colors.forest} />}
              onPress={() => setPickerOpen(true)}
            />
          </View>
          {draftIngredients.length === 0 ? (
            <Txt variant="small" color={colors.inkSoft} style={{ marginTop: spacing.sm }}>
              No ingredients yet. Add them to generate a grocery list and nutrition estimate.
            </Txt>
          ) : (
            draftIngredients.map((draft) => {
              const ingredient = ingredients.find((item) => item.id === draft.ingredientId);
              return (
                <View key={draft.key} style={styles.ingredientRow}>
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyStrong">{ingredient?.name ?? draft.ingredientId}</Txt>
                    <Txt variant="tiny" color={colors.inkFaint}>
                      {ingredient?.category}
                    </Txt>
                  </View>
                  <Field
                    value={`${draft.quantity}`}
                    onChangeText={(text) => {
                      const value = Number(text.replace(/[^0-9.]/g, ''));
                      updateIngredient(draft.key, { quantity: Number.isFinite(value) ? value : 0 });
                    }}
                    keyboardType="decimal-pad"
                    style={{ textAlign: 'center' }}
                  />
                  <View style={styles.unitChips}>
                    {UNIT_OPTIONS.filter((unit) =>
                      ingredient
                        ? unit === 'piece'
                          ? ingredient.dimension === 'piece'
                          : ingredient.dimension === 'weight'
                            ? ['g', 'kg', 'tbsp', 'tsp', 'cup'].includes(unit)
                            : ['ml', 'l', 'tbsp', 'tsp', 'cup'].includes(unit)
                        : true,
                    ).map((unit) => (
                      <Chip
                        key={unit}
                        label={unitLabels[unit]}
                        selected={draft.unit === unit}
                        onPress={() => updateIngredient(draft.key, { unit })}
                      />
                    ))}
                  </View>
                  <Pressable
                    onPress={() => setDraftIngredients((prev) => prev.filter((item) => item.key !== draft.key))}
                    hitSlop={8}
                    accessibilityLabel="Remove ingredient"
                  >
                    <Trash2 size={16} color={colors.red} />
                  </Pressable>
                </View>
              );
            })
          )}
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Txt variant="h3">Cooking steps</Txt>
          {steps.map((step, index) => (
            <View key={index} style={{ marginTop: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Txt variant="small" color={colors.inkSoft} style={{ fontWeight: '700' }}>
                  Step {index + 1}
                </Txt>
                {steps.length > 1 ? (
                  <Pressable
                    onPress={() => setSteps((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                    hitSlop={8}
                  >
                    <Trash2 size={15} color={colors.red} />
                  </Pressable>
                ) : null}
              </View>
              <Field
                placeholder="Describe this step"
                value={step.text}
                onChangeText={(text) =>
                  setSteps((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, text } : item)))
                }
                multiline
              />
              <Field
                label="Timer (optional, minutes)"
                value={step.timerMinutes ? `${step.timerMinutes}` : ''}
                keyboardType="number-pad"
                onChangeText={(text) => {
                  const value = Number(text.replace(/[^0-9]/g, ''));
                  setSteps((prev) =>
                    prev.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, timerMinutes: value || undefined } : item,
                    ),
                  );
                }}
              />
            </View>
          ))}
          <Button
            label="Add another step"
            variant="ghost"
            size="sm"
            icon={<Plus size={15} color={colors.forest} />}
            onPress={() => setSteps((prev) => [...prev, { text: '' }])}
          />
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Txt variant="h3">Equipment used</Txt>
          <View style={styles.chipWrap}>
            {(Object.keys(equipmentLabels) as EquipmentId[]).map((id) => (
              <Chip
                key={id}
                label={equipmentLabels[id]}
                selected={equipment.includes(id)}
                onPress={() => toggleEquipment(id)}
              />
            ))}
          </View>
        </Card>

        {error ? (
          <View style={{ marginTop: spacing.lg }}>
            <InfoBanner message={error} tone="red" />
          </View>
        ) : null}

        <Button label="Save recipe" style={{ marginTop: spacing.lg }} onPress={submit} />
      </ScrollView>

      <Sheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title="Add an ingredient" height={520}>
        <View style={styles.searchWrap}>
          <Search size={16} color={colors.inkFaint} />
          <Field
            placeholder="Search ingredients"
            value={query}
            onChangeText={setQuery}
            style={{ marginBottom: 0 }}
          />
        </View>
        {filteredIngredients.map((ingredient) => (
          <Pressable
            key={ingredient.id}
            onPress={() => addIngredient(ingredient.id)}
            style={({ pressed }) => [styles.pickerRow, pressed && { opacity: 0.7 }]}
          >
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">{ingredient.name}</Txt>
              <Txt variant="tiny" color={colors.inkFaint}>
                {ingredient.category} · per {canonicalUnitFor(ingredient)}
              </Txt>
            </View>
            {ingredient.allergens.length > 0 ? <Badge label={ingredient.allergens.join(', ')} tone="orange" /> : null}
            <Plus size={16} color={colors.forest} />
          </Pressable>
        ))}
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  unitChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, maxWidth: 130 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
});
