import type { SupabaseClient } from '@supabase/supabase-js';
import { SyncRepository } from '@/lib/sync/engine';
import {
  AuditRow,
  CustomRecipeRow,
  ExtraRow,
  FavoriteRow,
  HouseholdRow,
  MealPlanRow,
  OrderRow,
  PantryRow,
  PreferencesRow,
  ProfileRow,
  RemoteSnapshot,
  SettingsRow,
} from '@/lib/sync/rows';

const UPSERT_CHUNK = 400;
const DELETE_CHUNK = 200;

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

  private async replaceRows<T extends { id: string }>(
    table: string,
    rows: T[],
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

    for (const ids of chunk(stale, DELETE_CHUNK)) {
      const { error: deleteError } = await this.client
        .from(table)
        .delete()
        .eq('user_id', this.userId)
        .in('id', ids);
      raise(deleteError);
    }

    for (const rowsChunk of chunk(rows, UPSERT_CHUNK)) {
      const { error: upsertError } = await this.client
        .from(table)
        .upsert(rowsChunk, { onConflict: 'user_id,id' });
      raise(upsertError);
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

    for (const ids of chunk(stale, DELETE_CHUNK)) {
      const { error: deleteError } = await this.client
        .from('favorites')
        .delete()
        .eq('user_id', this.userId)
        .in('recipe_id', ids);
      raise(deleteError);
    }

    for (const rowsChunk of chunk(rows, UPSERT_CHUNK)) {
      const { error: insertError } = await this.client
        .from('favorites')
        .upsert(rowsChunk, { onConflict: 'user_id,recipe_id', ignoreDuplicates: true });
      raise(insertError);
    }
  }

  async push(snapshot: RemoteSnapshot): Promise<void> {
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
    await this.replaceRows<PantryRow>('pantry_items', snapshot.pantry);
    await this.replaceRows<ExtraRow>('grocery_extras', snapshot.extras);
    await this.replaceRows<CustomRecipeRow>('custom_recipes', snapshot.customRecipes);
    await this.replaceRows<OrderRow>('orders', snapshot.orders);
    await this.replaceRows<AuditRow>('audit_logs', snapshot.auditLogs);
    await this.replaceFavorites(snapshot.favorites);
  }

  async pull(): Promise<RemoteSnapshot> {
    const [
      profile,
      household,
      preferences,
      settings,
      plans,
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
      this.client.from('pantry_items').select('*').eq('user_id', this.userId),
      this.client.from('grocery_extras').select('*').eq('user_id', this.userId),
      this.client.from('custom_recipes').select('*').eq('user_id', this.userId),
      this.client.from('favorites').select('*').eq('user_id', this.userId),
      this.client.from('orders').select('*').eq('user_id', this.userId),
      this.client.from('audit_logs').select('*').eq('user_id', this.userId).order('at', { ascending: false }),
    ]);

    for (const result of [profile, household, preferences, settings, plans, pantry, extras, customRecipes, favorites, orders, auditLogs]) {
      raise(result.error);
    }

    return {
      profile: (profile.data as ProfileRow | null) ?? null,
      household: (household.data as HouseholdRow | null) ?? null,
      preferences: (preferences.data as PreferencesRow | null) ?? null,
      settings: (settings.data as SettingsRow | null) ?? null,
      plans: (plans.data as MealPlanRow[] | null) ?? [],
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
