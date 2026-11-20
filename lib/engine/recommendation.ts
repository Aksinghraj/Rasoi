import { currentSeason } from '@/lib/format';
import { ingredientMap } from '@/lib/data/ingredients';
import {
  isRecipeAllowed,
  missingEquipment,
  recipeAllergens,
  safetyConflicts,
} from '@/lib/engine/allergens';
import {
  CookingTimePreference,
  MealSlot,
  Preferences,
  Recipe,
  RecommendationContext,
  ScoredRecipe,
} from '@/lib/types';

export interface RecipeFilters {
  query?: string;
  cuisine?: string;
  mealType?: MealSlot | 'all';
  maxTime?: number;
  difficulty?: string;
  diet?: string;
  maxCost?: number;
  equipment?: string;
}

const TIME_LIMIT: Record<CookingTimePreference, number> = {
  quick: 30,
  balanced: 50,
  relaxed: 120,
};

function hash(text: string): number {
  let value = 0;
  for (let index = 0; index < text.length; index += 1) {
    value = (value * 31 + text.charCodeAt(index)) % 1000;
  }
  return value;
}

export function recipeMatchesQuery(recipe: Recipe, query: string): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  const haystack = [
    recipe.name,
    recipe.description,
    recipe.cuisine,
    recipe.region,
    ...recipe.tags,
    ...recipe.ingredients.map((item) => ingredientMap[item.ingredientId]?.name ?? ''),
  ]
    .join(' ')
    .toLowerCase();
  return term.split(/\s+/).every((word) => haystack.includes(word));
}

export function recommendRecipes(
  context: RecommendationContext,
  filters: RecipeFilters = {},
  limit = 20,
): ScoredRecipe[] {
  const { prefs, recipes, recentRecipeIds, pantryIngredientIds = [] } = context;
  const season = currentSeason();
  const pantry = new Set(pantryIngredientIds);
  const recent = new Set(recentRecipeIds);
  const timeLimit = filters.maxTime ?? TIME_LIMIT[prefs.cookingTime];

  const scored: ScoredRecipe[] = [];

  for (const recipe of recipes) {
    if (!isRecipeAllowed(recipe, prefs)) continue;
    if (filters.mealType && filters.mealType !== 'all' && !recipe.mealTypes.includes(filters.mealType)) continue;
    if (filters.cuisine && filters.cuisine !== 'All' && recipe.cuisine !== filters.cuisine) continue;
    if (filters.difficulty && filters.difficulty !== 'All' && recipe.difficulty !== filters.difficulty) continue;
    if (filters.diet && filters.diet !== 'All' && !recipe.dietTypes.includes(filters.diet as never)) continue;
    if (filters.equipment && filters.equipment !== 'All' && !recipe.equipment.includes(filters.equipment as never)) {
      continue;
    }
    if (filters.maxCost !== undefined && recipe.costPerServing > filters.maxCost) continue;
    if (filters.query && !recipeMatchesQuery(recipe, filters.query)) continue;

    const totalTime = recipe.prepMinutes + recipe.cookMinutes;
    if (totalTime > timeLimit + 20) continue;

    let score = 50;
    const reasons: string[] = [];

    if (recipe.dietTypes.includes(prefs.diet)) {
      score += 10;
      reasons.push('Matches your diet');
    }
    if (prefs.region && recipe.region.toLowerCase().includes(prefs.region.toLowerCase())) {
      score += 5;
      reasons.push(`Regional favourite`);
    }
    const covered = recipe.ingredients.filter((item) => pantry.has(item.ingredientId)).length;
    if (covered > 0) {
      const coverage = covered / recipe.ingredients.length;
      score += Math.round(coverage * 14);
      if (coverage >= 0.5) reasons.push(`${covered} ingredients already at home`);
    }
    if (totalTime <= TIME_LIMIT[prefs.cookingTime]) {
      score += prefs.cookingTime === 'quick' ? 12 : 6;
      if (prefs.cookingTime === 'quick') reasons.push('Ready in under 30 minutes');
    }
    const dailyMealBudget = prefs.budget.daily / Math.max(1, prefs.mealTypes.length);
    if (recipe.costPerServing <= dailyMealBudget) {
      score += 7;
      reasons.push('Within your daily food budget');
    } else if (recipe.costPerServing > dailyMealBudget * 1.6) {
      score -= 8;
    }
    if (recipe.season === season) {
      score += 6;
      reasons.push('In season');
    } else if (recipe.season !== 'all') {
      score -= 2;
    }
    if (prefs.restrictions.includes('high_protein') && recipe.nutrition.protein >= 18) {
      score += 8;
      reasons.push('High protein');
    }
    if (prefs.region && recipe.region === prefs.region) score += 3;
    if (recent.has(recipe.id)) score -= 22;
    score += (hash(recipe.id) % 7) - 3;
    if (recipe.verified) score += 2;

    scored.push({ recipe, score, reasons: [...new Set(reasons)].slice(0, 3) });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.recipe.name.localeCompare(b.recipe.name))
    .slice(0, limit);
}

export function surpriseMe(context: RecommendationContext, filters: RecipeFilters = {}): Recipe | null {
  const pool = recommendRecipes(context, filters, 12);
  if (pool.length === 0) return null;
  const top = pool.slice(0, Math.min(6, pool.length));
  const index = Math.floor(Math.random() * top.length);
  return top[index].recipe;
}

export function recommendationReasons(recipe: Recipe, prefs: Preferences): string[] {
  const reasons: string[] = [];
  if (recipe.dietTypes.includes(prefs.diet)) reasons.push('Matches your diet');
  if (recipe.season === currentSeason()) reasons.push('In season');
  if (recipe.costPerServing <= prefs.budget.daily / Math.max(1, prefs.mealTypes.length)) {
    reasons.push('Budget friendly');
  }
  if (recipe.nutrition.protein >= 18) reasons.push('High protein');
  return reasons;
}

export function explainSafety(recipe: Recipe, prefs: Preferences): string {
  const conflicts = safetyConflicts(recipe, prefs);
  if (conflicts.length > 0) return `Not suitable: ${conflicts.join(', ')}`;
  const missing = missingEquipment(recipe, prefs);
  if (missing.length > 0) return `Needs ${missing.join(', ').replace(/_/g, ' ')}`;
  if (recipeAllergens(recipe).length === 0) return 'No major allergens declared';
  return `Contains ${recipeAllergens(recipe).join(', ').replace(/_/g, ' ')}`;
}

export function availableCuisines(recipes: Recipe[]): string[] {
  return [...new Set(recipes.map((recipe) => recipe.cuisine))].sort();
}
