import { Platform } from 'react-native';

export const colors = {
  forest: '#354633',
  forestDeep: '#202C22',
  forestSoft: '#596A50',
  mint: '#E4E9DC',
  mintStrong: '#B7C3A7',
  mintPale: '#F0F2E9',
  cream: '#F8F5EC',
  creamDeep: '#EEE9DC',
  white: '#FFFFFF',
  ink: '#242820',
  inkSoft: '#62675C',
  inkFaint: '#929487',
  line: '#E3E0D6',
  lineSoft: '#ECE9E0',
  orange: '#B85F43',
  orangeSoft: '#F4E5DC',
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
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
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
    shadowOpacity: 0.035,
    shadowRadius: 8,
    elevation: 1,
  },
  raised: {
    shadowColor: '#0C3B2E',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 2,
  },
} as const;

export { categoryLabels, categoryOrder } from '@/lib/categories';

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
