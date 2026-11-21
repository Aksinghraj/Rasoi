import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
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
import {
  createDemoUser,
  createSelfServiceUser,
  matchesExistingAccount,
  sanitizeProfilePatch,
} from '@/lib/auth/users';
import { addDays, isValidISODate, startOfWeek, toISODate, uid } from '@/lib/format';
import { mergeExtraItem } from '@/lib/engine/grocery';
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
  RecipeIngredient,
  RecipeStep,
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

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asObject<T extends object>(value: unknown): Partial<T> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Partial<T>) : {};
}

function normalizePlannedMeals(value: unknown): PlannedMeal[] {
  return asArray<PlannedMeal>(value)
    .filter(
      (meal) =>
        meal &&
        typeof meal.id === 'string' &&
        typeof meal.recipeId === 'string' &&
        Number.isFinite(meal.servings) &&
        meal.servings > 0,
    )
    .map((meal) => ({ ...meal, servings: positiveNumber(meal.servings, 2, 50) }));
}

function normalizePlan(plan: MealPlan): MealPlan {
  const raw = asObject<MealPlan>(plan);
  return {
    id: typeof raw.id === 'string' ? raw.id : uid('plan'),
    name: typeof raw.name === 'string' ? raw.name : 'Saved week',
    startDate: isValidISODate(raw.startDate) ? raw.startDate : toISODate(new Date()),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    source: raw.source === 'demo' ? 'demo' : 'manual',
    days: asArray<MealPlan['days'][number]>(raw.days).map((day) => {
      const dayRaw = asObject<MealPlan['days'][number]>(day);
      const dayMeals = asObject<MealPlan['days'][number]['meals']>(dayRaw.meals);
      return {
        ...dayRaw,
        date: isValidISODate(dayRaw.date) ? dayRaw.date : toISODate(new Date()),
        meals: {
          breakfast: normalizePlannedMeals(dayMeals.breakfast),
          lunch: normalizePlannedMeals(dayMeals.lunch),
          dinner: normalizePlannedMeals(dayMeals.dinner),
          snack: normalizePlannedMeals(dayMeals.snack),
        },
      };
    }),
  };
}

function positiveNumber(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(max, Math.round(value));
}

function normalizeHousehold(value: unknown): Household | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Partial<Household>;
  const members = asArray<Household['members'][number]>(raw.members)
    .filter((member) => member && typeof member.id === 'string' && typeof member.name === 'string')
    .map((member) => ({
      id: member.id,
      name: member.name,
      ageGroup: member.ageGroup === 'child' ? ('child' as const) : ('adult' as const),
      diet: member.diet,
    }));
  return {
    adults: positiveNumber(raw.adults, 2, 30),
    children: positiveNumber(raw.children, 0, 30),
    defaultServings: positiveNumber(raw.defaultServings, 2, 50),
    members,
  };
}

function normalizePantry(value: unknown): PantryItem[] {
  return asArray<PantryItem>(value).filter(
    (item) =>
      item &&
      typeof item.id === 'string' &&
      typeof item.ingredientId === 'string' &&
      Number.isFinite(item.quantity) &&
      item.quantity > 0 &&
      typeof item.unit === 'string',
  ).map((item) => ({
    ...item,
    expiresOn: isValidISODate(item.expiresOn) ? item.expiresOn : undefined,
    staple: item.staple === true,
    addedAt: typeof item.addedAt === 'string' ? item.addedAt : new Date().toISOString(),
  }));
}

function normalizeExtras(value: unknown): ExtraItem[] {
  return asArray<ExtraItem>(value).filter(
    (item) =>
      item &&
      typeof item.id === 'string' &&
      typeof item.name === 'string' &&
      item.name.trim().length > 0 &&
      Number.isFinite(item.quantity) &&
      item.quantity > 0 &&
      typeof item.unit === 'string',
  ).map((item) => ({
    ...item,
    name: item.name.trim(),
    addedAt: typeof item.addedAt === 'string' ? item.addedAt : new Date().toISOString(),
  }));
}

function normalizeCustomRecipe(value: unknown): Recipe | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Partial<Recipe>;
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  if (!Array.isArray(raw.ingredients) || !Array.isArray(raw.steps)) return null;
  if (!raw.nutrition || typeof raw.nutrition !== 'object') return null;
  return {
    ...(raw as Recipe),
    baseServings: positiveNumber(raw.baseServings, 2, 50),
    ingredients: asArray<RecipeIngredient>(raw.ingredients).filter(
      (item) =>
        item &&
        typeof item.ingredientId === 'string' &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0 &&
        typeof item.unit === 'string',
    ),
    steps: asArray<RecipeStep>(raw.steps).filter(
      (step) => step && typeof step.text === 'string' && step.text.trim().length > 0,
    ),
    tags: asArray<string>(raw.tags),
    equipment: asArray<Recipe['equipment'][number]>(raw.equipment),
    mealTypes: asArray<Recipe['mealTypes'][number]>(raw.mealTypes),
    dietTypes: asArray<Recipe['dietTypes'][number]>(raw.dietTypes),
  };
}

function normalizeBooleanSettings<T extends { [K in keyof T]: boolean }>(
  defaults: T,
  value: unknown,
): T {
  const raw = asObject<Record<string, unknown>>(value);
  const next = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const stored = raw[key as string];
    if (typeof stored === 'boolean') next[key] = stored as T[keyof T];
  }
  return next;
}

/**
 * Rehydrates persisted state defensively. AsyncStorage can contain older
 * shapes, partial writes or hand-edited JSON; anything malformed must fall back
 * to safe defaults instead of crashing a screen on first render.
 */
function mergeStored(stored: unknown): AppData {
  const base = createEmptyData();
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return base;
  const raw = stored as Partial<AppData>;

  const rawUser = raw.user as Partial<UserProfile> | null | undefined;
  const user: UserProfile | null =
    rawUser && typeof rawUser.id === 'string' && typeof rawUser.name === 'string'
      ? {
          id: rawUser.id,
          name: rawUser.name,
          phone: typeof rawUser.phone === 'string' ? rawUser.phone : undefined,
          email: typeof rawUser.email === 'string' ? rawUser.email : undefined,
          authMethod:
            rawUser.authMethod === 'demo' || rawUser.authMethod === 'email'
              ? rawUser.authMethod
              : 'phone',
          createdAt:
            typeof rawUser.createdAt === 'string' ? rawUser.createdAt : new Date().toISOString(),
          // Only the seeded demo account may be an admin. A hand-edited
          // `isAdmin: true` on a self-service account is ignored.
          isAdmin: rawUser.authMethod === 'demo' && rawUser.isAdmin === true,
        }
      : null;
  const rawSession = raw.session as AppData['session'];
  const session =
    rawSession && user && rawSession.userId === user.id
      ? { userId: user.id, method: user.authMethod, signedInAt: typeof rawSession.signedInAt === 'string' ? rawSession.signedInAt : new Date().toISOString() }
      : null;

  const rawPrefs = raw.preferences as Partial<Preferences> | null | undefined;
  const preferences = rawPrefs
    ? {
        ...defaultPreferences,
        ...rawPrefs,
        budget: { ...defaultPreferences.budget, ...asObject<Preferences['budget']>(rawPrefs.budget) },
        restrictions: asArray<Preferences['restrictions'][number]>(rawPrefs.restrictions),
        allergens: asArray<string>(rawPrefs.allergens),
        customExclusions: asArray<string>(rawPrefs.customExclusions),
        dislikes: asArray<string>(rawPrefs.dislikes),
        equipment: asArray<Preferences['equipment'][number]>(rawPrefs.equipment),
        mealTypes: asArray<Preferences['mealTypes'][number]>(rawPrefs.mealTypes),
      }
    : null;

  const checkedItems: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(asObject<Record<string, boolean>>(raw.checkedItems))) {
    if (typeof value === 'boolean') checkedItems[key] = value;
  }

  return {
    ...base,
    ...raw,
    session,
    user,
    household: normalizeHousehold(raw.household),
    preferences,
    pantry: normalizePantry(raw.pantry),
    favorites: asArray<string>(raw.favorites).filter((id) => typeof id === 'string'),
    plans: asArray<MealPlan>(raw.plans).map(normalizePlan),
    activePlanId: typeof raw.activePlanId === 'string' ? raw.activePlanId : null,
    recentRecipeIds: asArray<string>(raw.recentRecipeIds).filter((id) => typeof id === 'string'),
    customRecipes: asArray(raw.customRecipes)
      .map(normalizeCustomRecipe)
      .filter((recipe): recipe is Recipe => recipe !== null),
    extras: normalizeExtras(raw.extras),
    checkedItems,
    cookingHistory: asArray(raw.cookingHistory),
    orders: asArray(raw.orders),
    notifications: normalizeBooleanSettings(base.notifications, raw.notifications),
    consents: normalizeBooleanSettings(base.consents, raw.consents),
    auditLogs: asArray(raw.auditLogs),
    verifiedRecipeIds: asArray<string>(raw.verifiedRecipeIds).filter((id) => typeof id === 'string'),
    autoDeductPantry: raw.autoDeductPantry !== false,
  };
}

function demoData(): AppData {
  const base = createEmptyData();
  const now = new Date().toISOString();
  const user: UserProfile = createDemoUser(now);
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
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted) return;
        if (raw) {
          try {
            setState(mergeStored(JSON.parse(raw)));
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

  useEffect(() => {
    const flush = () => {
      if (!hydratedRef.current) return;
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.current)).catch(() => undefined);
    };
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') flush();
    });
    return () => {
      flush();
      subscription.remove();
    };
  }, []);

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
        if (prev.user && matchesExistingAccount(prev.user, channel, identifier)) {
          return {
            ...prev,
            session: { userId: prev.user.id, method: channel, signedInAt: now },
            user: { ...prev.user, authMethod: channel, isAdmin: false },
          };
        }
        const user = createSelfServiceUser(
          channel,
          identifier,
        );
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
    setState((prev) =>
      prev.user ? { ...prev, user: sanitizeProfilePatch(prev.user, patch) } : prev,
    );
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
      if (!item.ingredientId || !Number.isFinite(item.quantity) || item.quantity <= 0) return;
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
      setState((prev) => {
        const extras = mergeExtraItem(prev.extras, item, { id: uid('extra') });
        return extras === prev.extras ? prev : { ...prev, extras };
      });
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
      const weekStart = startDate ?? startOfWeek(toISODate(new Date()));
      if (!isValidISODate(weekStart)) return null;
      const plan = generatePlan({
        prefs: state.preferences,
        recipes: allRecipes,
        startDate: weekStart,
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
      if (!state.preferences || !state.household || !isValidISODate(date)) return null;
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
      if (!state.preferences || !isValidISODate(startDate)) return null;
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
      if (!state.preferences || !isValidISODate(date)) return;
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
      if (!isValidISODate(startDate)) return;
      setState((prev) => {
        const current = prev.plans.find((plan) => plan.id === prev.activePlanId) ?? prev.plans[0];
        if (!current || !isValidISODate(current.startDate)) return prev;
        const offset = Math.round(
          (new Date(startDate).getTime() - new Date(current.startDate).getTime()) / 86400000,
        );
        if (!Number.isFinite(offset)) return prev;
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
    (fromDate: string, toDate: string) => {
      if (!isValidISODate(fromDate) || !isValidISODate(toDate)) return;
      mutateActivePlan((plan) => copyDayInPlan(plan, fromDate, toDate));
    },
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
