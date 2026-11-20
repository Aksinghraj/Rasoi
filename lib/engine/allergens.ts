import { ingredientMap } from '@/lib/data/ingredients';
import { DietType, Preferences, Recipe, RestrictionId } from '@/lib/types';

const DIET_ACCEPTS: Record<DietType, DietType[]> = {
  vegan: ['vegan'],
  vegetarian: ['vegetarian', 'vegan', 'jain'],
  eggetarian: ['eggetarian', 'vegetarian', 'vegan', 'jain'],
  non_vegetarian: ['non_vegetarian', 'pescatarian', 'eggetarian', 'vegetarian', 'vegan', 'jain'],
  pescatarian: ['pescatarian', 'eggetarian', 'vegetarian', 'vegan', 'jain'],
  jain: ['jain'],
};

export function dietAccepts(userDiet: DietType, recipe: Recipe): boolean {
  const accepted = DIET_ACCEPTS[userDiet];
  return recipe.dietTypes.some((diet) => accepted.includes(diet));
}

export function recipeAllergens(recipe: Recipe): string[] {
  const allergens = new Set<string>();
  for (const item of recipe.ingredients) {
    const ingredient = ingredientMap[item.ingredientId];
    ingredient?.allergens.forEach((allergen) => allergens.add(allergen));
  }
  return [...allergens].sort();
}

export function recipeContainsIngredient(recipe: Recipe, ingredientId: string): boolean {
  return recipe.ingredients.some((item) => item.ingredientId === ingredientId);
}

export function restrictionConflicts(recipe: Recipe, restrictions: RestrictionId[]): string[] {
  const conflicts: string[] = [];
  const allergens = recipeAllergens(recipe);
  for (const restriction of restrictions) {
    if (restriction === 'gluten_free' && allergens.includes('wheat')) conflicts.push('contains gluten');
    if (restriction === 'dairy_free' && allergens.includes('milk')) conflicts.push('contains dairy');
    if (restriction === 'nut_free' && (allergens.includes('peanuts') || allergens.includes('tree_nuts'))) {
      conflicts.push('contains nuts');
    }
    if (restriction === 'low_carb' && recipe.nutrition.carbs > 40) conflicts.push('higher in carbs');
    if (restriction === 'high_protein' && recipe.nutrition.protein < 12) conflicts.push('lower in protein');
    if (restriction === 'low_sodium') {
      const salt = recipe.ingredients.find((item) => item.ingredientId === 'salt');
      const saltPerServing = salt ? (salt.quantity * (salt.unit === 'kg' ? 1000 : 1)) / recipe.baseServings : 0;
      if (saltPerServing > 1.5) conflicts.push('higher in sodium');
    }
  }
  return conflicts;
}

export function safetyConflicts(recipe: Recipe, prefs: Preferences): string[] {
  const conflicts: string[] = [];
  const allergens = recipeAllergens(recipe);
  for (const allergen of prefs.allergens) {
    if (allergens.includes(allergen)) conflicts.push(`contains ${allergen.replace(/_/g, ' ')}`);
  }
  for (const exclusion of prefs.customExclusions) {
    if (recipeContainsIngredient(recipe, exclusion)) {
      conflicts.push(`contains ${ingredientMap[exclusion]?.name ?? exclusion}`);
    }
  }
  conflicts.push(...restrictionConflicts(recipe, prefs.restrictions));
  return conflicts;
}

export function isRecipeSafe(recipe: Recipe, prefs: Preferences): boolean {
  return safetyConflicts(recipe, prefs).length === 0;
}

export function stovetopAvailable(prefs: Preferences): boolean {
  return prefs.equipment.includes('gas_stove') || prefs.equipment.includes('induction');
}

export function missingEquipment(recipe: Recipe, prefs: Preferences): string[] {
  const missing: string[] = [];
  for (const equipment of recipe.equipment) {
    if (equipment === 'gas_stove' && stovetopAvailable(prefs)) continue;
    if (!prefs.equipment.includes(equipment)) missing.push(equipment);
  }
  return missing;
}

export function isRecipeAllowed(recipe: Recipe, prefs: Preferences): boolean {
  return dietAccepts(prefs.diet, recipe) && isRecipeSafe(recipe, prefs) && missingEquipment(recipe, prefs).length === 0;
}

export function allergenSummary(recipe: Recipe): string {
  const allergens = recipeAllergens(recipe);
  if (allergens.length === 0) return 'No major allergens declared';
  return allergens
    .map((allergen) => allergen.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(' · ');
}
