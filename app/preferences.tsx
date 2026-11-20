import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AlertTriangle, Check, Plus, X } from 'lucide-react-native';
import { useApp } from '@/lib/store/AppContext';
import {
  Badge,
  Button,
  Card,
  Chip,
  Field,
  InfoBanner,
  ScreenHeader,
  Txt,
} from '@/components/ui';
import {
  allergenLabels,
  colors,
  dietLabels,
  equipmentLabels,
  mealSlotLabels,
  mealSlotOrder,
  restrictionLabels,
  spacing,
} from '@/lib/theme';
import { isValidPincode } from '@/lib/format';
import {
  CookingTimePreference,
  DietType,
  EquipmentId,
  MealSlot,
  Preferences,
  RestrictionId,
} from '@/lib/types';

const ALLERGENS = Object.keys(allergenLabels);
const RESTRICTIONS = Object.keys(restrictionLabels) as RestrictionId[];
const EQUIPMENT = Object.keys(equipmentLabels) as EquipmentId[];
const COOKING_TIMES: { id: CookingTimePreference; label: string; hint: string }[] = [
  { id: 'quick', label: 'Quick', hint: 'Under 30 min' },
  { id: 'balanced', label: 'Balanced', hint: 'Up to 50 min' },
  { id: 'relaxed', label: 'Relaxed', hint: 'Weekend cooking' },
];

export default function PreferencesScreen() {
  const router = useRouter();
  const { state, updatePreferences, addAudit } = useApp();
  const initial = state.preferences;
  const [draft, setDraft] = useState<Preferences | null>(initial);
  const [exclusion, setExclusion] = useState('');
  const [dislike, setDislike] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!draft) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
        <ScreenHeader title="Preferences" onBack={() => router.back()} />
        <View style={{ padding: spacing.xl }}>
          <InfoBanner message="Finish onboarding before editing preferences." tone="orange" />
        </View>
      </SafeAreaView>
    );
  }

  const patch = (update: Partial<Preferences>) => {
    setDraft((prev) => (prev ? { ...prev, ...update, budget: { ...prev.budget, ...(update.budget ?? {}) } } : prev));
    setSaved(false);
  };

  const toggle = <T extends string>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  const addToken = (field: 'customExclusions' | 'dislikes', value: string, reset: () => void) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (draft[field].some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      reset();
      return;
    }
    patch({ [field]: [...draft[field], trimmed] } as Partial<Preferences>);
    reset();
  };

  const save = () => {
    if (draft.pincode && !isValidPincode(draft.pincode)) {
      setError('Enter a valid 6-digit Indian PIN code, or leave it blank.');
      return;
    }
    if (draft.budget.daily <= 0) {
      setError('Daily budget must be greater than zero.');
      return;
    }
    setError(null);
    updatePreferences(draft);
    addAudit('preferences_updated', 'Diet, safety and budget preferences updated');
    setSaved(true);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
      <ScreenHeader title="Food preferences" subtitle="Diet, safety and budget" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <InfoBanner
          message="Allergens are hard safety rules: recipes containing them are always excluded. Dislikes are soft preferences and only lower a recipe's ranking."
          tone="neutral"
        />

        <Card style={{ marginTop: spacing.lg }}>
          <Txt variant="h3">Diet</Txt>
          <View style={styles.chipWrap}>
            {(Object.keys(dietLabels) as DietType[]).map((option) => (
              <Chip
                key={option}
                label={dietLabels[option]}
                selected={draft.diet === option}
                onPress={() => patch({ diet: option })}
              />
            ))}
          </View>
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Txt variant="h3">Allergens to avoid</Txt>
          <Txt variant="tiny" color={colors.inkSoft} style={{ marginBottom: spacing.sm }}>
            Hard safety filter. Recipes with any selected allergen are never recommended.
          </Txt>
          <View style={styles.chipWrap}>
            {ALLERGENS.map((allergen) => (
              <Chip
                key={allergen}
                label={allergenLabels[allergen] ?? allergen}
                selected={draft.allergens.includes(allergen)}
                tone="orange"
                onPress={() => patch({ allergens: toggle(draft.allergens, allergen) })}
              />
            ))}
          </View>
          {draft.allergens.length > 0 ? (
            <View style={{ marginTop: spacing.md }}>
              <InfoBanner
                tone="orange"
                title="Safety filter active"
                message={`${draft.allergens.length} allergen group${draft.allergens.length === 1 ? '' : 's'} excluded. Regenerate your plan to remove any meals that are no longer safe.`}
                icon={<AlertTriangle size={16} color={colors.orange} />}
              />
            </View>
          ) : null}
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Txt variant="h3">Dietary restrictions</Txt>
          <View style={styles.chipWrap}>
            {RESTRICTIONS.map((restriction) => (
              <Chip
                key={restriction}
                label={restrictionLabels[restriction]}
                selected={draft.restrictions.includes(restriction)}
                onPress={() => patch({ restrictions: toggle(draft.restrictions, restriction) })}
              />
            ))}
          </View>
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Txt variant="h3">Never include these ingredients</Txt>
          <Txt variant="tiny" color={colors.inkSoft} style={{ marginBottom: spacing.sm }}>
            Custom exclusions are treated like allergens.
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Field
                placeholder="e.g. mushrooms"
                value={exclusion}
                onChangeText={setExclusion}
                onSubmitEditing={() => addToken('customExclusions', exclusion, () => setExclusion(''))}
                style={{ marginBottom: 0 }}
              />
            </View>
            <Button
              label="Add"
              size="sm"
              fullWidth={false}
              icon={<Plus size={14} color={colors.white} />}
              onPress={() => addToken('customExclusions', exclusion, () => setExclusion(''))}
            />
          </View>
          <View style={[styles.chipWrap, { marginTop: spacing.md }]}>
            {draft.customExclusions.map((item) => (
              <Token key={item} label={item} onRemove={() => patch({ customExclusions: draft.customExclusions.filter((value) => value !== item) })} />
            ))}
            {draft.customExclusions.length === 0 ? (
              <Txt variant="tiny" color={colors.inkFaint}>
                No custom exclusions yet.
              </Txt>
            ) : null}
          </View>
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Txt variant="h3">Dislikes</Txt>
          <Txt variant="tiny" color={colors.inkSoft} style={{ marginBottom: spacing.sm }}>
            Soft preference. Disliked ingredients reduce a recipe's ranking but are not blocked.
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Field
                placeholder="e.g. bitter gourd"
                value={dislike}
                onChangeText={setDislike}
                onSubmitEditing={() => addToken('dislikes', dislike, () => setDislike(''))}
                style={{ marginBottom: 0 }}
              />
            </View>
            <Button
              label="Add"
              size="sm"
              variant="secondary"
              fullWidth={false}
              icon={<Plus size={14} color={colors.forest} />}
              onPress={() => addToken('dislikes', dislike, () => setDislike(''))}
            />
          </View>
          <View style={[styles.chipWrap, { marginTop: spacing.md }]}>
            {draft.dislikes.map((item) => (
              <Token key={item} label={item} onRemove={() => patch({ dislikes: draft.dislikes.filter((value) => value !== item) })} />
            ))}
            {draft.dislikes.length === 0 ? (
              <Txt variant="tiny" color={colors.inkFaint}>
                Nothing marked as a dislike.
              </Txt>
            ) : null}
          </View>
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Txt variant="h3">Kitchen equipment</Txt>
          <View style={styles.chipWrap}>
            {EQUIPMENT.map((equipment) => (
              <Chip
                key={equipment}
                label={equipmentLabels[equipment]}
                selected={draft.equipment.includes(equipment)}
                onPress={() => patch({ equipment: toggle(draft.equipment, equipment) })}
              />
            ))}
          </View>
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Txt variant="h3">Cooking time</Txt>
          <View style={styles.chipWrap}>
            {COOKING_TIMES.map((option) => (
              <Chip
                key={option.id}
                label={`${option.label} · ${option.hint}`}
                selected={draft.cookingTime === option.id}
                onPress={() => patch({ cookingTime: option.id })}
              />
            ))}
          </View>
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Txt variant="h3">Meals you plan</Txt>
          <View style={styles.chipWrap}>
            {mealSlotOrder.map((slot: MealSlot) => (
              <Chip
                key={slot}
                label={mealSlotLabels[slot]}
                selected={draft.mealTypes.includes(slot)}
                onPress={() =>
                  patch({
                    mealTypes: draft.mealTypes.includes(slot)
                      ? draft.mealTypes.filter((item) => item !== slot)
                      : [...draft.mealTypes, slot],
                  })
                }
              />
            ))}
          </View>
          {draft.mealTypes.length === 0 ? (
            <Txt variant="tiny" color={colors.red} style={{ marginTop: spacing.sm }}>
              Select at least one meal type.
            </Txt>
          ) : null}
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Txt variant="h3">Weekly budget</Txt>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Field
                label="Daily (₹)"
                value={`${draft.budget.daily}`}
                keyboardType="number-pad"
                onChangeText={(text) =>
                  patch({ budget: { ...draft.budget, daily: Number(text.replace(/[^0-9]/g, '')) || 0 } })
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Weekly (₹)"
                value={`${draft.budget.weekly}`}
                keyboardType="number-pad"
                onChangeText={(text) =>
                  patch({ budget: { ...draft.budget, weekly: Number(text.replace(/[^0-9]/g, '')) || 0 } })
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Monthly (₹)"
                value={`${draft.budget.monthly}`}
                keyboardType="number-pad"
                onChangeText={(text) =>
                  patch({ budget: { ...draft.budget, monthly: Number(text.replace(/[^0-9]/g, '')) || 0 } })
                }
              />
            </View>
          </View>
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Txt variant="h3">Delivery location</Txt>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Field label="City" value={draft.city} onChangeText={(text) => patch({ city: text })} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="State" value={draft.state} onChangeText={(text) => patch({ state: text })} />
            </View>
          </View>
          <Field label="Locality" value={draft.locality} onChangeText={(text) => patch({ locality: text })} />
          <Field
            label="PIN code"
            value={draft.pincode}
            onChangeText={(text) => patch({ pincode: text.replace(/[^0-9]/g, '').slice(0, 6) })}
            keyboardType="number-pad"
            error={error ?? undefined}
            helper="Used only for serviceability checks. Retailer delivery is confirmed with the retailer."
          />
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Txt variant="h3">Language</Txt>
          <View style={styles.chipWrap}>
            <Chip label="English" selected={draft.language === 'en'} onPress={() => patch({ language: 'en' })} />
            <Chip label="हिंदी (beta)" selected={draft.language === 'hi'} onPress={() => patch({ language: 'hi' })} />
          </View>
        </Card>

        {saved ? (
          <View style={{ marginTop: spacing.lg }}>
            <InfoBanner tone="mint" message="Preferences saved." icon={<Check size={16} color={colors.forest} />} />
          </View>
        ) : null}

        <Button
          label="Save preferences"
          style={{ marginTop: spacing.lg }}
          disabled={draft.mealTypes.length === 0}
          onPress={save}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Token({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <View style={styles.token}>
      <Txt variant="tiny" color={colors.forest} style={{ fontWeight: '600' }}>
        {label}
      </Txt>
      <X size={12} color={colors.forest} onPress={onRemove} />
    </View>
  );
}

const styles = StyleSheet.create({
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  token: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.mint,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
});
