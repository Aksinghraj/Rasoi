import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { recipes as curatedRecipes } from '@/lib/data/recipes';
import { addDays, startOfWeek, toISODate, uid } from '@/lib/format';
import {
  addMealToPlan,
  copyDay as copyDayInPlan,
  replaceMeal as replaceMealInPlan,
  emptyDay,
  generatePlan,
  regenerateDay as regenerateDayInPlan,
  regenerateWeek as regenerateWeekInPlan,
  removeMealFromPlan,
  updateMealServings,
} from '@/lib/engine/planner';
import {
  AppData,
  AuditEntry,
  Consents,
  CookingSession,
  ExtraItem,
  Household,
  IngredientCategory,
  MealPlan,
  MealSlot,
  NotificationSettings,
  PlannedMeal,
  OrderRecord,
  PantryItem,
  PendingOtp,
  Preferences,
  Recipe,
  Unit,
  UserProfile,
} from '@/lib/types';

const STORAGE_KEY = 'rasoi.app.v1';

export const defaultConsents: Consents = {
  analytics: false,
  personalisation: true,
  offers: false,
  retailerSharing: false,
};

export const defaultNotifications: NotificationSettings = {
  weeklyPlan: true,
  groceryReminder: true,
  pantryExpiry: true,
  cookingReminder: false,
  offers: false,
};

export const defaultPreferences: Preferences = {
  country: 'India',
  state: 'Karnataka',
  city: 'Bengaluru',
  pincode: '',
  locality: '',
  diet: 'vegetarian',
  region: 'Karnataka',
  restrictions: [],
  allergens: [],
  customExclusions: [],
  dislikes: [],
  equipment: ['gas_stove', 'mixer_grinder'],
  budget: { daily: 500, weekly: 3500, monthly: 14000 },
  mealTypes: ['breakfast', 'lunch', 'dinner', 'snack'],
  cookingTime: 'balanced',
  planDay: 'monday',
  language: 'en',
};

function createEmptyData(): AppData {
  return {
    session: null,
    user: null,
    household: null,
    preferences: null,
    pantry: [],
    autoDeductPantry: true,
    favorites: [],
    plans: [],
    activePlanId: null,
    recentRecipeIds: [],
    customRecipes: [],
    extras: [],
    checkedItems: {},
    cooking: null,
    cookingHistory: [],
    orders: [],
    notifications: defaultNotifications,
    consents: defaultConsents,
    auditLogs: [],
    verifiedRecipeIds: [],
    createdAt: new Date().toISOString(),
  };
}

export interface OnboardingPayload {
  name: string;
  household: Household;
  preferences: Preferences;
}

interface AppContextValue {
  state: AppData;
  hydrated: boolean;
  pendingOtp: PendingOtp | null;
  allRecipes: Recipe[];
  activePlan: MealPlan | null;
  requestOtp: (identifier: string, channel: 'phone' | 'email') => Promise<{ ok: boolean; error?: string; code?: string }>;
  verifyOtp: (code: string) => Promise<{ ok: boolean; error?: string }>;
  signInDemo: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  completeOnboarding: (payload: OnboardingPayload) => Promise<void>;
  updatePreferences: (patch: Partial<Preferences>) => void;
  updateHousehold: (household: Household) => void;
  updateProfile: (patch: Partial<UserProfile>) => void;
  updateNotifications: (patch: Partial<NotificationSettings>) => void;
  updateConsents: (patch: Partial<Consents>) => void;
  toggleFavorite: (recipeId: string) => void;
  recordView: (recipeId: string) => void;
  addPantryItem: (item: { ingredientId: string; quantity: number; unit: Unit; expiresOn?: string; staple?: boolean }) => void;
  updatePantryItem: (id: string, patch: Partial<PantryItem>) => void;
  removePantryItem: (id: string) => void;
  toggleAutoDeduct: () => void;
  addExtraItem: (item: { name: string; category: IngredientCategory; quantity: number; unit: Unit; note?: string }) => void;
  removeExtraItem: (id: string) => void;
  toggleChecked: (key: string) => void;
  resetChecked: () => void;
  createGeneratedPlan: (startDate?: string, name?: string) => MealPlan | null;
  setActivePlan: (planId: string) => void;
  updatePlan: (plan: MealPlan) => void;
  addRecipeToPlan: (recipeId: string, date: string, slot: MealSlot, servings: number) => MealPlan | null;
  swapMeal: (date: string, mealId: string, recipeId: string) => void;
  copyMealTo: (meal: PlannedMeal, date: string, slot: MealSlot) => void;
  createEmptyPlan: (startDate: string, name?: string) => MealPlan | null;
  removeMeal: (date: string, mealId: string) => void;
  changeMealServings: (date: string, mealId: string, servings: number) => void;
  regenerateDay: (date: string) => void;
  regenerateWeek: () => void;
  duplicateActivePlan: (startDate: string, name: string) => void;
  copyDay: (fromDate: string, toDate: string) => void;
  deletePlan: (planId: string) => void;
  startCooking: (recipeId: string, servings: number) => void;
  toggleCookingIngredient: (ingredientId: string) => void;
  setCookingStep: (step: number) => void;
  finishCooking: () => void;
  cancelCooking: () => void;
  addCustomRecipe: (recipe: Recipe) => void;
  deleteCustomRecipe: (recipeId: string) => void;
  toggleRecipeVerification: (recipeId: string) => void;
  recordOrder: (order: OrderRecord) => void;
  addAudit: (action: string, detail: string) => void;
  exportData: () => string;
}

const AppContext = createContext<AppContextValue | null>(null);

function normalizePlan(plan: MealPlan): MealPlan {
  return {
    ...plan,
    days: (plan.days ?? []).map((day) => ({
      ...day,
      meals: {
        breakfast: day.meals?.breakfast ?? [],
        lunch: day.meals?.lunch ?? [],
        dinner: day.meals?.dinner ?? [],
        snack: day.meals?.snack ?? [],
      },
    })),
  };
}

function mergeStored(stored: Partial<AppData>): AppData {
  const base = createEmptyData();
  return {
    ...base,
    ...stored,
    plans: (stored.plans ?? []).map(normalizePlan),
    notifications: { ...base.notifications, ...(stored.notifications ?? {}) },
    consents: { ...base.consents, ...(stored.consents ?? {}) },
    auditLogs: stored.auditLogs ?? [],
    verifiedRecipeIds: stored.verifiedRecipeIds ?? [],
  };
}

function demoData(): AppData {
  const base = createEmptyData();
  const now = new Date().toISOString();
  const user: UserProfile = {
    id: uid('user'),
    name: 'Aarav Mehta',
    phone: '9876543210',
    authMethod: 'demo',
    createdAt: now,
    isAdmin: true,
  };
  const household: Household = {
    adults: 2,
    children: 1,
    defaultServings: 3,
    members: [
      { id: uid('member'), name: 'Aarav', ageGroup: 'adult' },
      { id: uid('member'), name: 'Meera', ageGroup: 'adult' },
      { id: uid('member'), name: 'Kabir', ageGroup: 'child' },
    ],
  };
  const preferences: Preferences = {
    ...defaultPreferences,
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560102',
    locality: 'HSR Layout',
    diet: 'non_vegetarian',
    region: 'Karnataka',
    restrictions: ['high_protein'],
    allergens: [],
    equipment: ['gas_stove', 'pressure_cooker', 'mixer_grinder', 'rice_cooker', 'oven'],
    budget: { daily: 650, weekly: 4500, monthly: 18000 },
    cookingTime: 'balanced',
    language: 'en',
  };
  const pantry: PantryItem[] = [
    { id: uid('pantry'), ingredientId: 'rice', quantity: 2, unit: 'kg', staple: true, addedAt: now },
    { id: uid('pantry'), ingredientId: 'atta', quantity: 1, unit: 'kg', staple: true, addedAt: now },
    { id: uid('pantry'), ingredientId: 'oil', quantity: 1, unit: 'l', staple: true, addedAt: now },
    { id: uid('pantry'), ingredientId: 'salt', quantity: 500, unit: 'g', staple: true, addedAt: now },
    { id: uid('pantry'), ingredientId: 'turmeric', quantity: 100, unit: 'g', staple: true, addedAt: now },
    { id: uid('pantry'), ingredientId: 'onion', quantity: 500, unit: 'g', addedAt: now },
    { id: uid('pantry'), ingredientId: 'tomato', quantity: 500, unit: 'g', addedAt: now },
    { id: uid('pantry'), ingredientId: 'milk', quantity: 1, unit: 'l', addedAt: now },
    { id: uid('pantry'), ingredientId: 'paneer', quantity: 200, unit: 'g', addedAt: now },
    { id: uid('pantry'), ingredientId: 'toor_dal', quantity: 1, unit: 'kg', staple: true, addedAt: now },
  ];
  const plan = generatePlan({
    prefs: preferences,
    recipes: curatedRecipes,
    startDate: startOfWeek(toISODate(new Date())),
    servings: household.defaultServings,
    pantryIngredientIds: pantry.map((item) => item.ingredientId),
    name: 'My demo week',
    source: 'demo',
  });

  return {
    ...base,
    session: { userId: user.id, method: 'demo', signedInAt: now },
    user,
    household,
    preferences,
    pantry,
    favorites: ['paneer-butter-masala', 'vegetable-poha', 'home-style-chicken-curry', 'masala-khichdi'],
    plans: [plan],
    activePlanId: plan.id,
    recentRecipeIds: ['palak-paneer', 'lemon-rice', 'chana-chaat'],
    notifications: { ...defaultNotifications, cookingReminder: true },
    auditLogs: [
      { id: uid('audit'), action: 'demo_seed', detail: 'Demo household, pantry and week plan created', actor: 'demo', at: now },
    ],
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppData>(createEmptyData);
  const [hydrated, setHydrated] = useState(false);
  const [pendingOtp, setPendingOtp] = useState<PendingOtp | null>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted) return;
        if (raw) {
          try {
            setState(mergeStored(JSON.parse(raw) as Partial<AppData>));
          } catch {
            setState(createEmptyData());
          }
        }
      })
      .finally(() => {
        if (mounted) {
          setHydrated(true);
          hydratedRef.current = true;
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    const timer = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => undefined);
    }, 250);
    return () => clearTimeout(timer);
  }, [state]);

  const allRecipes = useMemo(
    () => [...state.customRecipes, ...curatedRecipes],
    [state.customRecipes],
  );

  const activePlan = useMemo(
    () => state.plans.find((plan) => plan.id === state.activePlanId) ?? state.plans[0] ?? null,
    [state.plans, state.activePlanId],
  );

  const addAudit = useCallback((action: string, detail: string) => {
    setState((prev) => {
      const entry: AuditEntry = {
        id: uid('audit'),
        action,
        detail,
        actor: prev.user?.id ?? 'anonymous',
        at: new Date().toISOString(),
      };
      return { ...prev, auditLogs: [entry, ...prev.auditLogs].slice(0, 120) };
    });
  }, []);

  const requestOtp = useCallback(
    async (identifier: string, channel: 'phone' | 'email') => {
      const trimmed = identifier.trim();
      if (channel === 'phone' && !/^[6-9][0-9]{9}$/.test(trimmed.replace(/\D/g, '').slice(-10))) {
        return { ok: false, error: 'Enter a valid 10-digit Indian mobile number.' };
      }
      if (channel === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
        return { ok: false, error: 'Enter a valid email address.' };
      }
      const code = `${Math.floor(100000 + Math.random() * 900000)}`;
      setPendingOtp({
        identifier: trimmed,
        channel,
        code,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
      return { ok: true, code };
    },
    [],
  );

  const verifyOtp = useCallback(
    async (code: string) => {
      if (!pendingOtp) return { ok: false, error: 'Request a new code first.' };
      if (Date.now() > pendingOtp.expiresAt) {
        setPendingOtp(null);
        return { ok: false, error: 'That code expired. Request a fresh one.' };
      }
      if (code.trim() !== pendingOtp.code) {
        return { ok: false, error: 'That code does not match. Check and try again.' };
      }
      const now = new Date().toISOString();
      const identifier = pendingOtp.identifier;
      const channel = pendingOtp.channel;
      setState((prev) => {
        const sameUser =
          prev.user &&
          ((channel === 'phone' && prev.user.phone === identifier.replace(/\D/g, '').slice(-10)) ||
            (channel === 'email' && prev.user.email === identifier));
        if (sameUser && prev.user) {
          return {
            ...prev,
            session: { userId: prev.user.id, method: channel, signedInAt: now },
            user: { ...prev.user, authMethod: channel },
          };
        }
        const user: UserProfile = {
          id: uid('user'),
          name: channel === 'email' ? identifier.split('@')[0].replace(/[._-]/g, ' ') : 'Rasoi cook',
          phone: channel === 'phone' ? identifier.replace(/\D/g, '').slice(-10) : undefined,
          email: channel === 'email' ? identifier : undefined,
          authMethod: channel,
          createdAt: now,
          isAdmin: true,
        };
        const fresh = createEmptyData();
        return {
          ...fresh,
          user,
          session: { userId: user.id, method: channel, signedInAt: now },
          auditLogs: [
            {
              id: uid('audit'),
              action: 'sign_in',
              detail: `Signed in with ${channel}`,
              actor: user.id,
              at: now,
            },
          ],
        };
      });
      setPendingOtp(null);
      return { ok: true };
    },
    [pendingOtp],
  );

  const signInDemo = useCallback(async () => {
    setState(demoData());
    setPendingOtp(null);
  }, []);

  const signOut = useCallback(async () => {
    setState((prev) => ({ ...prev, session: null, cooking: null }));
    setPendingOtp(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setState(createEmptyData());
    setPendingOtp(null);
  }, []);

  const completeOnboarding = useCallback(async (payload: OnboardingPayload) => {
    setState((prev) => {
      if (!prev.session || !prev.user) return prev;
      const plan = generatePlan({
        prefs: payload.preferences,
        recipes: curatedRecipes,
        startDate: startOfWeek(toISODate(new Date())),
        servings: payload.household.defaultServings,
        name: 'My first week',
      });
      const now = new Date().toISOString();
      return {
        ...prev,
        user: { ...prev.user, name: payload.name.trim() || prev.user.name },
        household: payload.household,
        preferences: payload.preferences,
        plans: [plan],
        activePlanId: plan.id,
        auditLogs: [
          {
            id: uid('audit'),
            action: 'onboarding_complete',
            detail: 'Household, preferences and first week plan created',
            actor: prev.user.id,
            at: now,
          },
          ...prev.auditLogs,
        ],
      };
    });
  }, []);

  const updatePreferences = useCallback((patch: Partial<Preferences>) => {
    setState((prev) =>
      prev.preferences
        ? {
            ...prev,
            preferences: {
              ...prev.preferences,
              ...patch,
              budget: { ...prev.preferences.budget, ...(patch.budget ?? {}) },
            },
          }
        : prev,
    );
  }, []);

  const updateHousehold = useCallback((household: Household) => {
    setState((prev) => ({ ...prev, household }));
  }, []);

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setState((prev) => (prev.user ? { ...prev, user: { ...prev.user, ...patch } } : prev));
  }, []);

  const updateNotifications = useCallback((patch: Partial<NotificationSettings>) => {
    setState((prev) => ({ ...prev, notifications: { ...prev.notifications, ...patch } }));
  }, []);

  const updateConsents = useCallback((patch: Partial<Consents>) => {
    setState((prev) => ({ ...prev, consents: { ...prev.consents, ...patch } }));
  }, []);

  const toggleFavorite = useCallback((recipeId: string) => {
    setState((prev) => ({
      ...prev,
      favorites: prev.favorites.includes(recipeId)
        ? prev.favorites.filter((id) => id !== recipeId)
        : [recipeId, ...prev.favorites],
    }));
  }, []);

  const recordView = useCallback((recipeId: string) => {
    setState((prev) => ({
      ...prev,
      recentRecipeIds: [recipeId, ...prev.recentRecipeIds.filter((id) => id !== recipeId)].slice(0, 12),
    }));
  }, []);

  const addPantryItem = useCallback(
    (item: { ingredientId: string; quantity: number; unit: Unit; expiresOn?: string; staple?: boolean }) => {
      setState((prev) => ({
        ...prev,
        pantry: [
          {
            id: uid('pantry'),
            ingredientId: item.ingredientId,
            quantity: item.quantity,
            unit: item.unit,
            expiresOn: item.expiresOn,
            staple: item.staple,
            addedAt: new Date().toISOString(),
          },
          ...prev.pantry,
        ],
      }));
    },
    [],
  );

  const updatePantryItem = useCallback((id: string, patch: Partial<PantryItem>) => {
    setState((prev) => ({
      ...prev,
      pantry: prev.pantry.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }, []);

  const removePantryItem = useCallback((id: string) => {
    setState((prev) => ({ ...prev, pantry: prev.pantry.filter((item) => item.id !== id) }));
  }, []);

  const toggleAutoDeduct = useCallback(() => {
    setState((prev) => ({ ...prev, autoDeductPantry: !prev.autoDeductPantry }));
  }, []);

  const addExtraItem = useCallback(
    (item: { name: string; category: IngredientCategory; quantity: number; unit: Unit; note?: string }) => {
      setState((prev) => ({
        ...prev,
        extras: [
          {
            id: uid('extra'),
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            unit: item.unit,
            note: item.note,
            addedAt: new Date().toISOString(),
          },
          ...prev.extras,
        ],
      }));
    },
    [],
  );

  const removeExtraItem = useCallback((id: string) => {
    setState((prev) => {
      const checked = { ...prev.checkedItems };
      delete checked[id];
      return { ...prev, extras: prev.extras.filter((item) => item.id !== id), checkedItems: checked };
    });
  }, []);

  const toggleChecked = useCallback((key: string) => {
    setState((prev) => ({
      ...prev,
      checkedItems: { ...prev.checkedItems, [key]: !prev.checkedItems[key] },
    }));
  }, []);

  const resetChecked = useCallback(() => {
    setState((prev) => ({ ...prev, checkedItems: {} }));
  }, []);

  const createGeneratedPlan = useCallback(
    (startDate?: string, name?: string) => {
      if (!state.preferences || !state.household) return null;
      const plan = generatePlan({
        prefs: state.preferences,
        recipes: allRecipes,
        startDate: startDate ?? startOfWeek(toISODate(new Date())),
        servings: state.household.defaultServings,
        recentRecipeIds: state.recentRecipeIds,
        pantryIngredientIds: state.pantry.map((item) => item.ingredientId),
        name,
      });
      setState((prev) => ({
        ...prev,
        plans: [plan, ...prev.plans],
        activePlanId: plan.id,
        auditLogs: [
          {
            id: uid('audit'),
            action: 'plan_generated',
            detail: `Generated ${plan.name}`,
            actor: prev.user?.id ?? 'anonymous',
            at: new Date().toISOString(),
          },
          ...prev.auditLogs,
        ].slice(0, 120),
      }));
      return plan;
    },
    [state.preferences, state.household, state.recentRecipeIds, state.pantry, allRecipes],
  );

  const setActivePlan = useCallback((planId: string) => {
    setState((prev) => ({ ...prev, activePlanId: planId }));
  }, []);

  const updatePlan = useCallback((plan: MealPlan) => {
    setState((prev) => ({
      ...prev,
      plans: prev.plans.map((item) => (item.id === plan.id ? plan : item)),
    }));
  }, []);

  const addRecipeToPlan = useCallback(
    (recipeId: string, date: string, slot: MealSlot, servings: number) => {
      if (!state.preferences || !state.household) return null;
      let target = state.plans.find((plan) => plan.days.some((day) => day.date === date));
      if (!target) {
        target = {
          id: uid('plan'),
          name: `Week of ${date}`,
          startDate: startOfWeek(date),
          days: Array.from({ length: 7 }, (_, index) => emptyDay(addDays(startOfWeek(date), index))),
          createdAt: new Date().toISOString(),
          source: 'manual',
        };
      }
      const updated = addMealToPlan(target, date, slot, recipeId, servings);
      setState((prev) => ({
        ...prev,
        plans: prev.plans.some((plan) => plan.id === updated.id)
          ? prev.plans.map((plan) => (plan.id === updated.id ? updated : plan))
          : [updated, ...prev.plans],
        activePlanId: updated.id,
      }));
      return updated;
    },
    [state.preferences, state.household, state.plans],
  );

  const mutateActivePlan = useCallback(
    (mutator: (plan: MealPlan) => MealPlan) => {
      setState((prev) => {
        const current = prev.plans.find((plan) => plan.id === prev.activePlanId) ?? prev.plans[0];
        if (!current) return prev;
        const next = mutator(current);
        return { ...prev, plans: prev.plans.map((plan) => (plan.id === next.id ? next : plan)) };
      });
    },
    [],
  );

  const swapMeal = useCallback(
    (date: string, mealId: string, recipeId: string) =>
      mutateActivePlan((plan) => replaceMealInPlan(plan, date, mealId, recipeId)),
    [mutateActivePlan],
  );

  const copyMealTo = useCallback(
    (meal: PlannedMeal, date: string, slot: MealSlot) =>
      mutateActivePlan((plan) => addMealToPlan(plan, date, slot, meal.recipeId, meal.servings)),
    [mutateActivePlan],
  );

  const createEmptyPlan = useCallback(
    (startDate: string, name?: string) => {
      if (!state.preferences) return null;
      const plan: MealPlan = {
        id: uid('plan'),
        name: name ?? `Week of ${startDate}`,
        startDate,
        days: Array.from({ length: 7 }, (_, index) => emptyDay(addDays(startDate, index))),
        createdAt: new Date().toISOString(),
        source: 'manual',
      };
      setState((prev) => ({ ...prev, plans: [plan, ...prev.plans], activePlanId: plan.id }));
      return plan;
    },
    [state.preferences],
  );

  const removeMeal = useCallback(
    (date: string, mealId: string) => mutateActivePlan((plan) => removeMealFromPlan(plan, date, mealId)),
    [mutateActivePlan],
  );

  const changeMealServings = useCallback(
    (date: string, mealId: string, servings: number) =>
      mutateActivePlan((plan) => updateMealServings(plan, date, mealId, servings)),
    [mutateActivePlan],
  );

  const regenerateDay = useCallback(
    (date: string) => {
      if (!state.preferences) return;
      mutateActivePlan((plan) =>
        regenerateDayInPlan(plan, date, {
          prefs: state.preferences as Preferences,
          recipes: allRecipes,
          servings: state.household?.defaultServings ?? 2,
          recentRecipeIds: state.recentRecipeIds,
          pantryIngredientIds: state.pantry.map((item) => item.ingredientId),
        }),
      );
    },
    [state.preferences, state.household, state.recentRecipeIds, state.pantry, allRecipes, mutateActivePlan],
  );

  const regenerateWeek = useCallback(() => {
    if (!state.preferences) return;
    mutateActivePlan((plan) =>
      regenerateWeekInPlan(plan, {
        prefs: state.preferences as Preferences,
        recipes: allRecipes,
        servings: state.household?.defaultServings ?? 2,
        recentRecipeIds: state.recentRecipeIds,
        pantryIngredientIds: state.pantry.map((item) => item.ingredientId),
      }),
    );
  }, [state.preferences, state.household, state.recentRecipeIds, state.pantry, allRecipes, mutateActivePlan]);

  const duplicateActivePlan = useCallback(
    (startDate: string, name: string) => {
      setState((prev) => {
        const current = prev.plans.find((plan) => plan.id === prev.activePlanId) ?? prev.plans[0];
        if (!current) return prev;
        const offset = Math.round(
          (new Date(startDate).getTime() - new Date(current.startDate).getTime()) / 86400000,
        );
        const copy: MealPlan = {
          ...current,
          id: uid('plan'),
          name,
          startDate,
          createdAt: new Date().toISOString(),
          source: 'manual',
          days: current.days.map((day) => ({
            ...day,
            date: addDays(day.date, offset),
            meals: {
              breakfast: day.meals.breakfast.map((meal) => ({ ...meal, id: uid('meal') })),
              lunch: day.meals.lunch.map((meal) => ({ ...meal, id: uid('meal') })),
              dinner: day.meals.dinner.map((meal) => ({ ...meal, id: uid('meal') })),
              snack: day.meals.snack.map((meal) => ({ ...meal, id: uid('meal') })),
            },
          })),
        };
        return { ...prev, plans: [copy, ...prev.plans], activePlanId: copy.id };
      });
    },
    [],
  );

  const copyDay = useCallback(
    (fromDate: string, toDate: string) => mutateActivePlan((plan) => copyDayInPlan(plan, fromDate, toDate)),
    [mutateActivePlan],
  );

  const deletePlan = useCallback((planId: string) => {
    setState((prev) => {
      const plans = prev.plans.filter((plan) => plan.id !== planId);
      return {
        ...prev,
        plans,
        activePlanId: prev.activePlanId === planId ? (plans[0]?.id ?? null) : prev.activePlanId,
      };
    });
  }, []);

  const startCooking = useCallback((recipeId: string, servings: number) => {
    const session: CookingSession = {
      recipeId,
      servings,
      stepIndex: 0,
      startedAt: new Date().toISOString(),
      checkedIngredients: [],
    };
    setState((prev) => ({
      ...prev,
      cooking: session,
      recentRecipeIds: [recipeId, ...prev.recentRecipeIds.filter((id) => id !== recipeId)].slice(0, 12),
    }));
  }, []);

  const toggleCookingIngredient = useCallback((ingredientId: string) => {
    setState((prev) => {
      if (!prev.cooking) return prev;
      const checked = prev.cooking.checkedIngredients.includes(ingredientId)
        ? prev.cooking.checkedIngredients.filter((id) => id !== ingredientId)
        : [...prev.cooking.checkedIngredients, ingredientId];
      return { ...prev, cooking: { ...prev.cooking, checkedIngredients: checked } };
    });
  }, []);

  const setCookingStep = useCallback((step: number) => {
    setState((prev) =>
      prev.cooking ? { ...prev, cooking: { ...prev.cooking, stepIndex: Math.max(0, step) } } : prev,
    );
  }, []);

  const finishCooking = useCallback(() => {
    setState((prev) => {
      if (!prev.cooking) return prev;
      return {
        ...prev,
        cookingHistory: [
          { recipeId: prev.cooking.recipeId, completedAt: new Date().toISOString() },
          ...prev.cookingHistory,
        ].slice(0, 30),
        cooking: null,
      };
    });
  }, []);

  const cancelCooking = useCallback(() => {
    setState((prev) => ({ ...prev, cooking: null }));
  }, []);

  const addCustomRecipe = useCallback((recipe: Recipe) => {
    setState((prev) => ({ ...prev, customRecipes: [recipe, ...prev.customRecipes] }));
  }, []);

  const deleteCustomRecipe = useCallback((recipeId: string) => {
    setState((prev) => ({
      ...prev,
      customRecipes: prev.customRecipes.filter((recipe) => recipe.id !== recipeId),
      favorites: prev.favorites.filter((id) => id !== recipeId),
    }));
  }, []);

  const toggleRecipeVerification = useCallback((recipeId: string) => {
    setState((prev) => ({
      ...prev,
      verifiedRecipeIds: prev.verifiedRecipeIds.includes(recipeId)
        ? prev.verifiedRecipeIds.filter((id) => id !== recipeId)
        : [recipeId, ...prev.verifiedRecipeIds],
    }));
  }, []);

  const recordOrder = useCallback((order: OrderRecord) => {
    setState((prev) => ({ ...prev, orders: [order, ...prev.orders].slice(0, 50) }));
  }, []);

  const exportData = useCallback(() => JSON.stringify(state, null, 2), [state]);

  const value: AppContextValue = {
    state,
    hydrated,
    pendingOtp,
    allRecipes,
    activePlan,
    requestOtp,
    verifyOtp,
    signInDemo,
    signOut,
    deleteAccount,
    completeOnboarding,
    updatePreferences,
    updateHousehold,
    updateProfile,
    updateNotifications,
    updateConsents,
    toggleFavorite,
    recordView,
    addPantryItem,
    updatePantryItem,
    removePantryItem,
    toggleAutoDeduct,
    addExtraItem,
    removeExtraItem,
    toggleChecked,
    resetChecked,
    createGeneratedPlan,
    setActivePlan,
    updatePlan,
    addRecipeToPlan,
    swapMeal,
    copyMealTo,
    createEmptyPlan,
    removeMeal,
    changeMealServings,
    regenerateDay,
    regenerateWeek,
    duplicateActivePlan,
    copyDay,
    deletePlan,
    startCooking,
    toggleCookingIngredient,
    setCookingStep,
    finishCooking,
    cancelCooking,
    addCustomRecipe,
    deleteCustomRecipe,
    toggleRecipeVerification,
    recordOrder,
    addAudit,
    exportData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}
