import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Pause,
  Play,
  RotateCcw,
  Timer,
  X,
} from 'lucide-react-native';
import { useApp } from '@/lib/store/AppContext';
import { Button, Card, EmptyState, InfoBanner, ProgressBar, ScreenHeader, Txt } from '@/components/ui';
import { colors, radius, spacing } from '@/lib/theme';
import { formatQuantity } from '@/lib/engine/units';
import { getIngredient } from '@/lib/data/ingredients';
import { toBase, fromBase, displayUnitFor } from '@/lib/engine/units';

export default function CookingModeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    allRecipes,
    state,
    startCooking,
    toggleCookingIngredient,
    setCookingStep,
    finishCooking,
    cancelCooking,
  } = useApp();
  const recipe = allRecipes.find((item) => item.id === id) ?? null;

  const session = state.cooking && state.cooking.recipeId === id ? state.cooking : null;
  const stepIndex = session?.stepIndex ?? 0;

  const [secondsLeft, setSecondsLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!recipe) return;
    if (!session && !startedRef.current) {
      startedRef.current = true;
      startCooking(recipe.id, state.household?.defaultServings ?? recipe.baseServings);
    }
  }, [recipe, session, startCooking, state.household]);

  const step = recipe?.steps[stepIndex];
  const timerSeconds = (step?.timerMinutes ?? 0) * 60;

  useEffect(() => {
    setSecondsLeft(timerSeconds);
    setRunning(false);
  }, [stepIndex, timerSeconds]);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setSecondsLeft((value) => {
        if (value <= 1) {
          setRunning(false);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  const servings = session?.servings ?? state.household?.defaultServings ?? 2;
  const multiplier = recipe ? servings / recipe.baseServings : 1;

  const scaledIngredients = useMemo(() => {
    if (!recipe) return [];
    return recipe.ingredients.map((item, index) => {
      const ingredient = getIngredient(item.ingredientId);
      if (!ingredient) {
        return { key: `${item.ingredientId}-${index}`, name: item.ingredientId, display: `${item.quantity} ${item.unit}` };
      }
      try {
        const base = toBase(item.quantity, item.unit, ingredient) * multiplier;
        const unit = displayUnitFor(ingredient, base);
        return {
          key: `${item.ingredientId}-${index}`,
          name: ingredient.name,
          display: formatQuantity(fromBase(base, ingredient, unit), unit),
        };
      } catch {
        return { key: `${item.ingredientId}-${index}`, name: ingredient.name, display: `${item.quantity} ${item.unit}` };
      }
    });
  }, [recipe, multiplier]);

  if (!recipe) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
        <ScreenHeader title="Cooking" onBack={() => router.back()} />
        <EmptyState
          title="Recipe not found"
          message="This recipe is no longer available."
          actionLabel="Browse recipes"
          onAction={() => router.replace('/(tabs)/recipes')}
        />
      </SafeAreaView>
    );
  }

  const totalSteps = recipe.steps.length;
  const progress = totalSteps > 0 ? (stepIndex + 1) / totalSteps : 0;
  const checked = session?.checkedIngredients ?? [];
  const checkedCount = scaledIngredients.filter((item) => checked.includes(item.key)).length;

  const formatTime = (total: number) => {
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${`${seconds}`.padStart(2, '0')}`;
  };

  const goNext = () => {
    if (stepIndex >= totalSteps - 1) return;
    setCookingStep(stepIndex + 1);
  };

  const goBack = () => {
    if (stepIndex <= 0) return;
    setCookingStep(stepIndex - 1);
  };

  const complete = () => {
    finishCooking();
    router.replace({ pathname: '/recipe/[id]', params: { id: recipe.id } });
  };

  const exit = () => {
    cancelCooking();
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1D2820' }} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={exit} style={styles.closeButton} accessibilityLabel="Exit cooking mode">
          <X size={20} color={colors.mint} />
        </Pressable>
        <View style={{ flex: 1, paddingHorizontal: spacing.md }}>
          <Txt variant="tiny" color={colors.mintStrong} style={{ fontWeight: '700' }} numberOfLines={1}>
            COOKING · {recipe.name.toUpperCase()}
          </Txt>
          <View style={{ marginTop: 6 }}>
            <ProgressBar value={progress} tone={colors.mintStrong} height={6} />
          </View>
        </View>
        <View style={styles.servingsPill}>
          <Txt variant="tiny" color={colors.forest} style={{ fontWeight: '800' }}>
            {servings} pax
          </Txt>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <View style={styles.stepBadge}>
          <Txt variant="tiny" color={colors.forest} style={{ fontWeight: '800' }}>
            STEP {stepIndex + 1} OF {totalSteps}
          </Txt>
        </View>

        <Txt variant="display" color={colors.white} style={{ marginTop: spacing.lg, lineHeight: 44 }} >
          {step?.text ?? 'All steps complete.'}
        </Txt>
        {step?.tip ? (
          <Txt variant="small" color={colors.mintStrong} style={{ marginTop: spacing.sm }}>
            Tip: {step.tip}
          </Txt>
        ) : null}

        {timerSeconds > 0 ? (
          <View style={styles.timerCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Timer size={18} color={colors.mint} />
              <Txt variant="small" color={colors.mintStrong} style={{ fontWeight: '700' }}>
                Step timer
              </Txt>
            </View>
            <Txt variant="display" color={colors.white} style={{ marginTop: spacing.sm }}>
              {formatTime(secondsLeft)}
            </Txt>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <Button
                label={running ? 'Pause' : secondsLeft === 0 ? 'Restart' : 'Start'}
                size="sm"
                variant="secondary"
                fullWidth={false}
                icon={
                  running ? <Pause size={14} color={colors.forest} /> : <Play size={14} color={colors.forest} />
                }
                onPress={() => {
                  if (secondsLeft === 0) {
                    setSecondsLeft(timerSeconds);
                    setRunning(true);
                  } else {
                    setRunning((value) => !value);
                  }
                }}
              />
              <Button
                label="Reset"
                size="sm"
                variant="ghost"
                fullWidth={false}
                icon={<RotateCcw size={14} color={colors.mintStrong} />}
                onPress={() => {
                  setSecondsLeft(timerSeconds);
                  setRunning(false);
                }}
              />
            </View>
          </View>
        ) : null}

        <View style={{ marginTop: spacing.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Txt variant="h3" color={colors.white}>
              Ingredients
            </Txt>
            <Txt variant="tiny" color={colors.mintStrong}>
              {checkedCount}/{scaledIngredients.length} ready
            </Txt>
          </View>
          <View style={{ marginTop: spacing.sm }}>
            {scaledIngredients.map((item) => {
              const isChecked = checked.includes(item.key);
              return (
                <Pressable
                  key={item.key}
                  onPress={() => toggleCookingIngredient(item.key)}
                  style={({ pressed }) => [styles.ingredientRow, pressed && { opacity: 0.7 }]}
                >
                  <View style={[styles.checkbox, isChecked && { backgroundColor: colors.mintStrong, borderColor: colors.mintStrong }]}>
                    {isChecked ? <Check size={14} color={colors.forest} /> : null}
                  </View>
                  <Txt
                    variant="body"
                    color={isChecked ? colors.mintStrong : colors.white}
                    style={{ flex: 1, textDecorationLine: isChecked ? 'line-through' : 'none' }}
                  >
                    {item.name}
                  </Txt>
                  <Txt variant="small" color={colors.mintStrong} style={{ fontWeight: '600' }}>
                    {item.display}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <InfoBanner
            tone="neutral"
            message="Cooking mode keeps your progress on this device. Timers run while this screen is open."
            icon={<Flame size={16} color={colors.inkSoft} />}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Previous"
          variant="ghost"
          size="sm"
          fullWidth={false}
          disabled={stepIndex === 0}
          icon={<ChevronLeft size={16} color={colors.mintStrong} />}
          onPress={goBack}
        />
        {stepIndex >= totalSteps - 1 ? (
          <Button
            label="Finish cooking"
            icon={<Check size={16} color={colors.white} />}
            onPress={complete}
            style={{ flex: 1 }}
          />
        ) : (
          <Button
            label="Next step"
            icon={<ChevronRight size={16} color={colors.white} />}
            onPress={goNext}
            style={{ flex: 1 }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  servingsPill: {
    backgroundColor: colors.mintStrong,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  stepBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.mintStrong,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  timerCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.mintStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
});
