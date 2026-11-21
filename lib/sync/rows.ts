import { defaultConsents, defaultNotifications } from '@/lib/store/defaults';
import {
  AppData,
  AuditEntry,
  Consents,
  CookingSession,
  ExtraItem,
  Household,
  HouseholdMember,
  MealPlan,
  MealSlot,
  NotificationSettings,
  OrderRecord,
  PantryItem,
  PlanDay,
  PlannedMeal,
  Preferences,
  Recipe,
  UserProfile,
} from '@/lib/types';

export interface ProfileRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  auth_method: 'phone' | 'email' | 'demo';
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface HouseholdRow {
  user_id: string;
  adults: number;
  children: number;
  default_servings: number;
  members: HouseholdMember[];
  updated_at: string;
}

export interface PreferencesRow {
  user_id: string;
  data: Preferences;
  updated_at: string;
}

export interface MealPlanRow {
  id: string;
  user_id: string;
  name: string;
  start_date: string;
  day_dates: string[];
  source: MealPlan['source'];
  created_at: string;
  updated_at: string;
}

export interface PlannedMealRow {
  id: string;
  user_id: string;
  plan_id: string;
  meal_date: string;
  slot: MealSlot;
  recipe_id: string;
  servings: number;
  cooked: boolean;
  position: number;
  updated_at: string;
}

export interface GroceryListRow {
  id: string;
  user_id: string;
  plan_id: string | null;
  checked_items: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

export interface PantryRow {
  id: string;
  user_id: string;
  ingredient_id: string;
  quantity: number;
  unit: PantryItem['unit'];
  expires_on: string | null;
  staple: boolean;
  added_at: string;
  updated_at: string;
}

export interface ExtraRow {
  id: string;
  user_id: string;
  name: string;
  category: ExtraItem['category'];
  quantity: number;
  unit: ExtraItem['unit'];
  note: string | null;
  added_at: string;
  updated_at: string;
}

export interface CustomRecipeRow {
  id: string;
  user_id: string;
  data: Recipe;
  created_at: string;
  updated_at: string;
}

export interface FavoriteRow {
  user_id: string;
  recipe_id: string;
}

export interface OrderRow {
  id: string;
  user_id: string;
  data: OrderRecord;
  created_at: string;
  updated_at: string;
}

export interface AuditRow {
  id: string;
  user_id: string;
  action: string;
  detail: string;
  actor: string;
  at: string;
}

export interface SettingsRow {
  user_id: string;
  notifications: NotificationSettings;
  consents: Consents;
  auto_deduct_pantry: boolean;
  active_plan_id: string | null;
  recent_recipe_ids: string[];
  verified_recipe_ids: string[];
  cooking: CookingSession | null;
  cooking_history: { recipeId: string; completedAt: string }[];
  updated_at: string;
}

export interface RemoteSnapshot {
  profile: ProfileRow | null;
  household: HouseholdRow | null;
  preferences: PreferencesRow | null;
  settings: SettingsRow | null;
  plans: MealPlanRow[];
  plannedMeals: PlannedMealRow[];
  groceryList: GroceryListRow | null;
  pantry: PantryRow[];
  extras: ExtraRow[];
  customRecipes: CustomRecipeRow[];
  favorites: FavoriteRow[];
  orders: OrderRow[];
  auditLogs: AuditRow[];
}

export const emptyRemoteSnapshot: RemoteSnapshot = {
  profile: null,
  household: null,
  preferences: null,
  settings: null,
  plans: [],
  plannedMeals: [],
  groceryList: null,
  pantry: [],
  extras: [],
  customRecipes: [],
  favorites: [],
  orders: [],
  auditLogs: [],
};

const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asRecord<T extends object>(value: unknown): Partial<T> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Partial<T>) : {};
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value ? value : fallback;
}

/**
 * Builds the exact row set the cloud should hold for one user. Everything is
 * scoped by `user_id`; the server re-checks it with RLS.
 */
export function toRemoteSnapshot(
  state: AppData,
  userId: string,
  now: string = new Date().toISOString(),
): RemoteSnapshot {
  const profile: ProfileRow | null = state.user
    ? {
        id: userId,
        name: state.user.name,
        phone: state.user.phone ?? null,
        email: state.user.email ?? null,
        auth_method: state.user.authMethod,
        is_admin: false,
        created_at: state.user.createdAt,
        updated_at: now,
      }
    : null;

  const household: HouseholdRow | null = state.household
    ? {
        user_id: userId,
        adults: state.household.adults,
        children: state.household.children,
        default_servings: state.household.defaultServings,
        members: state.household.members,
        updated_at: now,
      }
    : null;

  const preferences: PreferencesRow | null = state.preferences
    ? { user_id: userId, data: state.preferences, updated_at: now }
    : null;

  const settings: SettingsRow = {
    user_id: userId,
    notifications: state.notifications,
    consents: state.consents,
    auto_deduct_pantry: state.autoDeductPantry,
    active_plan_id: state.activePlanId,
    recent_recipe_ids: state.recentRecipeIds,
    verified_recipe_ids: state.verifiedRecipeIds,
    cooking: state.cooking,
    cooking_history: state.cookingHistory,
    updated_at: now,
  };

  return {
    profile,
    household,
    preferences,
    settings,
    plans: state.plans.map((plan) => ({
      id: plan.id,
      user_id: userId,
      name: plan.name,
      start_date: plan.startDate,
      day_dates: plan.days.map((day) => day.date),
      source: plan.source,
      created_at: plan.createdAt,
      updated_at: now,
    })),
    plannedMeals: state.plans.flatMap((plan) =>
      plan.days.flatMap((day) =>
        MEAL_SLOTS.flatMap((slot) =>
          (day.meals[slot] ?? []).map((meal, position) => ({
            id: meal.id,
            user_id: userId,
            plan_id: plan.id,
            meal_date: day.date,
            slot,
            recipe_id: meal.recipeId,
            servings: meal.servings,
            cooked: meal.cooked === true,
            position,
            updated_at: now,
          })),
        ),
      ),
    ),
    groceryList: {
      id: 'active',
      user_id: userId,
      plan_id: state.activePlanId,
      checked_items: state.checkedItems,
      created_at: state.createdAt,
      updated_at: now,
    },
    pantry: state.pantry.map((item) => ({
      id: item.id,
      user_id: userId,
      ingredient_id: item.ingredientId,
      quantity: item.quantity,
      unit: item.unit,
      expires_on: item.expiresOn ?? null,
      staple: item.staple === true,
      added_at: item.addedAt,
      updated_at: now,
    })),
    extras: state.extras.map((item) => ({
      id: item.id,
      user_id: userId,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      note: item.note ?? null,
      added_at: item.addedAt,
      updated_at: now,
    })),
    customRecipes: state.customRecipes.map((recipe) => ({
      id: recipe.id,
      user_id: userId,
      data: recipe,
      created_at: now,
      updated_at: now,
    })),
    favorites: state.favorites.map((recipeId) => ({ user_id: userId, recipe_id: recipeId })),
    orders: state.orders.map((order) => ({
      id: order.id,
      user_id: userId,
      data: order,
      created_at: order.createdAt,
      updated_at: now,
    })),
    auditLogs: state.auditLogs.map((entry) => ({
      id: entry.id,
      user_id: userId,
      action: entry.action,
      detail: entry.detail,
      actor: entry.actor,
      at: entry.at,
    })),
  };
}

function profileFromRow(row: ProfileRow | null): UserProfile | null {
  if (!row) return null;
  return {
    id: row.id,
    name: stringOr(row.name, 'Rasoi cook'),
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    authMethod: row.auth_method === 'demo' || row.auth_method === 'phone' ? row.auth_method : 'email',
    createdAt: stringOr(row.created_at, new Date().toISOString()),
    // A self-service account can never be an admin, even if a row says so.
    isAdmin: row.auth_method === 'demo' && row.is_admin === true,
  };
}

function householdFromRow(row: HouseholdRow): Household {
  return {
    adults: Number.isFinite(row.adults) ? Math.max(0, Math.round(row.adults)) : 2,
    children: Number.isFinite(row.children) ? Math.max(0, Math.round(row.children)) : 0,
    defaultServings: Number.isFinite(row.default_servings) ? Math.max(1, Math.round(row.default_servings)) : 2,
    members: asArray<HouseholdMember>(row.members).filter(
      (member) => member && typeof member.id === 'string' && typeof member.name === 'string',
    ),
  };
}

function emptyMeals(): Record<MealSlot, PlannedMeal[]> {
  return { breakfast: [], lunch: [], dinner: [], snack: [] };
}

function normalizeSlot(value: unknown): MealSlot | null {
  return typeof value === 'string' && (MEAL_SLOTS as string[]).includes(value)
    ? (value as MealSlot)
    : null;
}

/**
 * Rebuilds a plan's day structure from flat meal rows. Days appear in the order
 * the meal rows name them; slots are always all four so the planner stays sane.
 */
function daysFromMeals(
  planId: string,
  dayDates: unknown,
  rows: PlannedMealRow[],
  fallback: PlanDay[],
): PlanDay[] {
  const planRows = rows.filter((row) => row.plan_id === planId);
  const declared = Array.isArray(dayDates) ? dayDates.filter(isDateString) : [];
  if (!planRows.length && !declared.length) return fallback;

  const byDate = new Map<string, PlanDay>();
  for (const date of declared) {
    byDate.set(date, { date, meals: emptyMeals() });
  }

  const ordered = [...planRows].sort((a, b) =>
    a.meal_date === b.meal_date ? a.position - b.position : a.meal_date < b.meal_date ? -1 : 1,
  );

  for (const row of ordered) {
    const slot = normalizeSlot(row.slot);
    if (!slot || !isDateString(row.meal_date)) continue;
    const day = byDate.get(row.meal_date) ?? { date: row.meal_date, meals: emptyMeals() };
    day.meals[slot].push({
      id: row.id,
      recipeId: row.recipe_id,
      servings: Number.isFinite(row.servings) ? Math.max(1, Math.round(row.servings)) : 1,
      ...(row.cooked === true ? { cooked: true } : {}),
    });
    byDate.set(row.meal_date, day);
  }

  const days = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return days.length ? days : fallback;
}

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function planFromRow(row: MealPlanRow, fallbackDays: PlanDay[]): MealPlan {
  return {
    id: row.id,
    name: stringOr(row.name, 'Saved week'),
    startDate: isDateString(row.start_date)
      ? row.start_date
      : new Date().toISOString().slice(0, 10),
    days: fallbackDays,
    createdAt: stringOr(row.created_at, new Date().toISOString()),
    source: row.source === 'demo' || row.source === 'generated' ? row.source : 'manual',
  };
}

/**
 * Rebuilds app state from a cloud snapshot. Fields missing remotely fall back
 * to the values already on the device, so a partial migration never wipes data.
 */
export function fromRemoteSnapshot(snapshot: RemoteSnapshot, base: AppData): AppData {
  const user = profileFromRow(snapshot.profile) ?? base.user;
  const session = user
    ? base.session && base.session.userId === user.id
      ? base.session
      : { userId: user.id, method: user.authMethod, signedInAt: new Date().toISOString() }
    : base.session;

  const settings = snapshot.settings;
  const preferences = snapshot.preferences?.data ?? base.preferences;
  const household = snapshot.household ? householdFromRow(snapshot.household) : base.household;

  return {
    ...base,
    session,
    user,
    household,
    preferences,
    plans: snapshot.plans.map((row) =>
      planFromRow(
        row,
        daysFromMeals(
          row.id,
          row.day_dates,
          snapshot.plannedMeals,
          base.plans.find((plan) => plan.id === row.id)?.days ?? [],
        ),
      ),
    ),
    pantry: snapshot.pantry.map((row) => ({
      id: row.id,
      ingredientId: row.ingredient_id,
      quantity: row.quantity,
      unit: row.unit,
      expiresOn: row.expires_on ?? undefined,
      staple: row.staple === true,
      addedAt: stringOr(row.added_at, new Date().toISOString()),
    })),
    extras: snapshot.extras.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      quantity: row.quantity,
      unit: row.unit,
      note: row.note ?? undefined,
      addedAt: stringOr(row.added_at, new Date().toISOString()),
    })),
    customRecipes: snapshot.customRecipes.map((row) => row.data).filter(Boolean),
    favorites: snapshot.favorites.map((row) => row.recipe_id).filter(Boolean),
    orders: snapshot.orders.map((row) => row.data).filter(Boolean),
    auditLogs: snapshot.auditLogs.map((row) => ({
      id: row.id,
      action: row.action,
      detail: row.detail,
      actor: row.actor,
      at: row.at,
    })),
    notifications: {
      ...defaultNotifications,
      ...asRecord<NotificationSettings>(base.notifications),
      ...asRecord<NotificationSettings>(settings?.notifications),
    },
    consents: {
      ...defaultConsents,
      ...asRecord<Consents>(base.consents),
      ...asRecord<Consents>(settings?.consents),
    },
    autoDeductPantry:
      typeof settings?.auto_deduct_pantry === 'boolean' ? settings.auto_deduct_pantry : base.autoDeductPantry,
    activePlanId:
      typeof settings?.active_plan_id === 'string' ? settings.active_plan_id : base.activePlanId,
    recentRecipeIds: Array.isArray(settings?.recent_recipe_ids)
      ? settings.recent_recipe_ids
      : base.recentRecipeIds,
    verifiedRecipeIds: Array.isArray(settings?.verified_recipe_ids)
      ? settings.verified_recipe_ids
      : base.verifiedRecipeIds,
    checkedItems: snapshot.groceryList?.checked_items
      ? Object.fromEntries(
          Object.entries(snapshot.groceryList.checked_items).filter(
            ([, value]) => typeof value === 'boolean',
          ),
        )
      : base.checkedItems,
    cooking: settings?.cooking ?? null,
    cookingHistory: Array.isArray(settings?.cooking_history)
      ? settings.cooking_history
      : base.cookingHistory,
  };
}

/** True when the account already holds real kitchen data worth adopting. */
export function hasRemoteData(snapshot: RemoteSnapshot): boolean {
  return Boolean(
    snapshot.household ||
      snapshot.preferences ||
      snapshot.plans.length ||
      snapshot.plannedMeals.length ||
      snapshot.groceryList !== null ||
      snapshot.pantry.length ||
      snapshot.extras.length ||
      snapshot.customRecipes.length ||
      snapshot.favorites.length ||
      snapshot.orders.length ||
      snapshot.auditLogs.length,
  );
}
