import type { SupabaseClient } from '@supabase/supabase-js';
import { SyncRepository } from '@/lib/sync/engine';
import {
  AuditRow,
  CustomRecipeRow,
  ExtraRow,
  FavoriteRow,
  GroceryListRow,
  HouseholdRow,
  MealPlanRow,
  OrderRow,
  PantryRow,
  PlannedMealRow,
  PreferencesRow,
  ProfileRow,
  RemoteSnapshot,
  SettingsRow,
} from '@/lib/sync/rows';

const UPSERT_CHUNK = 400;
const DELETE_CHUNK = 200;

type ReplaceMode = 'replace' | 'insert-only';

interface PostgrestErrorLike {
  message: string;
  code?: string;
}

function raise(error: PostgrestErrorLike | null): void {
  if (!error) return;
  const wrapped = new Error(error.message) as Error & { code?: string };
  wrapped.code = error.code;
  throw wrapped;
}

/**
 * Older deployments may not have the transactional RPC from 0002 yet. In that
 * case the repository falls back to the legacy per-table replacement, which is
 * not atomic; see docs/BACKEND.md for the remaining risk.
 */
function isMissingSnapshotRpc(error: unknown): boolean {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  const message = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase();
  return (
    code === '42883' ||
    code === 'PGRST202' ||
    message.includes('could not find the function') ||
    (message.includes('apply_user_snapshot') && message.includes('does not exist'))
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/**
 * Supabase implementation of the sync contract.
 *
 * Every query is scoped by `user_id` on top of RLS, so even a modified client
 * cannot read or write another account's rows.
 */
export class SupabaseSyncRepository implements SyncRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly userId: string,
  ) {}

  /**
   * Replaces one user-owned collection.
   *
   * Rows are written before stale ids are deleted so a failed write leaves the
   * previous remote data intact. `insert-only` tables (orders, audit logs) use
   * conflict-safe inserts because their migrations deliberately have no UPDATE
   * policy: an existing id is preserved instead of being overwritten.
   */
  private async replaceRows<T extends { id: string }>(
    table: string,
    rows: T[],
    mode: ReplaceMode = 'replace',
  ): Promise<void> {
    const { data, error } = await this.client
      .from(table)
      .select('id')
      .eq('user_id', this.userId);
    raise(error);

    const existing = new Set(
      (data ?? []).map((row: { id?: unknown }) => String(row.id ?? '')).filter(Boolean),
    );
    const local = new Set(rows.map((row) => row.id));
    const stale = [...existing].filter((id) => !local.has(id));

    for (const rowsChunk of chunk(rows, UPSERT_CHUNK)) {
      const { error: upsertError } = await this.client
        .from(table)
        .upsert(
          rowsChunk,
          mode === 'insert-only'
            ? { onConflict: 'user_id,id', ignoreDuplicates: true }
            : { onConflict: 'user_id,id' },
        );
      raise(upsertError);
    }

    for (const ids of chunk(stale, DELETE_CHUNK)) {
      const { error: deleteError } = await this.client
        .from(table)
        .delete()
        .eq('user_id', this.userId)
        .in('id', ids);
      raise(deleteError);
    }
  }

  private async replaceFavorites(rows: FavoriteRow[]): Promise<void> {
    const { data, error } = await this.client
      .from('favorites')
      .select('recipe_id')
      .eq('user_id', this.userId);
    raise(error);

    const existing = new Set(
      (data ?? []).map((row: { recipe_id?: unknown }) => String(row.recipe_id ?? '')).filter(Boolean),
    );
    const local = new Set(rows.map((row) => row.recipe_id));
    const stale = [...existing].filter((id) => !local.has(id));

    for (const rowsChunk of chunk(rows, UPSERT_CHUNK)) {
      const { error: insertError } = await this.client
        .from('favorites')
        .upsert(rowsChunk, { onConflict: 'user_id,recipe_id', ignoreDuplicates: true });
      raise(insertError);
    }

    for (const ids of chunk(stale, DELETE_CHUNK)) {
      const { error: deleteError } = await this.client
        .from('favorites')
        .delete()
        .eq('user_id', this.userId)
        .in('recipe_id', ids);
      raise(deleteError);
    }
  }

  /**
   * Preferred path: one server-side transaction. If the RPC is not present yet
   * (an older deployment), fall back to the legacy multi-call replacement.
   */
  async push(snapshot: RemoteSnapshot): Promise<void> {
    try {
      const { error } = await this.client.rpc('apply_user_snapshot', {
        payload: { user_id: this.userId, ...snapshot },
      });
      raise(error);
    } catch (error) {
      if (!isMissingSnapshotRpc(error)) throw error;
      await this.pushLegacy(snapshot);
    }
  }

  private async pushLegacy(snapshot: RemoteSnapshot): Promise<void> {
    if (snapshot.profile) {
      const profile = { ...snapshot.profile, id: this.userId, is_admin: false };
      const { error } = await this.client.from('profiles').upsert(profile, { onConflict: 'id' });
      raise(error);
    }

    if (snapshot.household) {
      const household = { ...snapshot.household, user_id: this.userId };
      const { error } = await this.client.from('households').upsert(household, { onConflict: 'user_id' });
      raise(error);
    }

    if (snapshot.preferences) {
      const preferences = { ...snapshot.preferences, user_id: this.userId };
      const { error } = await this.client.from('preferences').upsert(preferences, { onConflict: 'user_id' });
      raise(error);
    }

    if (snapshot.settings) {
      const settings = { ...snapshot.settings, user_id: this.userId };
      const { error } = await this.client.from('user_settings').upsert(settings, { onConflict: 'user_id' });
      raise(error);
    }

    await this.replaceRows<MealPlanRow>('meal_plans', snapshot.plans);
    await this.replaceRows<PlannedMealRow>('planned_meals', snapshot.plannedMeals);
    if (snapshot.groceryList) {
      const groceryList = { ...snapshot.groceryList, user_id: this.userId };
      const { error } = await this.client
        .from('grocery_lists')
        .upsert(groceryList, { onConflict: 'user_id,id' });
      raise(error);
    }
    await this.replaceRows<PantryRow>('pantry_items', snapshot.pantry);
    await this.replaceRows<ExtraRow>('grocery_extras', snapshot.extras);
    await this.replaceRows<CustomRecipeRow>('custom_recipes', snapshot.customRecipes);
    await this.replaceRows<OrderRow>('orders', snapshot.orders, 'insert-only');
    await this.replaceRows<AuditRow>('audit_logs', snapshot.auditLogs, 'insert-only');
    await this.replaceFavorites(snapshot.favorites);
  }

  async pull(): Promise<RemoteSnapshot> {
    const [
      profile,
      household,
      preferences,
      settings,
      plans,
      plannedMeals,
      groceryList,
      pantry,
      extras,
      customRecipes,
      favorites,
      orders,
      auditLogs,
    ] = await Promise.all([
      this.client.from('profiles').select('*').eq('id', this.userId).maybeSingle(),
      this.client.from('households').select('*').eq('user_id', this.userId).maybeSingle(),
      this.client.from('preferences').select('*').eq('user_id', this.userId).maybeSingle(),
      this.client.from('user_settings').select('*').eq('user_id', this.userId).maybeSingle(),
      this.client.from('meal_plans').select('*').eq('user_id', this.userId).order('start_date', { ascending: false }),
      this.client
        .from('planned_meals')
        .select('*')
        .eq('user_id', this.userId)
        .order('meal_date', { ascending: true })
        .order('position', { ascending: true }),
      this.client.from('grocery_lists').select('*').eq('user_id', this.userId).eq('id', 'active').maybeSingle(),
      this.client.from('pantry_items').select('*').eq('user_id', this.userId),
      this.client.from('grocery_extras').select('*').eq('user_id', this.userId),
      this.client.from('custom_recipes').select('*').eq('user_id', this.userId),
      this.client.from('favorites').select('*').eq('user_id', this.userId),
      this.client.from('orders').select('*').eq('user_id', this.userId),
      this.client.from('audit_logs').select('*').eq('user_id', this.userId).order('at', { ascending: false }),
    ]);

    for (const result of [profile, household, preferences, settings, plans, plannedMeals, groceryList, pantry, extras, customRecipes, favorites, orders, auditLogs]) {
      raise(result.error);
    }

    return {
      profile: (profile.data as ProfileRow | null) ?? null,
      household: (household.data as HouseholdRow | null) ?? null,
      preferences: (preferences.data as PreferencesRow | null) ?? null,
      settings: (settings.data as SettingsRow | null) ?? null,
      plans: (plans.data as MealPlanRow[] | null) ?? [],
      plannedMeals: (plannedMeals.data as PlannedMealRow[] | null) ?? [],
      groceryList: (groceryList.data as GroceryListRow | null) ?? null,
      pantry: (pantry.data as PantryRow[] | null) ?? [],
      extras: (extras.data as ExtraRow[] | null) ?? [],
      customRecipes: (customRecipes.data as CustomRecipeRow[] | null) ?? [],
      favorites: (favorites.data as FavoriteRow[] | null) ?? [],
      orders: (orders.data as OrderRow[] | null) ?? [],
      auditLogs: (auditLogs.data as AuditRow[] | null) ?? [],
    };
  }

  async deleteAccount(): Promise<void> {
    const { error } = await this.client.rpc('delete_my_account');
    raise(error);
  }
}
