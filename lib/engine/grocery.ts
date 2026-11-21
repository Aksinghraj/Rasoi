import { getIngredient } from '@/lib/data/ingredients';
import { matchProductsForIngredient, products as defaultProducts, retailerMap, retailers } from '@/lib/data/products';
import {
  GroceryLine,
  GroceryList,
  ExtraItem,
  GrocerySource,
  Ingredient,
  MealPlan,
  NutritionSummary,
  PantryItem,
  Product,
  ProductMatch,
  Recipe,
  Unit,
} from '@/lib/types';
import { categoryLabels, categoryOrder } from '@/lib/categories';
import { displayUnitFor, formatQuantity, fromBase, toBase } from '@/lib/engine/units';

export interface MealWithRecipe {
  recipe: Recipe;
  servings: number;
}

export interface Requirement {
  ingredientId: string;
  ingredient: Ingredient;
  requiredBase: number;
  sources: GrocerySource[];
}

/** A grocery line re-matched against a single retailer's demo catalogue. */
export interface RetailerLineMatch {
  line: GroceryLine;
  best: ProductMatch | null;
  estimatedPrice: number | null;
}

export interface RetailerLineMatches {
  retailerId: string;
  lines: RetailerLineMatch[];
  total: number;
  matchedLines: number;
  totalLines: number;
}

export function aggregateMeals(meals: MealWithRecipe[]): Requirement[] {
  const map = new Map<string, Requirement>();

  for (const meal of meals) {
    if (!Number.isFinite(meal.servings) || meal.servings <= 0) continue;
    const multiplier = meal.servings / meal.recipe.baseServings;
    for (const item of meal.recipe.ingredients) {
      if (item.optional) continue;
      const ingredient = getIngredient(item.ingredientId);
      if (!ingredient) continue;
      let base: number;
      try {
        base = toBase(item.quantity * multiplier, item.unit, ingredient);
      } catch {
        continue;
      }
      const existing = map.get(item.ingredientId);
      const source: GrocerySource = {
        recipeId: meal.recipe.id,
        recipeName: meal.recipe.name,
        quantity: Math.round(item.quantity * multiplier * 10) / 10,
        unit: item.unit,
      };
      if (existing) {
        existing.requiredBase = Math.round((existing.requiredBase + base) * 100) / 100;
        existing.sources.push(source);
      } else {
        map.set(item.ingredientId, {
          ingredientId: item.ingredientId,
          ingredient,
          requiredBase: Math.round(base * 100) / 100,
          sources: [source],
        });
      }
    }
  }

  return [...map.values()].sort((a, b) => a.ingredient.name.localeCompare(b.ingredient.name));
}

export function pantryBaseFor(ingredient: Ingredient, pantry: PantryItem[]): number {
  let total = 0;
  for (const item of pantry) {
    if (item.ingredientId !== ingredient.id) continue;
    try {
      total += toBase(item.quantity, item.unit, ingredient);
    } catch {
      continue;
    }
  }
  return Math.round(total * 100) / 100;
}

export function mergeRequirements(requirements: Requirement[]): Requirement[] {
  const map = new Map<string, Requirement>();
  for (const requirement of requirements) {
    const existing = map.get(requirement.ingredientId);
    if (existing) {
      existing.requiredBase = Math.round((existing.requiredBase + requirement.requiredBase) * 100) / 100;
      existing.sources.push(...requirement.sources);
    } else {
      map.set(requirement.ingredientId, { ...requirement, sources: [...requirement.sources] });
    }
  }
  return [...map.values()];
}

export function planMeals(plan: MealPlan, recipes: Recipe[]): MealWithRecipe[] {
  const recipeIndex = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const meals: MealWithRecipe[] = [];
  for (const day of plan.days) {
    for (const slotMeals of Object.values(day.meals)) {
      for (const planned of slotMeals) {
        const recipe = recipeIndex.get(planned.recipeId);
        if (recipe) meals.push({ recipe, servings: planned.servings });
      }
    }
  }
  return meals;
}

export function planNutrition(meals: MealWithRecipe[]): NutritionSummary {
  return meals.reduce<NutritionSummary>(
    (total, meal) => {
      const multiplier = meal.servings / meal.recipe.baseServings;
      return {
        calories: total.calories + meal.recipe.nutrition.calories * multiplier,
        protein: total.protein + meal.recipe.nutrition.protein * multiplier,
        carbs: total.carbs + meal.recipe.nutrition.carbs * multiplier,
        fat: total.fat + meal.recipe.nutrition.fat * multiplier,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

function toDisplay(base: number, ingredient: Ingredient): { value: number; unit: Unit } {
  const unit = displayUnitFor(ingredient, base);
  return { value: fromBase(base, ingredient, unit), unit };
}

export interface BuildGroceryOptions {
  plan: MealPlan;
  recipes: Recipe[];
  pantry: PantryItem[];
  autoDeduct: boolean;
  extras: ExtraItem[];
  checked: Record<string, boolean>;
  products?: typeof defaultProducts;
  generatedAt?: string;
}

export function buildGroceryList(options: BuildGroceryOptions): GroceryList {
  const {
    plan,
    recipes,
    pantry,
    autoDeduct,
    extras,
    checked,
    products = defaultProducts,
    generatedAt = new Date().toISOString(),
  } = options;

  const meals = planMeals(plan, recipes);
  const requirements = mergeRequirements(aggregateMeals(meals));

  const lines: GroceryLine[] = requirements.map((requirement) => {
    const { ingredient } = requirement;
    const pantryAvailable = autoDeduct ? pantryBaseFor(ingredient, pantry) : 0;
    const pantryUsed = Math.min(pantryAvailable, requirement.requiredBase);
    const toBuy = Math.max(0, Math.round((requirement.requiredBase - pantryUsed) * 100) / 100);
    const requiredDisplay = toDisplay(requirement.requiredBase, ingredient);
    const toBuyDisplay = toDisplay(toBuy, ingredient);

    let best: ProductMatch | undefined;
    let alternatives: ProductMatch[] = [];
    if (toBuy > 0.001) {
      const match = matchProductsForIngredient(ingredient.id, toBuy, products);
      best = match.best ?? undefined;
      alternatives = match.alternatives;
    }

    const status: GroceryLine['status'] =
      toBuy <= 0.001 ? 'pantry_covered' : best ? 'matched' : 'unmatched';

    return {
      key: ingredient.id,
      ingredientId: ingredient.id,
      name: ingredient.name,
      category: ingredient.category,
      requiredBase: requirement.requiredBase,
      requiredDisplay: requiredDisplay.value,
      displayUnit: requiredDisplay.unit,
      dimension: ingredient.dimension,
      pantryUsed,
      toBuy,
      toBuyDisplay: toBuyDisplay.value,
      toBuyUnit: toBuyDisplay.unit,
      sources: requirement.sources,
      status,
      best,
      alternatives,
      estimatedPrice: best ? best.totalPrice : null,
    };
  });

  const sections = categoryOrder
    .map((category) => ({
      category,
      title: categoryLabels[category],
      lines: lines.filter((line) => line.category === category && line.toBuy > 0.001),
    }))
    .filter((section) => section.lines.length > 0);

  const comparisons = retailers.map((retailer) => {
    let total = 0;
    let matchedLines = 0;
    let totalLines = 0;
    for (const line of lines) {
      if (line.toBuy <= 0.001) continue;
      totalLines += 1;
      const match = matchProductsForIngredient(line.ingredientId, line.toBuy, products, retailer.id);
      if (match.best) {
        matchedLines += 1;
        total += match.best.totalPrice;
      }
    }
    return {
      retailerId: retailer.id,
      retailerName: retailer.name,
      total: Math.round(total * 100) / 100,
      matchedLines,
      totalLines,
      deliveryNote:
        retailer.status === 'sandbox'
          ? 'Sandbox pricing · no real order'
          : 'Retailer-controlled pricing · deep-link mode',
    };
  });

  const extraLines = extras.map((extra) => ({
    key: extra.id,
    extra: {
      id: extra.id,
      name: extra.name,
      category: extra.category,
      quantity: extra.quantity,
      unit: extra.unit,
      addedAt: generatedAt,
    },
    category: extra.category,
    checked: Boolean(checked[extra.id]),
  }));

  const estimated = lines.reduce((total, line) => total + (line.estimatedPrice ?? 0), 0);
  const pantrySaved = lines.reduce((total, line) => {
    const ingredient = getIngredient(line.ingredientId);
    return total + (ingredient ? line.pantryUsed * ingredient.pricePerBase : 0);
  }, 0);

  return {
    generatedAt,
    lines,
    extras: extraLines,
    sections,
    totals: {
      estimated: Math.round(estimated * 100) / 100,
      matchedCount: lines.filter((line) => line.status === 'matched').length,
      lineCount: lines.filter((line) => line.toBuy > 0.001).length,
      pantrySaved: Math.round(pantrySaved * 100) / 100,
      extraEstimate: 0,
    },
    nutrition: planNutrition(meals),
    comparisons,
  };
}

export function matchLinesForRetailer(
  lines: GroceryLine[],
  retailerId: string,
  catalogue: Product[] = defaultProducts,
): RetailerLineMatches {
  const matches = lines
    .filter((line) => line.toBuy > 0.001)
    .map((line) => {
      const result = matchProductsForIngredient(line.ingredientId, line.toBuy, catalogue, retailerId);
      const best = result.best;
      return {
        line,
        best,
        estimatedPrice: best ? best.totalPrice : null,
      };
    });
  const total = matches.reduce((sum, entry) => sum + (entry.estimatedPrice ?? 0), 0);
  return {
    retailerId,
    lines: matches,
    total: Math.round(total * 100) / 100,
    matchedLines: matches.filter((entry) => entry.best !== null).length,
    totalLines: matches.length,
  };
}

export function shoppingListText(list: GroceryList, planName: string): string {
  const rows: string[] = [`${planName} — grocery list`, `Generated ${new Date(list.generatedAt).toLocaleString('en-IN')}`, ''];
  for (const section of list.sections) {
    rows.push(section.title.toUpperCase());
    for (const line of section.lines) {
      const price = line.estimatedPrice ? ` · est. ₹${Math.round(line.estimatedPrice)}` : '';
      rows.push(`• ${line.name} — ${formatQuantity(line.toBuyDisplay, line.toBuyUnit)}${price}`);
    }
    rows.push('');
  }
  if (list.extras.length > 0) {
    rows.push('ADDED ITEMS');
    list.extras.forEach((extra) => {
      rows.push(`• ${extra.extra.name} — ${formatQuantity(extra.extra.quantity, extra.extra.unit)}`);
    });
    rows.push('');
  }
  rows.push(
    list.totals.matchedCount > 0
      ? `Estimated total: ₹${Math.round(list.totals.estimated)}`
      : 'Estimated total: not available (no demo catalogue matches)',
  );
  rows.push('Prices are demo catalogue estimates. Confirm final prices with the retailer.');
  return rows.join('\n');
}

export function lineRetailerName(line: GroceryLine): string {
  if (!line.best) return 'Not matched';
  return retailerMap[line.best.product.retailerId]?.shortName ?? line.best.product.retailerName;
}
