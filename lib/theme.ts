import { Platform } from 'react-native';

export const colors = {
  forest: '#2F3A2A',
  forestDeep: '#1E261B',
  forestSoft: '#4A5741',
  olive: '#2F3A2A',
  oliveDeep: '#1E261B',
  oliveSoft: '#4A5741',
  mint: '#DDE6D3',
  mintStrong: '#A9BF98',
  mintPale: '#EDF1E4',
  cream: '#F7F2E7',
  creamDeep: '#EDE5D4',
  ivory: '#F7F2E7',
  paper: '#FFFDF8',
  white: '#FFFDF8',
  ink: '#1F241C',
  inkSoft: '#5B6254',
  inkFaint: '#8D9384',
  line: '#DED8C8',
  lineSoft: '#EAE4D6',
  terracotta: '#B4552F',
  terracottaSoft: '#F4E2D6',
  orange: '#B4552F',
  orangeSoft: '#F4E2D6',
  red: '#A63D32',
  redSoft: '#F6E1DC',
  yellow: '#C99A3E',
  yellowSoft: '#F5EBD2',
  blue: '#46687A',
  blueSoft: '#E6EDF0',
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
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
} as const;

export const shadow = {
  card: {
    shadowColor: '#1E261B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  raised: {
    shadowColor: '#1E261B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
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
