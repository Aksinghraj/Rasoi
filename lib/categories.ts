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
