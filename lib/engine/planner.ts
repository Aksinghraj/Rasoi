import { addDays, formatDay, isValidISODate, startOfWeek, toISODate, uid } from '@/lib/format';
import { recommendRecipes } from '@/lib/engine/recommendation';
import {
  MealPlan,
  MealSlot,
  PlannedMeal,
  PlanDay,
  Preferences,
  Recipe,
} from '@/lib/types';

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export interface GeneratePlanOptions {
  prefs: Preferences;
  recipes: Recipe[];
  startDate?: string;
  servings?: number;
  recentRecipeIds?: string[];
  pantryIngredientIds?: string[];
  name?: string;
  source?: MealPlan['source'];
}

export function emptyDay(date: string): PlanDay {
  return {
    date,
    meals: { breakfast: [], lunch: [], dinner: [], snack: [] },
  };
}

export function generatePlan(options: GeneratePlanOptions): MealPlan {
  const {
    prefs,
    recipes,
    servings = 2,
    recentRecipeIds = [],
    pantryIngredientIds = [],
    source = 'generated',
  } = options;
  const startDate = options.startDate ?? startOfWeek(toISODate(new Date()));
  const selectedSlots = prefs.mealTypes.length > 0 ? prefs.mealTypes : SLOTS;
  const used: string[] = [];
  const days: PlanDay[] = [];

  for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    const date = addDays(startDate, dayIndex);
    const day = emptyDay(date);
    for (const slot of selectedSlots) {
      const exclude = [...recentRecipeIds, ...used];
      const candidates = recommendRecipes(
        { prefs, recipes, recentRecipeIds: exclude, pantryIngredientIds },
        { mealType: slot },
        8,
      ).filter((entry) => !exclude.includes(entry.recipe.id));
      const pick = candidates[0]?.recipe ?? null;
      if (pick) {
        day.meals[slot].push({ id: uid('meal'), recipeId: pick.id, servings });
        used.push(pick.id);
      }
    }
    days.push(day);
  }

  return {
    id: uid('plan'),
    name: options.name ?? `Week of ${formatDay(startDate)}`,
    startDate,
    days,
    createdAt: new Date().toISOString(),
    source,
  };
}

export function regenerateWeek(plan: MealPlan, options: GeneratePlanOptions): MealPlan {
  const next = generatePlan({
    ...options,
    startDate: plan.startDate,
    name: plan.name,
    source: 'generated',
  });
  return { ...next, id: plan.id, createdAt: plan.createdAt };
}

export function regenerateDay(
  plan: MealPlan,
  date: string,
  options: Omit<GeneratePlanOptions, 'startDate'>,
): MealPlan {
  const selectedSlots = options.prefs.mealTypes.length > 0 ? options.prefs.mealTypes : SLOTS;
  const otherRecipes = plan.days
    .filter((day) => day.date !== date)
    .flatMap((day) => Object.values(day.meals).flat().map((meal) => meal.recipeId));
  const used: string[] = [];
  const day = emptyDay(date);
  for (const slot of selectedSlots) {
    const exclude = [...otherRecipes, ...(options.recentRecipeIds ?? []), ...used];
    const candidates = recommendRecipes(
      {
        prefs: options.prefs,
        recipes: options.recipes,
        recentRecipeIds: exclude,
        pantryIngredientIds: options.pantryIngredientIds ?? [],
      },
      { mealType: slot },
      8,
    ).filter((entry) => !exclude.includes(entry.recipe.id));
    const pick = candidates[0]?.recipe ?? null;
    if (pick) {
      day.meals[slot].push({
        id: uid('meal'),
        recipeId: pick.id,
        servings: options.servings ?? 2,
      });
      used.push(pick.id);
    }
  }
  return { ...plan, days: plan.days.map((item) => (item.date === date ? day : item)) };
}

export function addMealToPlan(
  plan: MealPlan,
  date: string,
  slot: MealSlot,
  recipeId: string,
  servings: number,
): MealPlan {
  const existingDay = plan.days.find((day) => day.date === date) ?? emptyDay(date);
  const nextDay: PlanDay = {
    ...existingDay,
    meals: {
      ...existingDay.meals,
      [slot]: [...existingDay.meals[slot], { id: uid('meal'), recipeId, servings }],
    },
  };
  const days = plan.days.some((day) => day.date === date)
    ? plan.days.map((day) => (day.date === date ? nextDay : day))
    : [...plan.days, nextDay].sort((a, b) => a.date.localeCompare(b.date));
  return { ...plan, days };
}

export function removeMealFromPlan(plan: MealPlan, date: string, mealId: string): MealPlan {
  return {
    ...plan,
    days: plan.days.map((day) =>
      day.date === date
        ? {
            ...day,
            meals: {
              breakfast: day.meals.breakfast.filter((meal) => meal.id !== mealId),
              lunch: day.meals.lunch.filter((meal) => meal.id !== mealId),
              dinner: day.meals.dinner.filter((meal) => meal.id !== mealId),
              snack: day.meals.snack.filter((meal) => meal.id !== mealId),
            },
          }
        : day,
    ),
  };
}

export function replaceMeal(
  plan: MealPlan,
  date: string,
  mealId: string,
  recipeId: string,
): MealPlan {
  return {
    ...plan,
    days: plan.days.map((day) =>
      day.date === date
        ? {
            ...day,
            meals: mapSlots(day.meals, (meals) =>
              meals.map((meal) => (meal.id === mealId ? { ...meal, recipeId } : meal)),
            ),
          }
        : day,
    ),
  };
}

export function updateMealServings(
  plan: MealPlan,
  date: string,
  mealId: string,
  servings: number,
): MealPlan {
  const safeServings = Math.max(1, Math.min(20, Math.round(servings)));
  return {
    ...plan,
    days: plan.days.map((day) =>
      day.date === date
        ? {
            ...day,
            meals: mapSlots(day.meals, (meals) =>
              meals.map((meal) => (meal.id === mealId ? { ...meal, servings: safeServings } : meal)),
            ),
          }
        : day,
    ),
  };
}

export function copyDay(plan: MealPlan, fromDate: string, toDate: string): MealPlan {
  const source = plan.days.find((day) => day.date === fromDate);
  if (!source) return plan;
  const target = plan.days.find((day) => day.date === toDate) ?? emptyDay(toDate);
  const copied: PlanDay = {
    date: toDate,
    meals: mapSlots(source.meals, (meals) =>
      meals.map((meal) => ({ ...meal, id: uid('meal') })),
    ),
  };
  const days = plan.days.some((day) => day.date === toDate)
    ? plan.days.map((day) => (day.date === toDate ? { ...target, meals: copied.meals } : day))
    : [...plan.days, copied].sort((a, b) => a.date.localeCompare(b.date));
  return { ...plan, days };
}

export function copyMeal(plan: MealPlan, meal: PlannedMeal, toDate: string, toSlot: MealSlot): MealPlan {
  return addMealToPlan(plan, toDate, toSlot, meal.recipeId, meal.servings);
}

export function duplicatePlan(plan: MealPlan, startDate: string, name: string): MealPlan {
  if (!isValidISODate(startDate) || !isValidISODate(plan.startDate)) return plan;
  const offsetDays = Math.round(
    (new Date(startDate).getTime() - new Date(plan.startDate).getTime()) / 86400000,
  );
  if (!Number.isFinite(offsetDays)) return plan;
  return {
    ...plan,
    id: uid('plan'),
    name,
    startDate,
    createdAt: new Date().toISOString(),
    source: 'manual',
    days: plan.days.map((day) => ({
      date: addDays(day.date, offsetDays),
      meals: mapSlots(day.meals, (meals) => meals.map((meal) => ({ ...meal, id: uid('meal') }))),
    })),
  };
}

export function planCost(plan: MealPlan, recipes: Recipe[]): { total: number; perServing: number; servings: number } {
  const index = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  let total = 0;
  let servings = 0;
  for (const day of plan.days) {
    for (const meals of Object.values(day.meals)) {
      for (const meal of meals) {
        const recipe = index.get(meal.recipeId);
        if (!recipe) continue;
        total += recipe.costPerServing * meal.servings;
        servings += meal.servings;
      }
    }
  }
  return {
    total: Math.round(total),
    perServing: servings > 0 ? Math.round((total / servings) * 10) / 10 : 0,
    servings,
  };
}

export function planBudgetStatus(plan: MealPlan, recipes: Recipe[], prefs: Preferences) {
  const { total } = planCost(plan, recipes);
  const weekly = prefs.budget.weekly;
  const ratio = weekly > 0 ? total / weekly : 0;
  return {
    total,
    weekly,
    ratio,
    overBudget: weekly > 0 && total > weekly,
    remaining: Math.max(0, weekly - total),
    label:
      weekly <= 0
        ? 'No weekly budget set'
        : ratio > 1
          ? `₹${Math.round(total - weekly)} over weekly budget`
          : `₹${Math.round(weekly - total)} left this week`,
  };
}

export function todayMeals(plan: MealPlan | undefined, date: string): PlanDay | undefined {
  return plan?.days.find((day) => day.date === date);
}

export function weekLabel(plan: MealPlan): string {
  const end = addDays(plan.startDate, 6);
  return `${formatDay(plan.startDate)} – ${formatDay(end)}`;
}

function mapSlots(
  meals: Record<MealSlot, PlannedMeal[]>,
  mapper: (meals: PlannedMeal[]) => PlannedMeal[],
): Record<MealSlot, PlannedMeal[]> {
  return {
    breakfast: mapper(meals.breakfast),
    lunch: mapper(meals.lunch),
    dinner: mapper(meals.dinner),
    snack: mapper(meals.snack),
  };
}

export { SLOTS };
