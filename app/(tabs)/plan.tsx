import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Flame,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Share2,
  ShoppingBasket,
  Sparkles,
  Trash2,
  UtensilsCrossed,
  Wand2,
} from 'lucide-react-native';
import { defaultPreferences, useApp } from '@/lib/store/AppContext';
import {
  Badge,
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  Field,
  FoodImage,
  InfoBanner,
  Sheet,
  Stepper,
  Txt,
} from '@/components/ui';
import { DietMark } from '@/components/RecipeCard';
import { colors, mealSlotLabels, mealSlotOrder, radius, spacing } from '@/lib/theme';
import {
  addDays,
  formatDay,
  formatINR,
  startOfWeek,
  todayISO,
} from '@/lib/format';
import { planBudgetStatus, planCost, weekLabel } from '@/lib/engine/planner';
import { MealPlan, MealSlot, PlannedMeal } from '@/lib/types';

interface SelectedMeal {
  date: string;
  slot: MealSlot;
  meal: PlannedMeal;
}

export default function PlanScreen() {
  const {
    state,
    activePlan,
    allRecipes,
    setActivePlan,
    createGeneratedPlan,
    createEmptyPlan,
    regenerateWeek,
    regenerateDay,
    removeMeal,
    changeMealServings,
    duplicateActivePlan,
    deletePlan,
    copyMealTo,
  } = useApp();
  const router = useRouter();
  const [weekStart, setWeekStart] = useState(activePlan?.startDate ?? startOfWeek(todayISO()));
  const [selected, setSelected] = useState<SelectedMeal | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyDate, setCopyDate] = useState(addDays(todayISO(), 1));
  const [copySlot, setCopySlot] = useState<MealSlot>('dinner');
  const [duplicateStart, setDuplicateStart] = useState(addDays(weekStart, 7));
  const [duplicateName, setDuplicateName] = useState('');
  const [customStart, setCustomStart] = useState(weekStart);
  const [startError, setStartError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const prefs = state.preferences ?? defaultPreferences;
  const weekPlan = state.plans.find((plan) => plan.startDate === weekStart) ?? null;
  const slots = prefs.mealTypes.length ? prefs.mealTypes : mealSlotOrder;

  useEffect(() => {
    if (weekPlan && activePlan?.id !== weekPlan.id) {
      setActivePlan(weekPlan.id);
    }
  }, [weekPlan, activePlan?.id, setActivePlan]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const recipeIndex = useMemo(
    () => new Map(allRecipes.map((recipe) => [recipe.id, recipe])),
    [allRecipes],
  );

  const selectedRecipe = selected ? recipeIndex.get(selected.meal.recipeId) : null;
  const budget = weekPlan ? planBudgetStatus(weekPlan, allRecipes, prefs) : null;
  const cost = weekPlan ? planCost(weekPlan, allRecipes) : null;
  const mealCount = weekPlan
    ? weekPlan.days.reduce(
        (total, day) => total + Object.values(day.meals).reduce((sum, meals) => sum + meals.length, 0),
        0,
      )
    : 0;

  const dayStats = (plan: MealPlan, date: string) => {
    const day = plan.days.find((item) => item.date === date);
    if (!day) return { meals: 0, calories: 0 };
    let meals = 0;
    let calories = 0;
    for (const slotMeals of Object.values(day.meals)) {
      for (const meal of slotMeals) {
        const recipe = recipeIndex.get(meal.recipeId);
        if (!recipe) continue;
        meals += 1;
        calories += recipe.nutrition.calories * (meal.servings / recipe.baseServings);
      }
    }
    return { meals, calories: Math.round(calories) };
  };

  const sharePlan = async () => {
    if (!weekPlan) return;
    const lines = [`${weekPlan.name}`, weekLabel(weekPlan), ''];
    for (const day of weekPlan.days) {
      lines.push(formatDay(day.date, 'long'));
      for (const slot of slots) {
        const meals = day.meals[slot];
        if (meals.length === 0) continue;
        const names = meals
          .map((meal) => recipeIndex.get(meal.recipeId)?.name)
          .filter(Boolean)
          .join(', ');
        lines.push(`• ${mealSlotLabels[slot]}: ${names}`);
      }
      lines.push('');
    }
    lines.push('Shared from Rasoi');
    try {
      await Share.share({ message: lines.join('\n') });
    } catch {
      setNotice('Sharing is unavailable on this device.');
    }
  };

  const applyStart = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(customStart)) {
      setStartError('Use the format YYYY-MM-DD.');
      return;
    }
    const parsed = new Date(`${customStart}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      setStartError('That date is not valid.');
      return;
    }
    setWeekStart(customStart);
    const existing = state.plans.find((plan) => plan.startDate === customStart);
    if (existing) setActivePlan(existing.id);
    setStartOpen(false);
    setStartError(null);
    setNotice('Showing the seven days from ' + formatDay(customStart));
  };

  const generate = () => {
    const plan = createGeneratedPlan(weekStart, `Week of ${formatDay(weekStart)}`);
    if (plan) {
      setNotice('A fresh week is ready. Every meal fits your preferences.');
    }
  };

  const startBlank = () => {
    const plan = createEmptyPlan(weekStart, `Week of ${formatDay(weekStart)}`);
    if (plan) setNotice('Blank week created. Add meals as you go.');
  };

  const regenerate = () => {
    if (!weekPlan) return;
    setActivePlan(weekPlan.id);
    regenerateWeek();
    setNotice('Week regenerated with new recipes.');
  };

  const regenerateSingleDay = (date: string) => {
    setActivePlan(weekPlan!.id);
    regenerateDay(date);
    setNotice(`${formatDay(date)} regenerated.`);
  };

  const openAdd = (date: string, slot: MealSlot) => {
    router.push({ pathname: '/plan/add', params: { date, slot } });
  };

  const openReplace = () => {
    if (!selected) return;
    const { date, slot, meal } = selected;
    setSelected(null);
    router.push({ pathname: '/plan/add', params: { date, slot, replaceId: meal.id } });
  };

  const confirmDelete = () => {
    if (!weekPlan) return;
    setMenuOpen(false);
    setDeleteOpen(true);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Txt variant="tiny" color={colors.orange} style={{ fontWeight: '800', letterSpacing: 1.5, marginBottom: 5 }}>YOUR KITCHEN, IN RHYTHM</Txt>
            <Txt variant="h1">Meal plan</Txt>
            <Txt variant="small" color={colors.inkSoft} style={{ marginTop: 2 }}>
              Seven days, one smart grocery list
            </Txt>
          </View>
          <Pressable onPress={() => setMenuOpen(true)} style={styles.menuButton} accessibilityLabel="Plan options">
            <MoreHorizontal size={20} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.weekNav}>
          <Pressable
            onPress={() => setWeekStart(addDays(weekStart, -7))}
            style={styles.navArrow}
            accessibilityLabel="Previous week"
          >
            <ChevronLeft size={18} color={colors.forest} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Txt variant="tiny" color={colors.inkFaint} style={{ fontWeight: '700' }}>
              {weekPlan ? weekPlan.name.toUpperCase() : 'SEVEN-DAY WINDOW'}
            </Txt>
            <Txt variant="bodyStrong">{weekPlan ? weekLabel(weekPlan) : `${formatDay(weekStart)} – ${formatDay(addDays(weekStart, 6))}`}</Txt>
          </View>
          <Pressable
            onPress={() => setWeekStart(addDays(weekStart, 7))}
            style={styles.navArrow}
            accessibilityLabel="Next week"
          >
            <ChevronRight size={18} color={colors.forest} />
          </Pressable>
        </View>

        {weekPlan ? (
          <View style={{ marginTop: spacing.lg, paddingVertical: spacing.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.lineSoft }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Txt variant="tiny" color={colors.inkFaint} style={{ fontWeight: '800', letterSpacing: 1 }}>YOUR WEEK AT A GLANCE</Txt>
              <Txt variant="tiny" color={colors.forest} style={{ fontWeight: '700' }}>{mealCount} planned</Txt>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 5 }}>
              {weekPlan.days.map((day) => {
                const count = Object.values(day.meals).reduce((sum, meals) => sum + meals.length, 0);
                const today = day.date === todayISO();
                return (
                  <View key={day.date} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, backgroundColor: today ? colors.forest : colors.white, borderWidth: 1, borderColor: today ? colors.forest : colors.lineSoft, borderRadius: radius.sm }}>
                    <Txt variant="tiny" color={today ? colors.white : colors.inkFaint} style={{ fontWeight: '700' }}>{formatDay(day.date).split(' ')[0].slice(0, 2).toUpperCase()}</Txt>
                    <Txt variant="bodyStrong" color={today ? colors.white : colors.ink} style={{ marginTop: 2 }}>{formatDay(day.date).split(' ')[1] ?? ''}</Txt>
                    <View style={{ width: 5, height: 5, borderRadius: 3, marginTop: 5, backgroundColor: count ? (today ? colors.mintStrong : colors.orange) : (today ? colors.inkFaint : colors.line) }} />
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
          <Chip
            label="This week"
            selected={weekStart === startOfWeek(todayISO())}
            onPress={() => setWeekStart(startOfWeek(todayISO()))}
          />
          <Chip label="Change start date" onPress={() => { setCustomStart(weekStart); setStartOpen(true); }} />
          {weekPlan ? <Chip label="Regenerate week" icon={<RefreshCw size={12} color={colors.inkSoft} />} onPress={regenerate} /> : null}
        </View>

        {notice ? (
          <View style={{ marginTop: spacing.md }}>
            <InfoBanner message={notice} tone="mint" icon={<Check size={16} color={colors.forest} />} />
          </View>
        ) : null}

        {!weekPlan ? (
          <View style={{ marginTop: spacing.lg }}>
            <Card style={{ backgroundColor: colors.forest, borderColor: colors.forest }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Sparkles size={16} color={colors.mintStrong} />
                <Txt variant="tiny" color={colors.mintStrong} style={{ fontWeight: '800', letterSpacing: 0.7 }}>
                  NOTHING PLANNED YET
                </Txt>
              </View>
              <Txt variant="h2" color={colors.white} style={{ marginTop: spacing.sm }}>
                Build this week in one tap
              </Txt>
              <Txt variant="small" color={colors.mintStrong} style={{ marginTop: 4 }}>
                We will pick meals that match your diet, equipment, budget and pantry. Every pick stays allergen-safe.
              </Txt>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
                <Button
                  label="Generate week"
                  variant="secondary"
                  size="sm"
                  onPress={generate}
                  icon={<Wand2 size={15} color={colors.forest} />}
                  style={{ flex: 1 }}
                />
                <Button
                  label="Start blank"
                  variant="ghost"
                  size="sm"
                  onPress={startBlank}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
            <View style={{ height: spacing.lg }} />
            <EmptyState
              icon={<CalendarDays size={24} color={colors.forest} />}
              title="Or hand-pick your meals"
              message="Browse the recipe library and add dishes to any day. Quantities update automatically."
              actionLabel="Browse recipes"
              onAction={() => router.push('/(tabs)/recipes')}
            />
          </View>
        ) : (
          <>
            <Card style={{ marginTop: spacing.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.stat}>
                  <Txt variant="h2">{mealCount}</Txt>
                  <Txt variant="tiny" color={colors.inkSoft}>meals planned</Txt>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Txt variant="h2">{formatINR(cost?.total ?? 0)}</Txt>
                  <Txt variant="tiny" color={colors.inkSoft}>estimated cost</Txt>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Txt variant="h2">{cost?.servings ?? 0}</Txt>
                  <Txt variant="tiny" color={colors.inkSoft}>servings</Txt>
                </View>
              </View>
              <View style={{ marginTop: spacing.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Txt variant="tiny" color={budget?.overBudget ? colors.orange : colors.inkSoft}>
                    {budget?.label}
                  </Txt>
                  <Txt variant="tiny" color={colors.inkFaint}>
                    Weekly budget {formatINR(prefs.budget.weekly)}
                  </Txt>
                </View>
              </View>
            </Card>

            {weekPlan.days.map((day) => {
              const stats = dayStats(weekPlan, day.date);
              const isToday = day.date === todayISO();
              return (
                <Card key={day.date} padded={false} style={{ marginTop: spacing.lg, overflow: 'hidden' }}>
                  <View style={[styles.dayHeader, isToday && { backgroundColor: colors.mintPale }]}>
                    <View style={[styles.dateBadge, isToday && { backgroundColor: colors.forest }]}>
                      <Txt variant="tiny" color={isToday ? colors.mintStrong : colors.inkFaint} style={{ fontWeight: '700' }}>
                        {formatDay(day.date).split(' ')[0].toUpperCase()}
                      </Txt>
                      <Txt variant="h3" color={isToday ? colors.white : colors.ink}>
                        {Number(day.date.slice(-2))}
                      </Txt>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Txt variant="bodyStrong">{formatDay(day.date, 'long').split(',')[0]}</Txt>
                        {isToday ? <Badge label="Today" tone="mint" /> : null}
                      </View>
                      <Txt variant="tiny" color={colors.inkSoft}>
                        {stats.meals} {stats.meals === 1 ? 'meal' : 'meals'} · ~{stats.calories} kcal
                      </Txt>
                    </View>
                    <Pressable
                      onPress={() => regenerateSingleDay(day.date)}
                      style={styles.dayAction}
                      accessibilityLabel={`Regenerate ${formatDay(day.date)}`}
                    >
                      <RefreshCw size={14} color={colors.forest} />
                    </Pressable>
                  </View>
                  {slots.map((slot) => {
                    const meals = day.meals[slot];
                    return (
                      <View key={slot}>
                        <Divider />
                        {meals.length === 0 ? (
                          <Pressable
                            onPress={() => openAdd(day.date, slot)}
                            style={({ pressed }) => [styles.emptySlot, pressed && { backgroundColor: colors.mintPale }]}
                          >
                            <Txt variant="tiny" color={colors.inkFaint} style={{ fontWeight: '800', width: 68 }}>
                              {mealSlotLabels[slot].toUpperCase()}
                            </Txt>
                            <Txt variant="small" color={colors.inkFaint} style={{ flex: 1 }}>
                              Add {mealSlotLabels[slot].toLowerCase()}
                            </Txt>
                            <View style={styles.addCircle}>
                              <Plus size={14} color={colors.forest} />
                            </View>
                          </Pressable>
                        ) : (
                          meals.map((meal) => {
                            const recipe = recipeIndex.get(meal.recipeId);
                            if (!recipe) return null;
                            return (
                              <Pressable
                                key={meal.id}
                                onPress={() => {
                                  setSelected({ date: day.date, slot, meal });
                                  setCopyDate(addDays(day.date, 1));
                                  setCopySlot(slot);
                                  setCopyOpen(false);
                                }}
                                style={({ pressed }) => [styles.mealRow, pressed && { backgroundColor: colors.mintPale }]}
                              >
                                <Txt variant="tiny" color={colors.inkFaint} style={{ fontWeight: '800', width: 68 }}>
                                  {mealSlotLabels[slot].toUpperCase()}
                                </Txt>
                                <DietMark foodType={recipe.foodType} />
                                <View style={{ flex: 1 }}>
                                  <Txt variant="bodyStrong" numberOfLines={1}>
                                    {recipe.name}
                                  </Txt>
                                  <Txt variant="tiny" color={colors.inkSoft}>
                                    {recipe.prepMinutes + recipe.cookMinutes} min · serves {meal.servings}
                                  </Txt>
                                </View>
                                <ChevronRight size={15} color={colors.inkFaint} />
                              </Pressable>
                            );
                          })
                        )}
                      </View>
                    );
                  })}
                  <Divider />
                  <Pressable onPress={() => openAdd(day.date, slots[0])} style={styles.dayFooter}>
                    <Plus size={13} color={colors.forest} />
                    <Txt variant="tiny" color={colors.forest} style={{ fontWeight: '700' }}>
                      Add another meal
                    </Txt>
                  </Pressable>
                </Card>
              );
            })}

            <Card style={{ marginTop: spacing.xl, backgroundColor: colors.forest, borderColor: colors.forest }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <ShoppingBasket size={18} color={colors.mintStrong} />
                <Txt variant="h3" color={colors.white}>
                  Ready to shop?
                </Txt>
              </View>
              <Txt variant="small" color={colors.mintStrong} style={{ marginTop: 4 }}>
                Every ingredient is combined, pantry stock is deducted and pack sizes are optimised. Estimated basket:{' '}
                {formatINR(cost?.total ?? 0)}.
              </Txt>
              <Button
                label="Build smart grocery list"
                variant="secondary"
                size="sm"
                onPress={() => router.push('/(tabs)/grocery')}
                icon={<ShoppingBasket size={15} color={colors.forest} />}
                style={{ marginTop: spacing.lg }}
              />
            </Card>
          </>
        )}
      </ScrollView>

      <Sheet
        visible={!!selected && !!selectedRecipe}
        onClose={() => setSelected(null)}
        title={selectedRecipe?.name ?? 'Meal'}
      >
        {selected && selectedRecipe ? (
          <View>
            <FoodImage uri={selectedRecipe.image} height={140} borderRadius={radius.md}>
              <View style={{ padding: spacing.sm, flexDirection: 'row' }}>
                <View style={styles.sheetDiet}>
                  <DietMark foodType={selectedRecipe.foodType} />
                </View>
              </View>
            </FoodImage>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Txt variant="tiny" color={colors.orange} style={{ fontWeight: '800', textTransform: 'uppercase' }}>
                  {mealSlotLabels[selected.slot]} · {formatDay(selected.date)}
                </Txt>
                <Txt variant="small" color={colors.inkSoft}>
                  {selectedRecipe.cuisine} · {selectedRecipe.prepMinutes + selectedRecipe.cookMinutes} min
                </Txt>
              </View>
              <Stepper
                value={selected.meal.servings}
                onChange={(value) => {
                  changeMealServings(selected.date, selected.meal.id, value);
                  setSelected({ ...selected, meal: { ...selected.meal, servings: value } });
                }}
                min={1}
                max={20}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
              <Button
                label="Start cooking"
                size="sm"
                onPress={() => {
                  setSelected(null);
                  router.push({ pathname: '/cook/[id]', params: { id: selectedRecipe.id } });
                }}
                icon={<Flame size={15} color={colors.white} />}
                style={{ flex: 1 }}
              />
              <Button
                label="View recipe"
                variant="secondary"
                size="sm"
                onPress={() => {
                  setSelected(null);
                  router.push({ pathname: '/recipe/[id]', params: { id: selectedRecipe.id } });
                }}
                style={{ flex: 1 }}
              />
            </View>

            <View style={{ marginTop: spacing.lg }}>
              <ActionRow
                icon={<UtensilsCrossed size={17} color={colors.forest} />}
                title="Replace this recipe"
                subtitle="Pick something else for this slot"
                onPress={openReplace}
              />
              <ActionRow
                icon={<Copy size={17} color={colors.forest} />}
                title={copyOpen ? 'Choose where to copy' : 'Copy to another day'}
                subtitle="Reuse this meal elsewhere in the week"
                onPress={() => setCopyOpen((value) => !value)}
              />
              {copyOpen ? (
                <View style={styles.copyBox}>
                  <Txt variant="tiny" color={colors.inkSoft} style={{ fontWeight: '700', marginBottom: 6 }}>
                    DAY
                  </Txt>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {weekPlan?.days.map((day) => (
                      <Chip
                        key={day.date}
                        label={formatDay(day.date)}
                        selected={copyDate === day.date}
                        onPress={() => setCopyDate(day.date)}
                      />
                    ))}
                  </ScrollView>
                  <Txt variant="tiny" color={colors.inkSoft} style={{ fontWeight: '700', marginTop: spacing.md, marginBottom: 6 }}>
                    MEAL
                  </Txt>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {mealSlotOrder.map((slot) => (
                      <Chip
                        key={slot}
                        label={mealSlotLabels[slot]}
                        selected={copySlot === slot}
                        onPress={() => setCopySlot(slot)}
                      />
                    ))}
                  </View>
                  <Button
                    label="Copy meal"
                    size="sm"
                    onPress={() => {
                      const meal = selected.meal;
                      const targetPlan = weekPlan;
                      setSelected(null);
                      if (targetPlan) {
                        setActivePlan(targetPlan.id);
                        copyMealTo(meal, copyDate, copySlot);
                        setNotice(`Copied to ${formatDay(copyDate)} · ${mealSlotLabels[copySlot]}.`);
                      }
                    }}
                    style={{ marginTop: spacing.md }}
                  />
                </View>
              ) : null}
              <ActionRow
                icon={<Trash2 size={17} color={colors.red} />}
                title="Remove from plan"
                subtitle="Ingredients update automatically"
                danger
                onPress={() => {
                  removeMeal(selected.date, selected.meal.id);
                  setSelected(null);
                  setNotice('Meal removed. Grocery list updated.');
                }}
              />
            </View>
          </View>
        ) : null}
      </Sheet>

      <Sheet visible={menuOpen} onClose={() => setMenuOpen(false)} title="Plan options">
        <ActionRow
          icon={<Share2 size={17} color={colors.forest} />}
          title="Share this plan"
          subtitle="Send the week to family on WhatsApp or anywhere"
          onPress={() => {
            setMenuOpen(false);
            sharePlan();
          }}
        />
        <ActionRow
          icon={<Copy size={17} color={colors.forest} />}
          title="Duplicate plan"
          subtitle="Start another week from this one"
          onPress={() => {
            setDuplicateName(`${weekPlan?.name ?? 'My plan'} (copy)`);
            setDuplicateStart(addDays(weekStart, 7));
            setMenuOpen(false);
            setDuplicateOpen(true);
          }}
        />
        <ActionRow
          icon={<CalendarDays size={17} color={colors.forest} />}
          title="Change week start"
          subtitle="Choose any seven-day window"
          onPress={() => {
            setCustomStart(weekStart);
            setMenuOpen(false);
            setStartOpen(true);
          }}
        />
        <ActionRow
          icon={<RefreshCw size={17} color={colors.forest} />}
          title="Regenerate the week"
          subtitle="Fresh recipes, same preferences"
          onPress={() => {
            setMenuOpen(false);
            regenerate();
          }}
        />
        <ActionRow
          icon={<Trash2 size={17} color={colors.red} />}
          title="Delete plan"
          subtitle="Remove this week and its list"
          danger
          onPress={confirmDelete}
        />
      </Sheet>

      <Sheet visible={duplicateOpen} onClose={() => setDuplicateOpen(false)} title="Duplicate plan">
        <Field label="Plan name" value={duplicateName} onChangeText={setDuplicateName} />
        <Field
          label="New start date"
          value={duplicateStart}
          onChangeText={setDuplicateStart}
          helper="Format YYYY-MM-DD. The seven days are copied in order."
        />
        <Button
          label="Create copy"
          onPress={() => {
            duplicateActivePlan(duplicateStart, duplicateName.trim() || 'My plan (copy)');
            setDuplicateOpen(false);
            setWeekStart(duplicateStart);
            setNotice('Plan duplicated.');
          }}
          icon={<Copy size={16} color={colors.white} />}
        />
      </Sheet>

      <Sheet visible={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete this plan?">
        <Txt variant="small" color={colors.inkSoft} style={{ marginBottom: spacing.lg }}>
          The meals and their grocery list will be removed. This cannot be undone.
        </Txt>
        <Button
          label="Delete plan"
          variant="danger"
          onPress={() => {
            if (weekPlan) deletePlan(weekPlan.id);
            setDeleteOpen(false);
            setNotice('Plan deleted.');
          }}
          icon={<Trash2 size={16} color={colors.red} />}
        />
        <View style={{ height: spacing.sm }} />
        <Button label="Keep plan" variant="ghost" onPress={() => setDeleteOpen(false)} />
      </Sheet>

      <Sheet visible={startOpen} onClose={() => setStartOpen(false)} title="Change week start">
        <Txt variant="small" color={colors.inkSoft} style={{ marginBottom: spacing.md }}>
          Plans run for seven days from the date you choose. Existing plans are reused when the start date matches.
        </Txt>
        <Field
          label="Start date"
          value={customStart}
          onChangeText={setCustomStart}
          placeholder="2026-11-23"
          error={startError ?? undefined}
          helper="Format YYYY-MM-DD."
        />
        <Button label="Show this week" onPress={applyStart} icon={<CalendarDays size={16} color={colors.white} />} />
      </Sheet>
    </SafeAreaView>
  );

}

function ActionRow({
  icon,
  title,
  subtitle,
  onPress,
  danger = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.7 }]}>
      <View style={[styles.actionIcon, danger && { backgroundColor: colors.redSoft }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Txt variant="bodyStrong" color={danger ? colors.red : colors.ink}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="tiny" color={colors.inkSoft}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      <ChevronRight size={16} color={colors.inkFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.creamDeep,
    borderRadius: radius.md,
    borderWidth: 0,
    borderColor: 'transparent',
    padding: spacing.sm,
    marginTop: spacing.lg,
  },
  navArrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.mintPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 34, backgroundColor: colors.lineSoft },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  dateBadge: {
    width: 48,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.mintPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.mintPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
  },
  addCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
  },
  dayFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
  },
  sheetDiet: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    padding: 4,
    borderRadius: 5,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.mintPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyBox: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    marginVertical: spacing.sm,
  },
});
