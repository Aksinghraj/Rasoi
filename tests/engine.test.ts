import { describe, expect, test } from 'bun:test';
import { ingredientMap } from '@/lib/data/ingredients';
import { buildGroceryList } from '@/lib/engine/grocery';
import { aggregateMeals, mergeRequirements } from '@/lib/engine/grocery';
import { isRecipeAllowed } from '@/lib/engine/allergens';
import { addMealToPlan, emptyDay, updateMealServings } from '@/lib/engine/planner';
import { matchProductsForIngredient } from '@/lib/data/products';
import { fromBase, toBase, displayUnitFor } from '@/lib/engine/units';
import {
  getRetailerAdapter,
  getRetailerCapabilityView,
  openRetailerHandoff,
  RetailerNotSupportedError,
} from '@/lib/retailers/adapters';
import {
  MealPlan,
  Preferences,
  Recipe,
  RecipeIngredient,
} from '@/lib/types';

const prefs = (overrides: Partial<Preferences> = {}): Preferences => ({
  country: 'India',
  state: 'Karnataka',
  city: 'Bengaluru',
  pincode: '560102',
  locality: 'HSR Layout',
  diet: 'vegetarian',
  region: 'Karnataka',
  restrictions: [],
  allergens: [],
  customExclusions: [],
  dislikes: [],
  equipment: ['gas_stove', 'mixer_grinder'],
  budget: { daily: 500, weekly: 3500, monthly: 14000 },
  mealTypes: ['breakfast', 'lunch', 'dinner'],
  cookingTime: 'balanced',
  planDay: 'monday',
  language: 'en',
  ...overrides,
});

const recipe = (
  id: string,
  ingredients: RecipeIngredient[],
  overrides: Partial<Recipe> = {},
): Recipe => ({
  id,
  name: id,
  description: '',
  cuisine: 'Indian',
  region: 'Karnataka',
  mealTypes: ['dinner'],
  dietTypes: ['vegetarian'],
  foodType: 'veg',
  image: '',
  prepMinutes: 5,
  cookMinutes: 15,
  difficulty: 'easy',
  baseServings: 2,
  ingredients,
  steps: [{ text: 'Cook until done.' }],
  nutrition: { calories: 300, protein: 15, carbs: 30, fat: 10 },
  tags: [],
  equipment: ['gas_stove'],
  season: 'all',
  costPerServing: 50,
  verified: true,
  ...overrides,
});

const paneer = (quantity: number): RecipeIngredient => ({
  ingredientId: 'paneer',
  quantity,
  unit: 'g',
});

function planWith(recipeId: string, servings = 2, date = '2026-11-20'): MealPlan {
  const base: MealPlan = {
    id: 'plan_test',
    name: 'Test week',
    startDate: date,
    days: [emptyDay(date)],
    createdAt: new Date().toISOString(),
    source: 'manual',
  };
  return addMealToPlan(base, date, 'dinner', recipeId, servings);
}

describe('unit conversion', () => {
  test('converts weight units to grams', () => {
    expect(toBase(1, 'kg', ingredientMap.rice)).toBe(1000);
    expect(toBase(500, 'g', ingredientMap.rice)).toBe(500);
  });

  test('converts volume units to millilitres', () => {
    expect(toBase(1, 'l', ingredientMap.milk)).toBe(1000);
    expect(toBase(240, 'ml', ingredientMap.milk)).toBe(240);
  });

  test('converts piece weights back into pieces', () => {
    expect(toBase(2, 'piece', ingredientMap.egg)).toBe(2);
    expect(toBase(100, 'g', ingredientMap.egg)).toBe(2);
  });

  test('converts tablespoons with density for weight ingredients', () => {
    expect(toBase(1, 'tbsp', ingredientMap.rice)).toBeCloseTo(15 * 0.85, 2);
  });

  test('round-trips a canonical quantity', () => {
    const ingredient = ingredientMap.paneer;
    const unit = displayUnitFor(ingredient, 1450);
    expect(unit).toBe('kg');
    expect(fromBase(1450, ingredient, unit)).toBeCloseTo(1.45, 5);
  });

  test('rejects converting pieces when no piece weight exists', () => {
    expect(() => toBase(1, 'piece', ingredientMap.rice)).toThrow();
  });
});

describe('ingredient aggregation', () => {
  test('merges the same ingredient across recipes', () => {
    const requirements = aggregateMeals([
      { recipe: recipe('a', [paneer(200)]), servings: 2 },
      { recipe: recipe('b', [paneer(250)]), servings: 2 },
    ]);
    const merged = mergeRequirements(requirements);
    const paneerLine = merged.find((item) => item.ingredientId === 'paneer');
    expect(paneerLine?.requiredBase).toBe(450);
    expect(paneerLine?.sources).toHaveLength(2);
  });

  test('scales quantities by servings', () => {
    const requirements = aggregateMeals([{ recipe: recipe('a', [paneer(200)]), servings: 4 }]);
    expect(requirements[0].requiredBase).toBe(400);
  });

  test('ignores optional ingredients', () => {
    const requirements = aggregateMeals([
      { recipe: recipe('a', [{ ingredientId: 'paneer', quantity: 200, unit: 'g', optional: true }]), servings: 2 },
    ]);
    expect(requirements).toHaveLength(0);
  });
});

describe('grocery list', () => {
  test('deducts pantry stock before buying', () => {
    const plan = planWith('paneer-dish');
    const list = buildGroceryList({
      plan,
      recipes: [recipe('paneer-dish', [paneer(450)])],
      pantry: [
        {
          id: 'p1',
          ingredientId: 'paneer',
          quantity: 200,
          unit: 'g',
          addedAt: new Date().toISOString(),
        },
      ],
      autoDeduct: true,
      extras: [],
      checked: {},
    });
    const line = list.lines.find((item) => item.ingredientId === 'paneer');
    expect(line?.requiredBase).toBe(450);
    expect(line?.pantryUsed).toBe(200);
    expect(line?.toBuy).toBe(250);
  });

  test('marks a fully covered line as pantry covered', () => {
    const plan = planWith('paneer-dish');
    const list = buildGroceryList({
      plan,
      recipes: [recipe('paneer-dish', [paneer(200)])],
      pantry: [
        {
          id: 'p1',
          ingredientId: 'paneer',
          quantity: 500,
          unit: 'g',
          addedAt: new Date().toISOString(),
        },
      ],
      autoDeduct: true,
      extras: [],
      checked: {},
    });
    const line = list.lines.find((item) => item.ingredientId === 'paneer');
    expect(line?.toBuy).toBe(0);
    expect(line?.status).toBe('pantry_covered');
  });

  test('does not deduct pantry when auto-deduct is off', () => {
    const plan = planWith('paneer-dish');
    const list = buildGroceryList({
      plan,
      recipes: [recipe('paneer-dish', [paneer(450)])],
      pantry: [
        {
          id: 'p1',
          ingredientId: 'paneer',
          quantity: 200,
          unit: 'g',
          addedAt: new Date().toISOString(),
        },
      ],
      autoDeduct: false,
      extras: [],
      checked: {},
    });
    const line = list.lines.find((item) => item.ingredientId === 'paneer');
    expect(line?.pantryUsed).toBe(0);
    expect(line?.toBuy).toBe(450);
  });
});

describe('pack optimisation', () => {
  test('never buys less than the required quantity', () => {
    const match = matchProductsForIngredient('paneer', 450);
    expect(match.best).not.toBeNull();
    expect(match.best!.totalQuantity).toBeGreaterThanOrEqual(450);
    expect(match.best!.totalPrice).toBeGreaterThan(0);
    expect(match.best!.packs).toBeGreaterThanOrEqual(1);
  });

  test('offers retailer alternatives', () => {
    const match = matchProductsForIngredient('paneer', 450);
    expect(match.byRetailer.length).toBeGreaterThan(0);
  });
});

describe('allergen and diet safety', () => {
  const dairyRecipe = recipe('dairy', [paneer(200)]);

  test('excludes recipes containing a declared allergen', () => {
    expect(isRecipeAllowed(dairyRecipe, prefs({ allergens: ['milk'] }))).toBe(false);
  });

  test('allows the same recipe when the allergen is not declared', () => {
    expect(isRecipeAllowed(dairyRecipe, prefs())).toBe(true);
  });

  test('enforces vegan diet against a vegetarian recipe', () => {
    expect(isRecipeAllowed(dairyRecipe, prefs({ diet: 'vegan' }))).toBe(false);
  });

  test('treats custom exclusions as hard blocks', () => {
    expect(isRecipeAllowed(dairyRecipe, prefs({ customExclusions: ['paneer'] }))).toBe(false);
  });

  test('respects dairy-free restriction', () => {
    expect(isRecipeAllowed(dairyRecipe, prefs({ restrictions: ['dairy_free'] }))).toBe(false);
  });
});

describe('planner', () => {
  test('adds a meal with the requested servings', () => {
    const plan = planWith('r1', 3);
    expect(plan.days[0].meals.dinner[0].servings).toBe(3);
  });

  test('updates servings without changing the recipe', () => {
    const plan = planWith('r1', 3);
    const meal = plan.days[0].meals.dinner[0];
    const updated = updateMealServings(plan, plan.days[0].date, meal.id, 5);
    expect(updated.days[0].meals.dinner[0].servings).toBe(5);
    expect(updated.days[0].meals.dinner[0].recipeId).toBe('r1');
  });
});

describe('retailer adapters', () => {
  test('deep-link retailer refuses to create a cart', async () => {
    const adapter = getRetailerAdapter('bigbasket');
    await expect(
      adapter.createCart([{ ingredientId: 'paneer', name: 'Paneer', quantityBase: 450, display: '450 g' }]),
    ).rejects.toThrow(RetailerNotSupportedError);
  });

  test('deep-link retailer refuses live pricing', async () => {
    const adapter = getRetailerAdapter('blinkit');
    await expect(adapter.getPricing('anything')).rejects.toThrow(RetailerNotSupportedError);
  });

  test('sandbox retailer creates a cart and labels it as sandbox', async () => {
    const adapter = getRetailerAdapter('rasoi_market');
    const cart = await adapter.createCart([
      { ingredientId: 'paneer', name: 'Paneer', quantityBase: 450, display: '450 g' },
    ]);
    expect(cart.status).toBe('sandbox_created');
    expect(cart.ok).toBe(true);
    expect(cart.note.toLowerCase()).toContain('nothing was ordered');
  });

  test('sandbox checkout never claims a real order', async () => {
    const adapter = getRetailerAdapter('rasoi_market');
    const cart = await adapter.createCart([
      { ingredientId: 'paneer', name: 'Paneer', quantityBase: 450, display: '450 g' },
    ]);
    const checkout = await adapter.initiateCheckout(cart.cartId!);
    expect(checkout.ok).toBe(true);
    expect(checkout.note.toLowerCase()).toContain('no payment');
    expect(checkout.note.toLowerCase()).toContain('no real order');
  });

  test('capability views never claim live prices, stock or cart access', () => {
    const deepLink = getRetailerCapabilityView('bigbasket');
    expect(deepLink.deepLink).toBe(true);
    expect(deepLink.sandboxCart).toBe(false);
    expect(deepLink.livePricing).toBe(false);
    expect(deepLink.liveInventory).toBe(false);
    expect(deepLink.confirmedServiceability).toBe(false);
    expect(deepLink.authorisedCartInsertion).toBe(false);
    expect(deepLink.authorisedCheckout).toBe(false);

    const sandbox = getRetailerCapabilityView('rasoi_market');
    expect(sandbox.sandboxCart).toBe(true);
    expect(sandbox.livePricing).toBe(false);
    expect(sandbox.authorisedCheckout).toBe(false);
  });

  test('hand-off opens the deep link and says nothing was added to a cart', async () => {
    const opened: string[] = [];
    const result = await openRetailerHandoff(getRetailerAdapter('bigbasket'), 'paneer', {
      canOpen: async () => true,
      open: async (url) => {
        opened.push(url);
      },
    });
    expect(result.ok).toBe(true);
    expect(result.usedFallback).toBe(false);
    expect(opened[0]).toContain('bigbasket.com');
    expect(result.note.toLowerCase()).toContain('nothing was added');
  });

  test('hand-off falls back to the public store page when the deep link fails', async () => {
    const opened: string[] = [];
    const result = await openRetailerHandoff(getRetailerAdapter('blinkit'), 'paneer', {
      canOpen: async () => false,
      open: async (url) => {
        opened.push(url);
      },
    });
    expect(result.ok).toBe(true);
    expect(result.usedFallback).toBe(true);
    expect(opened[0]).toContain('blinkit.com');
    expect(result.note.toLowerCase()).toContain('nothing was added');
  });

  test('hand-off failure is reported without claiming a cart change', async () => {
    const result = await openRetailerHandoff(getRetailerAdapter('zepto'), 'paneer', {
      canOpen: async () => false,
      open: async () => {
        throw new Error('no app');
      },
    });
    expect(result.ok).toBe(false);
    expect(result.url).toBeNull();
    expect(result.note.toLowerCase()).toContain('list is unchanged');
    expect(result.note.toLowerCase()).toContain('nothing was added');
  });
});
