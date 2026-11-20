import { Platform } from 'react-native';

export const colors = {
  forest: '#0C3B2E',
  forestDeep: '#07261D',
  forestSoft: '#1B5A45',
  mint: '#DDF3E7',
  mintStrong: '#9EDFC3',
  mintPale: '#EFF9F3',
  cream: '#FBF7EE',
  creamDeep: '#F3ECDD',
  white: '#FFFFFF',
  ink: '#15211B',
  inkSoft: '#55655C',
  inkFaint: '#8A968E',
  line: '#E4E7E1',
  lineSoft: '#EEF0EB',
  orange: '#E87A32',
  orangeSoft: '#FCE8D8',
  red: '#BC4238',
  redSoft: '#FBE6E3',
  yellow: '#F2C14E',
  yellowSoft: '#FBF0D3',
  blue: '#3C6E8F',
  blueSoft: '#E5EFF5',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999,
} as const;

export const fonts = {
  regular: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
  medium: Platform.select({ ios: 'System', android: 'sans-serif-medium', default: 'System' }),
  bold: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
} as const;

export const shadow = {
  card: {
    shadowColor: '#0C3B2E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 2,
  },
  raised: {
    shadowColor: '#0C3B2E',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 5,
  },
} as const;

export const categoryLabels: Record<string, string> = {
  vegetables: 'Vegetables',
  fruits: 'Fruits',
  dairy: 'Dairy & eggs',
  grains: 'Grains & flour',
  pulses: 'Pulses & legumes',
  spices: 'Spices & condiments',
  meat_seafood: 'Meat & seafood',
  frozen: 'Frozen food',
  snacks: 'Snacks',
  household: 'Household essentials',
  other: 'Other items',
};

export const categoryOrder = [
  'vegetables',
  'fruits',
  'dairy',
  'grains',
  'pulses',
  'spices',
  'meat_seafood',
  'frozen',
  'snacks',
  'household',
  'other',
] as const;

export const mealSlotLabels = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
} as const;

export const mealSlotOrder = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export const dietLabels: Record<string, string> = {
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  eggetarian: 'Eggetarian',
  non_vegetarian: 'Non-vegetarian',
  pescatarian: 'Pescatarian',
  jain: 'Jain',
};

export const equipmentLabels: Record<string, string> = {
  gas_stove: 'Gas stove',
  induction: 'Induction',
  oven: 'Oven',
  microwave: 'Microwave',
  air_fryer: 'Air fryer',
  pressure_cooker: 'Pressure cooker',
  rice_cooker: 'Rice cooker',
  mixer_grinder: 'Mixer grinder',
};

export const restrictionLabels: Record<string, string> = {
  gluten_free: 'Gluten-free',
  dairy_free: 'Dairy-free',
  low_carb: 'Low-carb',
  high_protein: 'High-protein',
  low_sodium: 'Low-sodium',
  nut_free: 'Nut-free',
};

export const allergenLabels: Record<string, string> = {
  peanuts: 'Peanuts',
  tree_nuts: 'Tree nuts',
  milk: 'Milk',
  soy: 'Soy',
  wheat: 'Wheat / gluten',
  eggs: 'Eggs',
  fish: 'Fish',
  shellfish: 'Shellfish',
  sesame: 'Sesame',
  mustard: 'Mustard',
};

export const difficultyLabels: Record<string, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Advanced',
};
