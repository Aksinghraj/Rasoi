import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChefHat,
  Flame,
  Heart,
  Home,
  MapPin,
  Plus,
  ShieldAlert,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react-native';
import { useApp } from '@/lib/store/AppContext';
import {
  Button,
  Chip,
  Field,
  InfoBanner,
  ProgressBar,
  Stepper,
  Txt,
} from '@/components/ui';
import { colors, radius, spacing } from '@/lib/theme';
import {
  allergenLabels,
  dietLabels,
  equipmentLabels,
  mealSlotLabels,
  restrictionLabels,
} from '@/lib/theme';
import {
  DietType,
  EquipmentId,
  HouseholdMember,
  MealSlot,
  Preferences,
  RestrictionId,
} from '@/lib/types';
import { isValidPincode } from '@/lib/format';

const STEPS = [
  { key: 'about', title: 'Let’s get to know you', icon: Heart },
  { key: 'location', title: 'Where should groceries arrive?', icon: MapPin },
  { key: 'household', title: 'Who are we cooking for?', icon: Users },
  { key: 'diet', title: 'How do you eat?', icon: Heart },
  { key: 'dietary', title: 'Any dietary requirements?', icon: ShieldAlert },
  { key: 'allergens', title: 'Allergies & safety', icon: ShieldAlert },
  { key: 'dislikes', title: 'What should we skip?', icon: ChefHat },
  { key: 'budget', title: 'Set your food budget', icon: Wallet },
  { key: 'meals', title: 'Your weekly rhythm', icon: Home },
  { key: 'review', title: 'Review your kitchen', icon: Check },
];

const LOCATIONS: Record<string, string[]> = {
  Karnataka: ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi'],
  Maharashtra: ['Mumbai', 'Pune', 'Nagpur', 'Nashik'],
  Delhi: ['New Delhi', 'South Delhi', 'Dwarka'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli'],
  Telangana: ['Hyderabad', 'Warangal', 'Secunderabad'],
  'West Bengal': ['Kolkata', 'Howrah', 'Siliguri'],
  Gujarat: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot'],
  Rajasthan: ['Jaipur', 'Jodhpur', 'Udaipur'],
  Punjab: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Chandigarh'],
  Kerala: ['Kochi', 'Thiruvananthapuram', 'Kozhikode'],
  'Uttar Pradesh': ['Lucknow', 'Noida', 'Kanpur', 'Varanasi'],
  Haryana: ['Gurugram', 'Faridabad', 'Panipat'],
};

const REGIONS = [
  'North Indian',
  'South Indian',
  'Punjabi',
  'Maharashtrian',
  'Gujarati',
  'Bengali',
  'Hyderabadi',
  'Rajasthani',
  'Kashmiri',
  'Street Food',
  'Healthy',
];

const ALLERGENS = ['peanuts', 'tree_nuts', 'milk', 'wheat', 'eggs', 'fish', 'shellfish', 'mustard', 'sesame', 'soy'];

const COMMON_EXCLUSIONS = [
  { id: 'peanuts', label: 'Peanuts' },
  { id: 'cashew', label: 'Cashews' },
  { id: 'almond', label: 'Almonds' },
  { id: 'paneer', label: 'Paneer' },
  { id: 'milk', label: 'Milk' },
  { id: 'curd', label: 'Curd' },
  { id: 'egg', label: 'Eggs' },
  { id: 'fish', label: 'Fish' },
  { id: 'prawn', label: 'Prawns' },
  { id: 'atta', label: 'Wheat flour' },
  { id: 'maida', label: 'Maida' },
  { id: 'sesame', label: 'Sesame' },
];

const DISLIKES = [
  { id: 'brinjal', label: 'Brinjal' },
  { id: 'okra', label: 'Okra' },
  { id: 'cauliflower', label: 'Cauliflower' },
  { id: 'spinach', label: 'Spinach' },
  { id: 'peas', label: 'Peas' },
  { id: 'carrot', label: 'Carrot' },
  { id: 'beans', label: 'Beans' },
  { id: 'bell_pepper', label: 'Capsicum' },
  { id: 'coriander', label: 'Coriander' },
  { id: 'coconut', label: 'Coconut' },
  { id: 'garlic', label: 'Garlic' },
  { id: 'onion', label: 'Onion' },
];

const DIET_OPTIONS: { id: DietType; title: string; description: string }[] = [
  { id: 'vegetarian', title: 'Vegetarian', description: 'No meat, fish or eggs' },
  { id: 'vegan', title: 'Vegan', description: 'No animal products at all' },
  { id: 'eggetarian', title: 'Eggetarian', description: 'Vegetarian plus eggs' },
  { id: 'non_vegetarian', title: 'Non-vegetarian', description: 'Everything on the table' },
  { id: 'pescatarian', title: 'Pescatarian', description: 'Vegetarian plus fish and seafood' },
  { id: 'jain', title: 'Jain', description: 'No root vegetables, onion or garlic' },
];

const EQUIPMENT: EquipmentId[] = [
  'gas_stove',
  'induction',
  'pressure_cooker',
  'rice_cooker',
  'mixer_grinder',
  'oven',
  'air_fryer',
  'microwave',
];

export default function OnboardingScreen() {
  const { state, completeOnboarding } = useApp();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(state.user?.name && state.user.name !== 'Rasoi cook' ? state.user.name : '');
  const [location, setLocation] = useState({ state: 'Karnataka', city: 'Bengaluru', pincode: '', locality: '' });
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [servings, setServings] = useState(2);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [diet, setDiet] = useState<DietType>('vegetarian');
  const [region, setRegion] = useState('South Indian');
  const [restrictions, setRestrictions] = useState<RestrictionId[]>([]);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<EquipmentId[]>(['gas_stove', 'mixer_grinder']);
  const [daily, setDaily] = useState('600');
  const [weekly, setWeekly] = useState('4000');
  const [monthly, setMonthly] = useState('16000');
  const [mealTypes, setMealTypes] = useState<MealSlot[]>(['breakfast', 'lunch', 'dinner']);
  const [cookingTime, setCookingTime] = useState<Preferences['cookingTime']>('balanced');
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const current = STEPS[step];
  const progress = (step + 1) / STEPS.length;

  const toggle = <T,>(list: T[], value: T, setter: (next: T[]) => void) => {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  const validate = (): string | null => {
    if (step === 0 && name.trim().length < 2) return 'Tell us what we should call you.';
    if (step === 1) {
      if (!isValidPincode(location.pincode)) return 'Enter a valid six-digit PIN code.';
      if (location.locality.trim().length < 2) return 'Add your locality so delivery estimates make sense.';
    }
    if (step === 2 && adults + children < 1) return 'Add at least one person to the household.';
    if (step === 2 && servings < 1) return 'Default servings must be at least one.';
    if (step === 6 && equipment.length === 0) return 'Select at least one cooking appliance.';
    if (step === 7) {
      const dailyValue = Number(daily);
      const weeklyValue = Number(weekly);
      const monthlyValue = Number(monthly);
      if (!dailyValue || dailyValue <= 0) return 'Enter a daily food budget.';
      if (!weeklyValue || weeklyValue <= 0) return 'Enter a weekly grocery budget.';
      if (!monthlyValue || monthlyValue <= 0) return 'Enter a monthly grocery budget.';
      if (weeklyValue < dailyValue * 3) return 'Weekly budget looks too low against the daily budget.';
      if (monthlyValue < weeklyValue * 2) return 'Monthly budget should cover at least a few weeks.';
    }
    if (step === 8 && mealTypes.length === 0) return 'Choose at least one meal to plan.';
    return null;
  };

  const next = async () => {
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    if (step < STEPS.length - 1) {
      setStep((value) => value + 1);
      return;
    }
    setBusy(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const preferences: Preferences = {
      country: 'India',
      state: location.state,
      city: location.city,
      pincode: location.pincode,
      locality: location.locality.trim(),
      diet,
      region,
      restrictions,
      allergens,
      customExclusions: exclusions,
      dislikes,
      equipment,
      budget: { daily: Number(daily), weekly: Number(weekly), monthly: Number(monthly) },
      mealTypes,
      cookingTime,
      planDay: 'monday',
      language,
    };
    await completeOnboarding({
      name: name.trim(),
      household: { adults, children, defaultServings: servings, members },
      preferences,
    });
    setBusy(false);
    router.replace('/(tabs)');
  };

  const back = () => {
    setError(null);
    if (step === 0) return;
    setStep((value) => value - 1);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            {step > 0 ? (
              <Pressable onPress={back} style={styles.back} accessibilityLabel="Previous step">
                <ArrowLeft size={18} color={colors.ink} />
              </Pressable>
            ) : (
              <View style={styles.brandDot}>
                <ChefHat size={16} color={colors.mint} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Txt variant="tiny" color={colors.inkFaint} style={{ fontWeight: '700' }}>
                STEP {step + 1} OF {STEPS.length}
              </Txt>
              <Txt variant="h3" numberOfLines={1}>
                {current.title}
              </Txt>
            </View>
            <Txt variant="small" color={colors.forest} style={{ fontWeight: '800' }}>
              rasoi.
            </Txt>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <ProgressBar value={progress} height={6} />
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 0 ? (
            <View>
              <Txt variant="h1">What should we call you?</Txt>
              <Txt variant="small" color={colors.inkSoft} style={{ marginTop: 6 }}>
                This is your kitchen profile. You can add family members later.
              </Txt>
              <View style={{ height: spacing.xl }} />
              <Field
                label="Your name"
                placeholder="e.g. Ananya"
                autoCapitalize="words"
                value={name}
                onChangeText={setName}
                error={error ?? undefined}
              />
              <Txt variant="label" color={colors.inkSoft} style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
                App language
              </Txt>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Chip label="English" selected={language === 'en'} onPress={() => setLanguage('en')} />
                <Chip label="हिंदी (beta)" selected={language === 'hi'} onPress={() => setLanguage('hi')} />
              </View>
              <View style={{ height: spacing.lg }} />
              <InfoBanner
                message="Rasoi is built for Indian households: Indian recipes, INR pricing, metric quantities and regional cuisines. Hindi labels roll out progressively."
                tone="mint"
              />
            </View>
          ) : null}

          {step === 1 ? (
            <View>
              <Txt variant="h1">Where should groceries arrive?</Txt>
              <Txt variant="small" color={colors.inkSoft} style={{ marginTop: 6 }}>
                We use this for serviceability, delivery estimates and regional produce.
              </Txt>
              <View style={{ height: spacing.xl }} />
              <Txt variant="label" color={colors.inkSoft} style={{ marginBottom: spacing.sm }}>
                State
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
                {Object.keys(LOCATIONS).map((stateName) => (
                  <Chip
                    key={stateName}
                    label={stateName}
                    selected={location.state === stateName}
                    onPress={() =>
                      setLocation({
                        ...location,
                        state: stateName,
                        city: LOCATIONS[stateName][0],
                      })
                    }
                  />
                ))}
              </View>
              <Txt variant="label" color={colors.inkSoft} style={{ marginBottom: spacing.sm }}>
                City
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
                {(LOCATIONS[location.state] ?? []).map((city) => (
                  <Chip
                    key={city}
                    label={city}
                    selected={location.city === city}
                    onPress={() => setLocation({ ...location, city })}
                  />
                ))}
              </View>
              <Field
                label="PIN code"
                placeholder="560102"
                keyboardType="number-pad"
                maxLength={6}
                value={location.pincode}
                onChangeText={(value) => setLocation({ ...location, pincode: value.replace(/[^0-9]/g, '') })}
              />
              <Field
                label="Delivery locality"
                placeholder="e.g. HSR Layout, Sector 2"
                value={location.locality}
                onChangeText={(value) => setLocation({ ...location, locality: value })}
              />
              {error ? <Txt variant="small" color={colors.red}>{error}</Txt> : null}
              <InfoBanner
                message="PIN code is stored on your device in this demo. Production should store addresses encrypted and share only what a retailer needs."
                tone="neutral"
              />
            </View>
          ) : null}

          {step === 2 ? (
            <View>
              <Txt variant="h1">Who are we cooking for?</Txt>
              <Txt variant="small" color={colors.inkSoft} style={{ marginTop: 6 }}>
                Quantities and grocery baskets scale from your household.
              </Txt>
              <View style={{ height: spacing.xl }} />
              <View style={styles.householdRow}>
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong">Adults</Txt>
                  <Txt variant="tiny" color={colors.inkSoft}>
                    Grown-ups at the table
                  </Txt>
                </View>
                <Stepper value={adults} onChange={setAdults} min={0} max={12} label="adults" />
              </View>
              <View style={styles.householdRow}>
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong">Children</Txt>
                  <Txt variant="tiny" color={colors.inkSoft}>
                    Under 12 years
                  </Txt>
                </View>
                <Stepper value={children} onChange={setChildren} min={0} max={10} label="children" />
              </View>
              <View style={styles.householdRow}>
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong">Default servings</Txt>
                  <Txt variant="tiny" color={colors.inkSoft}>
                    Used when planning each meal
                  </Txt>
                </View>
                <Stepper value={servings} onChange={setServings} min={1} max={20} label="servings" />
              </View>
              <View style={{ height: spacing.md }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Txt variant="h3">Family members (optional)</Txt>
                <Pressable
                  onPress={() =>
                    setMembers([
                      ...members,
                      { id: `member_${Date.now()}`, name: '', ageGroup: 'adult' },
                    ])
                  }
                  style={styles.addMember}
                >
                  <Plus size={14} color={colors.forest} />
                  <Txt variant="tiny" color={colors.forest} style={{ fontWeight: '700' }}>
                    Add
                  </Txt>
                </Pressable>
              </View>
              {members.length === 0 ? (
                <Txt variant="small" color={colors.inkFaint} style={{ marginTop: spacing.sm }}>
                  Add names if you want personal preferences later. You can skip this.
                </Txt>
              ) : null}
              {members.map((member, index) => (
                <View key={member.id} style={styles.memberRow}>
                  <Field
                    placeholder={`Member ${index + 1} name`}
                    value={member.name}
                    onChangeText={(value) =>
                      setMembers(members.map((item) => (item.id === member.id ? { ...item, name: value } : item)))
                    }
                    style={{ marginBottom: 0 }}
                  />
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <Chip
                      label="Adult"
                      selected={member.ageGroup === 'adult'}
                      onPress={() =>
                        setMembers(members.map((item) => (item.id === member.id ? { ...item, ageGroup: 'adult' } : item)))
                      }
                    />
                    <Chip
                      label="Child"
                      selected={member.ageGroup === 'child'}
                      onPress={() =>
                        setMembers(members.map((item) => (item.id === member.id ? { ...item, ageGroup: 'child' } : item)))
                      }
                    />
                    <Pressable onPress={() => setMembers(members.filter((item) => item.id !== member.id))} hitSlop={8}>
                      <Trash2 size={17} color={colors.red} />
                    </Pressable>
                  </View>
                </View>
              ))}
              {error ? <Txt variant="small" color={colors.red} style={{ marginTop: spacing.md }}>{error}</Txt> : null}
            </View>
          ) : null}

          {step === 3 ? (
            <View>
              <Txt variant="h1">How do you eat?</Txt>
              <Txt variant="small" color={colors.inkSoft} style={{ marginTop: 6 }}>
                This filters every recipe recommendation. You can change it any time.
              </Txt>
              <View style={{ height: spacing.lg }} />
              {DIET_OPTIONS.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => setDiet(option.id)}
                  style={[styles.choice, diet === option.id && styles.choiceActive]}
                >
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyStrong">{option.title}</Txt>
                    <Txt variant="small" color={colors.inkSoft}>
                      {option.description}
                    </Txt>
                  </View>
                  <View style={[styles.radio, diet === option.id && styles.radioActive]}>
                    {diet === option.id ? <Check size={13} color={colors.white} /> : null}
                  </View>
                </Pressable>
              ))}
              <View style={{ height: spacing.lg }} />
              <Txt variant="label" color={colors.inkSoft} style={{ marginBottom: spacing.sm }}>
                Regional food you love
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {REGIONS.map((item) => (
                  <Chip key={item} label={item} selected={region === item} onPress={() => setRegion(item)} />
                ))}
              </View>
            </View>
          ) : null}

          {step === 4 ? (
            <View>
              <Txt variant="h1">Any dietary requirements?</Txt>
              <Txt variant="small" color={colors.inkSoft} style={{ marginTop: 6 }}>
                These guide nutrition and ingredient choices. Allergies are handled separately as safety rules.
              </Txt>
              <View style={{ height: spacing.lg }} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {(Object.keys(restrictionLabels) as RestrictionId[]).map((restriction) => (
                  <Chip
                    key={restriction}
                    label={restrictionLabels[restriction]}
                    selected={restrictions.includes(restriction)}
                    onPress={() => toggle(restrictions, restriction, setRestrictions)}
                  />
                ))}
              </View>
              <View style={{ height: spacing.xl }} />
              <InfoBanner
                title="Nothing is a diagnosis"
                message="Rasoi helps you plan meals but does not replace medical or dietetic advice. Nutrition values are per serving estimates."
                tone="neutral"
              />
            </View>
          ) : null}

          {step === 5 ? (
            <View>
              <Txt variant="h1">Allergies & safety</Txt>
              <Txt variant="small" color={colors.inkSoft} style={{ marginTop: 6 }}>
                We treat these as hard safety constraints — never as soft preferences.
              </Txt>
              <View style={{ height: spacing.lg }} />
              <InfoBanner
                title="Safety first"
                message="Recipes containing a selected allergen are excluded from recommendations and never silently substituted. Always check product labels before cooking or eating."
                tone="orange"
                icon={<ShieldAlert size={16} color={colors.orange} />}
              />
              <View style={{ height: spacing.lg }} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {ALLERGENS.map((allergen) => (
                  <Chip
                    key={allergen}
                    label={allergenLabels[allergen] ?? allergen}
                    selected={allergens.includes(allergen)}
                    onPress={() => toggle(allergens, allergen, setAllergens)}
                    tone="orange"
                  />
                ))}
              </View>
              <View style={{ height: spacing.xl }} />
              <Txt variant="h3">Custom ingredient exclusions</Txt>
              <Txt variant="small" color={colors.inkSoft} style={{ marginTop: 2, marginBottom: spacing.sm }}>
                For anything not covered above.
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {COMMON_EXCLUSIONS.map((item) => (
                  <Chip
                    key={item.id}
                    label={item.label}
                    selected={exclusions.includes(item.id)}
                    onPress={() => toggle(exclusions, item.id, setExclusions)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {step === 6 ? (
            <View>
              <Txt variant="h1">What should we skip?</Txt>
              <Txt variant="small" color={colors.inkSoft} style={{ marginTop: 6 }}>
                Dislikes are soft filters: we avoid them but do not treat them as unsafe.
              </Txt>
              <View style={{ height: spacing.lg }} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {DISLIKES.map((item) => (
                  <Chip
                    key={item.id}
                    label={item.label}
                    selected={dislikes.includes(item.id)}
                    onPress={() => toggle(dislikes, item.id, setDislikes)}
                  />
                ))}
              </View>
              <View style={{ height: spacing.xl }} />
              <Txt variant="h3" style={{ marginBottom: spacing.sm }}>
                Kitchen equipment
              </Txt>
              <Txt variant="small" color={colors.inkSoft} style={{ marginBottom: spacing.md }}>
                Recipes that need equipment you do not have are hidden.
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {EQUIPMENT.map((item) => (
                  <Chip
                    key={item}
                    label={equipmentLabels[item]}
                    selected={equipment.includes(item)}
                    onPress={() => toggle(equipment, item, setEquipment)}
                  />
                ))}
              </View>
              {error ? <Txt variant="small" color={colors.red} style={{ marginTop: spacing.md }}>{error}</Txt> : null}
            </View>
          ) : null}

          {step === 7 ? (
            <View>
              <Txt variant="h1">Set your food budget</Txt>
              <Txt variant="small" color={colors.inkSoft} style={{ marginTop: 6 }}>
                We use budgets to suggest realistic meals and flag plans that overshoot.
              </Txt>
              <View style={{ height: spacing.lg }} />
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
                <Chip
                  label="Value"
                  onPress={() => {
                    setDaily('350');
                    setWeekly('2400');
                    setMonthly('9500');
                  }}
                />
                <Chip
                  label="Balanced"
                  onPress={() => {
                    setDaily('600');
                    setWeekly('4000');
                    setMonthly('16000');
                  }}
                />
                <Chip
                  label="Comfort"
                  onPress={() => {
                    setDaily('900');
                    setWeekly('6000');
                    setMonthly('24000');
                  }}
                />
              </View>
              <Field
                label="Daily food budget (₹)"
                keyboardType="number-pad"
                value={daily}
                onChangeText={(value) => setDaily(value.replace(/[^0-9]/g, ''))}
              />
              <Field
                label="Weekly grocery budget (₹)"
                keyboardType="number-pad"
                value={weekly}
                onChangeText={(value) => setWeekly(value.replace(/[^0-9]/g, ''))}
              />
              <Field
                label="Monthly grocery budget (₹)"
                keyboardType="number-pad"
                value={monthly}
                onChangeText={(value) => setMonthly(value.replace(/[^0-9]/g, ''))}
                helper="Estimates use the demo catalogue. Final prices are always retailer-controlled."
              />
              {error ? <Txt variant="small" color={colors.red}>{error}</Txt> : null}
            </View>
          ) : null}

          {step === 8 ? (
            <View>
              <Txt variant="h1">Your weekly rhythm</Txt>
              <Txt variant="small" color={colors.inkSoft} style={{ marginTop: 6 }}>
                Which meals should we plan, and how much time do you have?
              </Txt>
              <View style={{ height: spacing.lg }} />
              <Txt variant="label" color={colors.inkSoft} style={{ marginBottom: spacing.sm }}>
                Meals to plan
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {(Object.keys(mealSlotLabels) as MealSlot[]).map((slot) => (
                  <Chip
                    key={slot}
                    label={mealSlotLabels[slot]}
                    selected={mealTypes.includes(slot)}
                    onPress={() => toggle(mealTypes, slot, setMealTypes)}
                  />
                ))}
              </View>
              <View style={{ height: spacing.xl }} />
              <Txt variant="label" color={colors.inkSoft} style={{ marginBottom: spacing.sm }}>
                Cooking time on weekdays
              </Txt>
              <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                <Chip label="Quick (≤30 min)" selected={cookingTime === 'quick'} onPress={() => setCookingTime('quick')} />
                <Chip label="Balanced (≤50 min)" selected={cookingTime === 'balanced'} onPress={() => setCookingTime('balanced')} />
                <Chip label="Relaxed (no limit)" selected={cookingTime === 'relaxed'} onPress={() => setCookingTime('relaxed')} />
              </View>
              {error ? <Txt variant="small" color={colors.red} style={{ marginTop: spacing.md }}>{error}</Txt> : null}
            </View>
          ) : null}

          {step === 9 ? (
            <View>
              <Txt variant="h1">Ready to plan your week?</Txt>
              <Txt variant="small" color={colors.inkSoft} style={{ marginTop: 6 }}>
                Here is what we will use. You can change all of it later.
              </Txt>
              <View style={{ height: spacing.lg }} />
              <View style={styles.summary}>
                <SummaryRow label="Cook" value={name.trim() || 'Your kitchen'} />
                <SummaryRow label="Household" value={`${adults} adult${adults === 1 ? '' : 's'}, ${children} child${children === 1 ? '' : 'ren'}`} />
                <SummaryRow label="Location" value={`${location.locality}, ${location.city} ${location.pincode}`} />
                <SummaryRow label="Diet" value={dietLabels[diet]} />
                <SummaryRow label="Region" value={region} />
                <SummaryRow label="Allergies" value={allergens.length ? allergens.map((a) => allergenLabels[a] ?? a).join(', ') : 'None declared'} />
                <SummaryRow label="Equipment" value={equipment.map((item) => equipmentLabels[item]).join(', ')} />
                <SummaryRow label="Budget" value={`₹${daily}/day · ₹${weekly}/week`} />
                <SummaryRow label="Meals" value={mealTypes.map((slot) => mealSlotLabels[slot]).join(', ')} />
              </View>
              <View style={{ height: spacing.lg }} />
              <InfoBanner
                message="We will generate a first week of meals from these preferences. Nothing is ordered and no payment is taken."
                tone="mint"
              />
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {error && step !== 0 ? (
            <Txt variant="tiny" color={colors.red} style={{ marginBottom: spacing.sm }}>
              {error}
            </Txt>
          ) : null}
          <Button
            label={step === STEPS.length - 1 ? 'Create my kitchen' : 'Continue'}
            onPress={next}
            loading={busy}
            icon={<ArrowRight size={17} color={colors.white} />}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Txt variant="tiny" color={colors.inkFaint} style={{ fontWeight: '700', width: 92 }}>
        {label.toUpperCase()}
      </Txt>
      <Txt variant="small" color={colors.ink} style={{ flex: 1 }}>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.cream,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  brandDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.cream,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    marginBottom: spacing.sm,
  },
  choiceActive: { borderColor: colors.forest, backgroundColor: colors.mintPale },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { backgroundColor: colors.forest, borderColor: colors.forest },
  householdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  addMember: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.mint,
  },
  memberRow: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.sm,
  },
  summary: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  summaryRow: { flexDirection: 'row', gap: spacing.sm },
});
