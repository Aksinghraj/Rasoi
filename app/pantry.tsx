import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AlertTriangle, Package, Pencil, Plus, Search, Trash2 } from 'lucide-react-native';
import { useApp } from '@/lib/store/AppContext';
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  InfoBanner,
  ScreenHeader,
  Sheet,
  Stepper,
  Txt,
  ToggleRow,
} from '@/components/ui';
import { categoryLabels, categoryOrder, colors, radius, spacing } from '@/lib/theme';
import { addDays, formatDay, todayISO } from '@/lib/format';
import { ingredients, ingredientMap } from '@/lib/data/ingredients';
import { canonicalUnitFor, formatQuantity, unitLabels } from '@/lib/engine/units';
import { PantryItem, Unit } from '@/lib/types';

const UNIT_OPTIONS: Unit[] = ['g', 'kg', 'ml', 'l', 'piece', 'tbsp', 'tsp', 'cup'];

export default function PantryScreen() {
  const router = useRouter();
  const { state, addPantryItem, updatePantryItem, removePantryItem, toggleAutoDeduct } = useApp();

  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<Unit>('g');
  const [expiry, setExpiry] = useState('');
  const [staple, setStaple] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PantryItem | null>(null);

  const today = todayISO();
  const expiringSoon = state.pantry.filter((item) => {
    if (!item.expiresOn) return false;
    const diff = (new Date(item.expiresOn).getTime() - new Date(today).getTime()) / 86400000;
    return diff <= 7;
  });

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = [...ingredients].sort((a, b) => a.name.localeCompare(b.name));
    if (!term) return list.slice(0, 50);
    return list
      .filter(
        (item) =>
          item.name.toLowerCase().includes(term) ||
          item.aliases.some((alias) => alias.includes(term)),
      )
      .slice(0, 50);
  }, [query]);

  const grouped = useMemo(() => {
    return categoryOrder
      .map((category) => ({
        category,
        title: categoryLabels[category],
        items: state.pantry
          .filter((item) => ingredientMap[item.ingredientId]?.category === category)
          .sort((a, b) => (ingredientMap[a.ingredientId]?.name ?? '').localeCompare(ingredientMap[b.ingredientId]?.name ?? '')),
      }))
      .filter((group) => group.items.length > 0);
  }, [state.pantry]);

  const resetForm = () => {
    setPickedId(null);
    setQuery('');
    setQuantity('1');
    setUnit('g');
    setExpiry('');
    setStaple(false);
    setError(null);
  };

  const pick = (ingredientId: string) => {
    const ingredient = ingredientMap[ingredientId];
    if (!ingredient) return;
    setPickedId(ingredientId);
    setUnit(canonicalUnitFor(ingredient));
    setQuantity(ingredient.dimension === 'piece' ? '6' : ingredient.dimension === 'volume' ? '1' : '500');
    setError(null);
  };

  const save = () => {
    const value = Number(quantity.replace(/[^0-9.]/g, ''));
    if (!pickedId) return setError('Choose an ingredient.');
    if (!Number.isFinite(value) || value <= 0) return setError('Enter a quantity greater than zero.');
    if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return setError('Use the date format YYYY-MM-DD.');

    if (editing) {
      updatePantryItem(editing.id, {
        quantity: value,
        unit,
        expiresOn: expiry || undefined,
        staple,
      });
    } else {
      addPantryItem({ ingredientId: pickedId, quantity: value, unit, expiresOn: expiry || undefined, staple });
    }
    setAddOpen(false);
    setEditing(null);
    resetForm();
  };

  const startEdit = (item: PantryItem) => {
    setEditing(item);
    setPickedId(item.ingredientId);
    setQuantity(`${item.quantity}`);
    setUnit(item.unit);
    setExpiry(item.expiresOn ?? '');
    setStaple(Boolean(item.staple));
    setAddOpen(true);
  };

  const expiryBadge = (expiresOn?: string) => {
    if (!expiresOn) return null;
    const diff = Math.round((new Date(expiresOn).getTime() - new Date(today).getTime()) / 86400000);
    if (diff < 0) return <Badge label="Expired" tone="red" />;
    if (diff === 0) return <Badge label="Expires today" tone="orange" />;
    if (diff <= 7) return <Badge label={`${diff}d left`} tone="orange" />;
    return <Badge label={formatDay(expiresOn)} tone="neutral" />;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
      <ScreenHeader
        title="Pantry"
        subtitle={`${state.pantry.length} items tracked`}
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={() => {
              setEditing(null);
              resetForm();
              setAddOpen(true);
            }}
            style={styles.addButton}
            accessibilityLabel="Add pantry item"
          >
            <Plus size={18} color={colors.forest} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <View style={{ marginBottom: spacing.lg, paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.lineSoft }}>
          <Txt variant="tiny" color={colors.orange} style={{ fontWeight: '800', letterSpacing: 1.4 }}>INSIDE YOUR KITCHEN</Txt>
          <Txt variant="h1" style={{ fontSize: 29, marginTop: 4 }}>Make what you have count.</Txt>
          <Txt variant="small" color={colors.inkSoft} style={{ marginTop: 5, maxWidth: 310 }}>
            Keep a simple inventory so meal ideas and shopping lists start with what is already at home.
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
            <Txt variant="tiny" color={colors.inkFaint}>{state.pantry.length} INGREDIENTS TRACKED</Txt>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
          </View>
        </View>
        <Card>
          <ToggleRow
            title="Auto-deduct from grocery list"
            description="Ingredients already at home are removed from your shopping list before prices are calculated."
            value={state.autoDeductPantry}
            onValueChange={toggleAutoDeduct}
          />
        </Card>

        {expiringSoon.length > 0 ? (
          <View style={{ marginTop: spacing.md }}>
            <InfoBanner
              tone="orange"
              title={`${expiringSoon.length} item${expiringSoon.length === 1 ? '' : 's'} need attention`}
              message="Use these soon so they do not go to waste. Expired items are still counted until you remove them."
              icon={<AlertTriangle size={16} color={colors.orange} />}
            />
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Txt variant="h2">{state.pantry.length}</Txt>
            <Txt variant="tiny" color={colors.inkSoft}>items</Txt>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Txt variant="h2">{state.pantry.filter((item) => item.staple).length}</Txt>
            <Txt variant="tiny" color={colors.inkSoft}>staples</Txt>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Txt variant="h2">{expiringSoon.length}</Txt>
            <Txt variant="tiny" color={colors.inkSoft}>expiring</Txt>
          </View>
        </View>

        {state.pantry.length === 0 ? (
          <EmptyState
            icon={<Package size={24} color={colors.forest} />}
            title="Your pantry is empty"
            message="Add the staples and ingredients you already have. Rasoi will subtract them from your grocery list and suggest recipes you can cook right now."
            actionLabel="Add an item"
            onAction={() => {
              resetForm();
              setAddOpen(true);
            }}
          />
        ) : (
          grouped.map((group) => (
            <View key={group.category} style={{ marginTop: spacing.lg }}>
              <Txt variant="label" color={colors.inkFaint} style={{ marginBottom: spacing.sm }}>
                {group.title}
              </Txt>
              <Card padded={false}>
                {group.items.map((item, index) => {
                  const ingredient = ingredientMap[item.ingredientId];
                  return (
                    <View key={item.id}>
                      {index > 0 ? <View style={styles.rowDivider} /> : null}
                      <View style={styles.row}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Txt variant="bodyStrong">{ingredient?.name ?? item.ingredientId}</Txt>
                            {item.staple ? <Badge label="staple" tone="mint" /> : null}
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                            <Txt variant="tiny" color={colors.inkSoft}>
                              {formatQuantity(item.quantity, item.unit)}
                            </Txt>
                            {expiryBadge(item.expiresOn)}
                          </View>
                        </View>
                        <Pressable onPress={() => startEdit(item)} hitSlop={8} style={styles.iconButton} accessibilityLabel="Edit item">
                          <Pencil size={15} color={colors.forest} />
                        </Pressable>
                        <Pressable
                          onPress={() => removePantryItem(item.id)}
                          hitSlop={8}
                          style={styles.iconButton}
                          accessibilityLabel="Remove item"
                        >
                          <Trash2 size={15} color={colors.red} />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </Card>
            </View>
          ))
        )}

        <InfoBanner
          message="Pantry quantities are estimates you control. Rasoi never marks an ingredient as available unless you added it, and it never swaps an allergen for something else."
          tone="neutral"
        />
      </ScrollView>

      <Sheet
        visible={addOpen}
        onClose={() => {
          setAddOpen(false);
          setEditing(null);
          resetForm();
        }}
        title={editing ? 'Edit pantry item' : pickedId ? 'Add quantity' : 'Add to pantry'}
        height={560}
      >
        {!pickedId ? (
          <>
            <View style={styles.searchRow}>
              <Search size={16} color={colors.inkFaint} />
              <View style={{ flex: 1 }}>
                <Field placeholder="Search ingredients" value={query} onChangeText={setQuery} style={{ marginBottom: 0 }} />
              </View>
            </View>
            {filtered.map((ingredient) => (
              <Pressable
                key={ingredient.id}
                onPress={() => pick(ingredient.id)}
                style={({ pressed }) => [styles.pickerRow, pressed && { opacity: 0.7 }]}
              >
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong">{ingredient.name}</Txt>
                  <Txt variant="tiny" color={colors.inkFaint}>
                    {ingredient.category} · {canonicalUnitFor(ingredient)}
                  </Txt>
                </View>
                <Plus size={16} color={colors.forest} />
              </Pressable>
            ))}
          </>
        ) : (
          <>
            <Card style={{ marginBottom: spacing.md }}>
              <Txt variant="bodyStrong">{ingredientMap[pickedId]?.name}</Txt>
              <Txt variant="tiny" color={colors.inkSoft}>
                {ingredientMap[pickedId]?.category}
              </Txt>
            </Card>

            <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Quantity"
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="decimal-pad"
                  error={error ?? undefined}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="small" color={colors.inkSoft} style={{ fontWeight: '600', marginBottom: 6 }}>
                  Unit
                </Txt>
                <View style={styles.unitWrap}>
                  {UNIT_OPTIONS.map((option) => (
                    <Chip key={option} label={unitLabels[option]} selected={unit === option} onPress={() => setUnit(option)} />
                  ))}
                </View>
              </View>
            </View>

            <Field
              label="Expires on (optional)"
              placeholder="YYYY-MM-DD"
              value={expiry}
              onChangeText={setExpiry}
              autoCapitalize="none"
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
              {[3, 7, 30].map((days) => (
                <Chip key={days} label={`+${days} days`} onPress={() => setExpiry(addDays(today, days))} />
              ))}
              <Chip label="Clear" onPress={() => setExpiry('')} />
            </View>

            <ToggleRow
              title="Mark as staple"
              description="Staples are always assumed to be at home unless you remove them."
              value={staple}
              onValueChange={setStaple}
            />

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
              {editing ? null : (
                <Button label="Back" variant="ghost" size="sm" fullWidth={false} onPress={() => setPickedId(null)} />
              )}
              <Button label={editing ? 'Save changes' : 'Add to pantry'} onPress={save} style={{ flex: 1 }} />
            </View>
          </>
        )}
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.creamDeep,
    borderRadius: radius.md,
    borderWidth: 0,
    borderColor: 'transparent',
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 30, backgroundColor: colors.lineSoft },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowDivider: { height: 1, backgroundColor: colors.lineSoft, marginHorizontal: spacing.lg },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.lineSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  unitWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: spacing.md },
});
