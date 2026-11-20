import { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Info,
  Package,
  Plus,
  RefreshCw,
  Share2,
  ShoppingBasket,
  Store,
  Trash2,
  Wallet,
} from 'lucide-react-native';
import { useApp } from '@/lib/store/AppContext';
import {
  Badge,
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  ErrorState,
  Field,
  InfoBanner,
  ProgressBar,
  SectionHeader,
  Sheet,
  Txt,
} from '@/components/ui';
import { colors, categoryLabels, categoryOrder, radius, spacing } from '@/lib/theme';
import { formatINR, formatQty } from '@/lib/format';
import { buildGroceryList, lineRetailerName, shoppingListText } from '@/lib/engine/grocery';
import { packLabel } from '@/lib/data/products';
import { getRetailerCapabilityView } from '@/lib/retailers/adapters';
import { RetailerStatusCard } from '@/components/RetailerStatusCard';
import { GroceryLine, IngredientCategory, Unit } from '@/lib/types';

const UNITS: Unit[] = ['g', 'kg', 'ml', 'l', 'piece'];

export default function GroceryScreen() {
  const { state, activePlan, allRecipes, addExtraItem, removeExtraItem, toggleChecked, resetChecked, toggleAutoDeduct } = useApp();
  const router = useRouter();
  const [refreshedAt, setRefreshedAt] = useState(() => new Date().toISOString());
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<GroceryLine | null>(null);
  const [retailerOpen, setRetailerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addCategory, setAddCategory] = useState<IngredientCategory>('other');
  const [addQuantity, setAddQuantity] = useState('1');
  const [addUnit, setAddUnit] = useState<Unit>('piece');
  const [addError, setAddError] = useState<string | null>(null);
  const [showPantryCovered, setShowPantryCovered] = useState(false);

  const grocery = useMemo(() => {
    if (!activePlan) return null;
    try {
      return buildGroceryList({
        plan: activePlan,
        recipes: allRecipes,
        pantry: state.pantry,
        autoDeduct: state.autoDeductPantry,
        extras: state.extras,
        checked: state.checkedItems,
        generatedAt: refreshedAt,
      });
    } catch {
      return null;
    }
  }, [activePlan, allRecipes, state.pantry, state.autoDeductPantry, state.extras, state.checkedItems, refreshedAt]);

  const refresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setRefreshedAt(new Date().toISOString());
    setRefreshing(false);
    setNotice('List refreshed. Demo catalogue prices have not changed.');
  };

  const checkedCount =
    (grocery?.lines.filter((line) => line.toBuy > 0.001 && state.checkedItems[line.key]).length ?? 0) +
    (grocery?.extras.filter((extra) => extra.checked).length ?? 0);
  const totalItems = (grocery?.totals.lineCount ?? 0) + (grocery?.extras.length ?? 0);
  const completion = totalItems > 0 ? checkedCount / totalItems : 0;
  const pantryCovered = grocery?.lines.filter((line) => line.status === 'pantry_covered') ?? [];
  const unmatched = grocery?.lines.filter((line) => line.status === 'unmatched') ?? [];

  const share = async () => {
    if (!grocery) return;
    const text = shoppingListText(grocery, activePlan?.name ?? 'My grocery list');
    try {
      await Share.share({ message: text });
    } catch {
      setNotice('Sharing is unavailable here. Try the copy option on web.');
    }
  };

  const copy = async () => {
    if (!grocery) return;
    const text = shoppingListText(grocery, activePlan?.name ?? 'My grocery list');
    try {
      const nav = (globalThis as { navigator?: { clipboard?: { writeText: (value: string) => Promise<void> } } }).navigator;
      if (Platform.OS === 'web' && nav?.clipboard) {
        await nav.clipboard.writeText(text);
        setNotice('Grocery list copied to clipboard.');
        return;
      }
      await Share.share({ message: text });
    } catch {
      setNotice('Could not copy. Use Share instead.');
    }
  };

  const addItem = () => {
    const quantity = Number(addQuantity);
    if (addName.trim().length < 2) {
      setAddError('Give the item a name.');
      return;
    }
    if (!quantity || quantity <= 0) {
      setAddError('Enter a quantity above zero.');
      return;
    }
    addExtraItem({ name: addName.trim(), category: addCategory, quantity, unit: addUnit });
    setAddOpen(false);
    setAddName('');
    setAddQuantity('1');
    setAddError(null);
    setNotice('Item added to your list.');
  };

  const noMeals = !activePlan || grocery === null || grocery.totals.lineCount === 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Txt variant="h1">Grocery list</Txt>
            <Txt variant="small" color={colors.inkSoft} style={{ marginTop: 2 }}>
              {activePlan ? activePlan.name : 'No plan yet'}
            </Txt>
          </View>
          <Pressable onPress={share} style={styles.iconButton} accessibilityLabel="Share grocery list">
            <Share2 size={18} color={colors.ink} />
          </Pressable>
          <Pressable onPress={copy} style={styles.iconButton} accessibilityLabel="Copy grocery list">
            <Copy size={18} color={colors.ink} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <Badge label="Smart list" tone="mint" icon={<ShoppingBasket size={11} color={colors.forest} />} />
          <Badge label="Demo catalogue estimates" tone="neutral" />
        </View>

        {notice ? (
          <View style={{ marginTop: spacing.md }}>
            <InfoBanner message={notice} tone="mint" icon={<Check size={16} color={colors.forest} />} />
          </View>
        ) : null}

        {noMeals ? (
          <View style={{ marginTop: spacing.lg }}>
            <EmptyState
              icon={<ShoppingBasket size={24} color={colors.forest} />}
              title="Your basket starts with a plan"
              message="Add meals to your week and every ingredient will be combined, scaled and matched to products automatically."
              actionLabel="Open meal planner"
              onAction={() => router.push('/(tabs)/plan')}
            />
            <Card style={{ marginTop: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Package size={17} color={colors.forest} />
                <Txt variant="bodyStrong">Already have staples?</Txt>
              </View>
              <Txt variant="small" color={colors.inkSoft} style={{ marginTop: 4 }}>
                Add them to your pantry so we never buy duplicates.
              </Txt>
              <Button
                label="Manage pantry"
                variant="secondary"
                size="sm"
                onPress={() => router.push('/pantry')}
                style={{ marginTop: spacing.md }}
              />
            </Card>
          </View>
        ) : grocery ? (
          <>
            <Card style={{ marginTop: spacing.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                <View style={{ flex: 1 }}>
                  <Txt variant="tiny" color={colors.inkFaint} style={{ fontWeight: '700' }}>
                    ESTIMATED BASKET
                  </Txt>
                  <Txt variant="display" style={{ fontSize: 30 }}>
                    {formatINR(grocery.totals.estimated)}
                  </Txt>
                  <Txt variant="tiny" color={colors.inkSoft}>
                    {grocery.totals.lineCount} items · {grocery.totals.matchedCount} matched
                  </Txt>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Txt variant="tiny" color={colors.inkFaint}>
                    Weekly budget
                  </Txt>
                  <Txt variant="bodyStrong">{formatINR(state.preferences?.budget.weekly ?? 0)}</Txt>
                </View>
              </View>
              <View style={{ marginTop: spacing.md }}>
                <ProgressBar
                  value={Math.min(
                    1,
                    grocery.totals.estimated / Math.max(1, state.preferences?.budget.weekly ?? 1),
                  )}
                  tone={
                    grocery.totals.estimated > (state.preferences?.budget.weekly ?? Infinity)
                      ? colors.orange
                      : colors.forest
                  }
                />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                <Txt variant="tiny" color={colors.inkSoft}>
                  {grocery.totals.estimated > (state.preferences?.budget.weekly ?? Infinity)
                    ? `${formatINR(grocery.totals.estimated - (state.preferences?.budget.weekly ?? 0))} over budget`
                    : `${formatINR((state.preferences?.budget.weekly ?? 0) - grocery.totals.estimated)} within budget`}
                </Txt>
                <Txt variant="tiny" color={colors.forest} style={{ fontWeight: '700' }}>
                  Pantry saves {formatINR(grocery.totals.pantrySaved)}
                </Txt>
              </View>
              <Divider style={{ marginVertical: spacing.md }} />
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Txt variant="tiny" color={colors.inkSoft} style={{ flex: 1 }}>
                  {checkedCount} of {totalItems} items checked
                </Txt>
                <Pressable onPress={resetChecked}>
                  <Txt variant="tiny" color={colors.forest} style={{ fontWeight: '700' }}>
                    Reset
                  </Txt>
                </Pressable>
              </View>
              <View style={{ marginTop: 6 }}>
                <ProgressBar value={completion} height={6} tone={colors.orange} />
              </View>
            </Card>

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' }}>
              <Chip
                label={state.autoDeductPantry ? 'Pantry deducted' : 'Pantry ignored'}
                selected={state.autoDeductPantry}
                onPress={toggleAutoDeduct}
                icon={<Package size={13} color={state.autoDeductPantry ? colors.white : colors.inkSoft} />}
              />
              <Chip label="Add item" onPress={() => setAddOpen(true)} icon={<Plus size={13} color={colors.inkSoft} />} />
              <Chip
                label={refreshing ? 'Refreshing…' : 'Refresh'}
                onPress={refresh}
                icon={<RefreshCw size={13} color={colors.inkSoft} />}
              />
            </View>

            <InfoBanner
              title="How this list was built"
              message={`${grocery.totals.lineCount} purchase lines merged from your plan. Pantry stock is deducted automatically, pack sizes are optimised and prices are generated sample data from the demo catalogue — they are not live retailer prices.`}
              tone="neutral"
              icon={<Info size={16} color={colors.inkSoft} />}
            />

            {unmatched.length > 0 ? (
              <View style={{ marginTop: spacing.md }}>
                <InfoBanner
                  title={`${unmatched.length} item${unmatched.length === 1 ? '' : 's'} need a manual match`}
                  message={`${unmatched.map((line) => line.name).join(', ')}. No product was found in the demo catalogue. They stay on the list and are clearly marked at checkout.`}
                  tone="orange"
                  icon={<AlertTriangle size={16} color={colors.orange} />}
                />
              </View>
            ) : null}

            {grocery.sections.map((section) => (
              <View key={section.category}>
                <SectionHeader title={section.title} subtitle={`${section.lines.length} items`} />
                <Card padded={false}>
                  {section.lines.map((line, index) => (
                    <View key={line.key}>
                      {index > 0 ? <Divider /> : null}
                      <Pressable
                        onPress={() => setSelectedLine(line)}
                        style={({ pressed }) => [styles.itemRow, pressed && { backgroundColor: colors.mintPale }]}
                      >
                        <Pressable
                          onPress={() => toggleChecked(line.key)}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: Boolean(state.checkedItems[line.key]) }}
                          style={[
                            styles.checkbox,
                            state.checkedItems[line.key] && { backgroundColor: colors.forest, borderColor: colors.forest },
                          ]}
                        >
                          {state.checkedItems[line.key] ? <Check size={13} color={colors.white} /> : null}
                        </Pressable>
                        <View style={{ flex: 1 }}>
                          <Txt
                            variant="bodyStrong"
                            style={
                              state.checkedItems[line.key]
                                ? { textDecorationLine: 'line-through', color: colors.inkFaint }
                                : undefined
                            }
                          >
                            {line.name}
                          </Txt>
                          <Txt variant="tiny" color={colors.inkSoft}>
                            Buy {formatQty(line.toBuyDisplay, line.toBuyUnit)}
                            {line.pantryUsed > 0.001 ? ` · ${formatQty(line.requiredDisplay, line.displayUnit)} needed` : ''}
                            {line.sources.length > 1 ? ` · ${line.sources.length} recipes` : ''}
                          </Txt>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Txt variant="bodyStrong" color={line.estimatedPrice ? colors.ink : colors.orange}>
                            {line.estimatedPrice ? formatINR(line.estimatedPrice) : '—'}
                          </Txt>
                          <Txt variant="tiny" color={colors.inkFaint}>
                            {line.best ? lineRetailerName(line) : 'No match'}
                          </Txt>
                        </View>
                      </Pressable>
                    </View>
                  ))}
                </Card>
              </View>
            ))}

            {grocery.extras.length > 0 ? (
              <>
                <SectionHeader title="Added by you" subtitle={`${grocery.extras.length} items`} />
                <Card padded={false}>
                  {grocery.extras.map((extra, index) => (
                    <View key={extra.key}>
                      {index > 0 ? <Divider /> : null}
                      <View style={styles.itemRow}>
                        <Pressable
                          onPress={() => toggleChecked(extra.key)}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: extra.checked }}
                          style={[
                            styles.checkbox,
                            extra.checked && { backgroundColor: colors.forest, borderColor: colors.forest },
                          ]}
                        >
                          {extra.checked ? <Check size={13} color={colors.white} /> : null}
                        </Pressable>
                        <View style={{ flex: 1 }}>
                          <Txt
                            variant="bodyStrong"
                            style={extra.checked ? { textDecorationLine: 'line-through', color: colors.inkFaint } : undefined}
                          >
                            {extra.extra.name}
                          </Txt>
                          <Txt variant="tiny" color={colors.inkSoft}>
                            {formatQty(extra.extra.quantity, extra.extra.unit)} · {categoryLabels[extra.category]}
                          </Txt>
                        </View>
                        <Pressable onPress={() => removeExtraItem(extra.extra.id)} hitSlop={8} accessibilityLabel="Remove item">
                          <Trash2 size={16} color={colors.inkFaint} />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </Card>
              </>
            ) : null}

            {pantryCovered.length > 0 ? (
              <>
                <Pressable onPress={() => setShowPantryCovered((value) => !value)} style={styles.pantryHeader}>
                  <Package size={16} color={colors.forest} />
                  <Txt variant="bodyStrong" style={{ flex: 1 }}>
                    Already in your pantry ({pantryCovered.length})
                  </Txt>
                  <ChevronDown
                    size={16}
                    color={colors.inkSoft}
                    style={{ transform: [{ rotate: showPantryCovered ? '180deg' : '0deg' }] }}
                  />
                </Pressable>
                {showPantryCovered ? (
                  <Card padded={false} style={{ marginTop: spacing.sm }}>
                    {pantryCovered.map((line, index) => (
                      <View key={line.key}>
                        {index > 0 ? <Divider /> : null}
                        <View style={styles.itemRow}>
                          <CheckCircle2 size={18} color={colors.forest} />
                          <View style={{ flex: 1 }}>
                            <Txt variant="bodyStrong">{line.name}</Txt>
                            <Txt variant="tiny" color={colors.inkSoft}>
                              Using {formatQty(line.pantryUsed, line.displayUnit)} from pantry
                            </Txt>
                          </View>
                          <Badge label="Covered" tone="mint" />
                        </View>
                      </View>
                    ))}
                  </Card>
                ) : null}
              </>
            ) : null}

            <Card style={{ marginTop: spacing.xl }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Store size={18} color={colors.forest} />
                <Txt variant="h3">Send to a retailer</Txt>
              </View>
              <Txt variant="small" color={colors.inkSoft} style={{ marginTop: 4 }}>
                Choose how you want to shop. Rasoi never claims an order was placed without retailer confirmation.
              </Txt>
              <Button
                label="Compare retailers"
                onPress={() => setRetailerOpen(true)}
                icon={<ArrowRight size={16} color={colors.white} />}
                style={{ marginTop: spacing.md }}
              />
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                <Button label="Copy list" variant="outline" size="sm" onPress={copy} style={{ flex: 1 }} />
                <Button label="Share list" variant="outline" size="sm" onPress={share} style={{ flex: 1 }} />
              </View>
            </Card>

            <View style={styles.demoNote}>
              <Wallet size={13} color={colors.inkFaint} />
              <Txt variant="tiny" color={colors.inkFaint} style={{ flex: 1 }}>
                Demo catalogue: prices, pack sizes and stock are sample data. Live retailer prices are always controlled by
                the retailer and shown at checkout.
              </Txt>
            </View>
          </>
        ) : (
          <ErrorState message="We could not build the list. Check your plan and try refreshing." onRetry={refresh} />
        )}
      </ScrollView>

      <Sheet visible={!!selectedLine} onClose={() => setSelectedLine(null)} title={selectedLine?.name ?? 'Ingredient'}>
        {selectedLine ? (
          <View>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              <Badge label={categoryLabels[selectedLine.category]} tone="neutral" />
              <Badge
                label={
                  selectedLine.status === 'pantry_covered'
                    ? 'Pantry covered'
                    : selectedLine.status === 'matched'
                      ? 'Product matched'
                      : 'Manual match needed'
                }
                tone={selectedLine.status === 'unmatched' ? 'orange' : 'mint'}
              />
            </View>
            <View style={styles.detailGrid}>
              <DetailCell label="Needed" value={formatQty(selectedLine.requiredDisplay, selectedLine.displayUnit)} />
              <DetailCell
                label="From pantry"
                value={formatQty(selectedLine.pantryUsed, selectedLine.displayUnit)}
              />
              <DetailCell label="To buy" value={formatQty(selectedLine.toBuyDisplay, selectedLine.toBuyUnit)} />
            </View>

            <Txt variant="h3" style={{ marginTop: spacing.lg }}>
              Used in
            </Txt>
            <View style={{ marginTop: spacing.sm }}>
              {selectedLine.sources.map((source, index) => (
                <View key={`${source.recipeId}${index}`} style={styles.sourceRow}>
                  <Txt variant="small" style={{ flex: 1 }}>
                    {source.recipeName}
                  </Txt>
                  <Txt variant="tiny" color={colors.inkSoft}>
                    {formatQty(source.quantity, source.unit)}
                  </Txt>
                </View>
              ))}
            </View>

            {selectedLine.best ? (
              <>
                <Txt variant="h3" style={{ marginTop: spacing.lg }}>
                  Matched product
                </Txt>
                <Card style={{ marginTop: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Txt variant="bodyStrong">{selectedLine.best.product.name}</Txt>
                      <Txt variant="tiny" color={colors.inkSoft}>
                        {selectedLine.best.packs} × {packLabel(selectedLine.best.product)} · {lineRetailerName(selectedLine)}
                      </Txt>
                    </View>
                    <Txt variant="price">{formatINR(selectedLine.best.totalPrice)}</Txt>
                  </View>
                  <Txt variant="tiny" color={colors.inkFaint} style={{ marginTop: 4 }}>
                    Pack sizes are chosen to cover {formatQty(selectedLine.toBuyDisplay, selectedLine.toBuyUnit)} with the
                    lowest estimated spend.
                  </Txt>
                </Card>
                {selectedLine.alternatives.length > 0 ? (
                  <>
                    <Txt variant="small" color={colors.inkSoft} style={{ marginTop: spacing.md, marginBottom: spacing.xs }}>
                      Other matched options
                    </Txt>
                    {selectedLine.alternatives.map((alternative) => (
                      <View key={`${alternative.product.id}${alternative.totalPrice}`} style={styles.altRow}>
                        <View style={{ flex: 1 }}>
                          <Txt variant="small" style={{ fontWeight: '600' }}>
                            {alternative.product.retailerName}
                          </Txt>
                          <Txt variant="tiny" color={colors.inkSoft}>
                            {alternative.packs} × {packLabel(alternative.product)}
                          </Txt>
                        </View>
                        <Txt variant="small" style={{ fontWeight: '700' }}>
                          {formatINR(alternative.totalPrice)}
                        </Txt>
                      </View>
                    ))}
                  </>
                ) : null}
                <InfoBanner
                  message="Substitutions are never applied silently. Approve any product change at checkout, and never swap across allergen or dietary lines."
                  tone="neutral"
                />
              </>
            ) : (
              <InfoBanner
                message="No product in the demo catalogue matched this ingredient. It stays on your list for a manual purchase. Try refreshing later or add it as a custom item."
                tone="orange"
              />
            )}
          </View>
        ) : null}
      </Sheet>

      <Sheet visible={retailerOpen} onClose={() => setRetailerOpen(false)} title="Where to shop">
        <Txt variant="small" color={colors.inkSoft} style={{ marginBottom: spacing.md }}>
          Totals below use the demo catalogue. Only the sandbox retailer can create a cart; others open a retailer search
          with your list in hand.
        </Txt>
        {grocery?.comparisons.map((comparison) => {
          const view = getRetailerCapabilityView(comparison.retailerId);
          return (
            <RetailerStatusCard
              key={comparison.retailerId}
              variant="compact"
              view={view}
              estimate={comparison.total}
              matchedLines={comparison.matchedLines}
              totalLines={comparison.totalLines}
              onPress={() => {
                setRetailerOpen(false);
                router.push({ pathname: '/checkout/[retailerId]', params: { retailerId: comparison.retailerId } });
              }}
            />
          );
        })}
        <InfoBanner
          message="BigBasket, Blinkit, Zepto and Swiggy Instamart are connected in approved deep-link mode in this build. No live price or stock is claimed for them."
          tone="neutral"
        />
      </Sheet>

      <Sheet visible={addOpen} onClose={() => setAddOpen(false)} title="Add an item">
        <Field label="Item name" placeholder="e.g. Dish soap" value={addName} onChangeText={setAddName} error={addError ?? undefined} />
        <Txt variant="label" color={colors.inkSoft} style={{ marginBottom: spacing.sm }}>
          Category
        </Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: spacing.md }}>
          {categoryOrder.map((category) => (
            <Chip
              key={category}
              label={categoryLabels[category]}
              selected={addCategory === category}
              onPress={() => setAddCategory(category)}
            />
          ))}
        </ScrollView>
        <Field
          label="Quantity"
          keyboardType="decimal-pad"
          value={addQuantity}
          onChangeText={(value) => setAddQuantity(value.replace(/[^0-9.]/g, ''))}
        />
        <Txt variant="label" color={colors.inkSoft} style={{ marginBottom: spacing.sm }}>
          Unit
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {UNITS.map((unit) => (
            <Chip key={unit} label={unit} selected={addUnit === unit} onPress={() => setAddUnit(unit)} />
          ))}
        </View>
        <Button label="Add to list" onPress={addItem} icon={<Plus size={16} color={colors.white} />} style={{ marginTop: spacing.lg }} />
      </Sheet>
    </SafeAreaView>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailCell}>
      <Txt variant="tiny" color={colors.inkFaint} style={{ fontWeight: '700' }}>
        {label.toUpperCase()}
      </Txt>
      <Txt variant="bodyStrong">{value}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  pantryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
  },
  demoNote: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  detailGrid: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  detailCell: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  altRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
});
