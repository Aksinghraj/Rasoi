import { Ingredient } from '@/lib/types';

const i = (
  id: string,
  name: string,
  category: Ingredient['category'],
  dimension: Ingredient['dimension'],
  pricePerBase: number,
  extras: Partial<Ingredient> = {},
): Ingredient => ({
  id,
  name,
  category,
  dimension,
  pricePerBase,
  aliases: [],
  allergens: [],
  ...extras,
});

export const ingredients: Ingredient[] = [
  // Grains & flour
  i('atta', 'Whole wheat atta', 'grains', 'weight', 0.058, {
    aliases: ['wheat flour', 'gehun atta', 'chapati flour'],
    allergens: ['wheat'],
    density: 0.55,
    staple: true,
  }),
  i('maida', 'Refined flour (maida)', 'grains', 'weight', 0.052, {
    aliases: ['all purpose flour', 'plain flour'],
    allergens: ['wheat'],
    density: 0.53,
    staple: true,
  }),
  i('rice', 'Rice (sona masoori)', 'grains', 'weight', 0.062, {
    aliases: ['chawal', 'raw rice', 'white rice'],
    density: 0.85,
    staple: true,
  }),
  i('basmati_rice', 'Basmati rice', 'grains', 'weight', 0.135, {
    aliases: ['basmati chawal', 'long grain rice'],
    density: 0.85,
    staple: true,
  }),
  i('poha', 'Poha (flattened rice)', 'grains', 'weight', 0.065, {
    aliases: ['aval', 'flattened rice', 'beaten rice'],
    density: 0.3,
    staple: true,
  }),
  i('oats', 'Rolled oats', 'grains', 'weight', 0.145, {
    aliases: ['oatmeal', 'jau'],
    allergens: ['wheat'],
    density: 0.4,
  }),
  i('rava', 'Rava (semolina)', 'grains', 'weight', 0.062, {
    aliases: ['sooji', 'semolina'],
    allergens: ['wheat'],
    density: 0.7,
    staple: true,
  }),
  i('besan', 'Besan (gram flour)', 'grains', 'weight', 0.095, {
    aliases: ['gram flour', 'chickpea flour'],
    density: 0.6,
    staple: true,
  }),
  i('idli_batter', 'Idli batter (fresh)', 'grains', 'weight', 0.075, {
    aliases: ['idli dosa batter', 'fermented rice batter'],
    density: 0.9,
  }),
  i('bread', 'Whole wheat bread', 'grains', 'piece', 3.2, {
    aliases: ['pav', 'sandwich bread', 'toast'],
    allergens: ['wheat'],
    pieceGrams: 30,
  }),

  // Dairy & eggs
  i('paneer', 'Paneer', 'dairy', 'weight', 0.39, {
    aliases: ['cottage cheese', 'indian cheese'],
    allergens: ['milk'],
    density: 1.02,
    staple: true,
  }),
  i('milk', 'Toned milk', 'dairy', 'volume', 0.07, {
    aliases: ['doodh', 'full cream milk'],
    allergens: ['milk'],
    density: 1.03,
    staple: true,
  }),
  i('curd', 'Curd (dahi)', 'dairy', 'weight', 0.095, {
    aliases: ['yogurt', 'dahi', 'yoghurt'],
    allergens: ['milk'],
    density: 1.03,
    staple: true,
  }),
  i('ghee', 'Ghee', 'dairy', 'weight', 0.68, {
    aliases: ['clarified butter', 'desi ghee'],
    allergens: ['milk'],
    density: 0.92,
    staple: true,
  }),
  i('butter', 'Butter', 'dairy', 'weight', 0.56, {
    aliases: ['makhan', 'salted butter'],
    allergens: ['milk'],
    density: 0.91,
  }),
  i('cream', 'Fresh cream', 'dairy', 'volume', 0.26, {
    aliases: ['malai', 'heavy cream', 'cooking cream'],
    allergens: ['milk'],
    density: 0.99,
  }),
  i('cheese', 'Cheese slices', 'dairy', 'weight', 0.46, {
    aliases: ['processed cheese', 'cheddar'],
    allergens: ['milk'],
  }),
  i('egg', 'Eggs', 'dairy', 'piece', 7.5, {
    aliases: ['anda', 'hen egg'],
    allergens: ['eggs'],
    pieceGrams: 50,
  }),

  // Vegetables
  i('onion', 'Onion', 'vegetables', 'weight', 0.036, {
    aliases: ['pyaz', 'kanda'],
    pieceGrams: 120,
    staple: true,
  }),
  i('tomato', 'Tomato', 'vegetables', 'weight', 0.042, {
    aliases: ['tamatar'],
    pieceGrams: 100,
    staple: true,
  }),
  i('potato', 'Potato', 'vegetables', 'weight', 0.032, {
    aliases: ['aloo', 'batata'],
    pieceGrams: 130,
    staple: true,
  }),
  i('garlic', 'Garlic', 'vegetables', 'weight', 0.19, {
    aliases: ['lehsun', 'lasan'],
    pieceGrams: 4,
  }),
  i('ginger', 'Ginger', 'vegetables', 'weight', 0.15, {
    aliases: ['adrak', 'adrakh'],
  }),
  i('green_chilli', 'Green chilli', 'vegetables', 'weight', 0.13, {
    aliases: ['hari mirch', 'green chili'],
    pieceGrams: 5,
  }),
  i('coriander', 'Coriander leaves', 'vegetables', 'weight', 0.13, {
    aliases: ['dhania', 'cilantro', 'fresh coriander'],
  }),
  i('mint', 'Mint leaves', 'vegetables', 'weight', 0.16, {
    aliases: ['pudina'],
  }),
  i('spinach', 'Spinach', 'vegetables', 'weight', 0.052, {
    aliases: ['palak', 'baby spinach'],
  }),
  i('cauliflower', 'Cauliflower', 'vegetables', 'weight', 0.048, {
    aliases: ['gobi', 'phool gobi'],
  }),
  i('peas', 'Green peas', 'vegetables', 'weight', 0.085, {
    aliases: ['matar', 'mutter'],
  }),
  i('carrot', 'Carrot', 'vegetables', 'weight', 0.048, {
    aliases: ['gajar'],
    pieceGrams: 80,
  }),
  i('beans', 'French beans', 'vegetables', 'weight', 0.065, {
    aliases: ['green beans', 'phali'],
  }),
  i('brinjal', 'Brinjal', 'vegetables', 'weight', 0.042, {
    aliases: ['eggplant', 'baingan', 'aubergine'],
    pieceGrams: 250,
  }),
  i('okra', 'Okra', 'vegetables', 'weight', 0.055, {
    aliases: ['bhindi', 'lady finger'],
  }),
  i('bell_pepper', 'Capsicum', 'vegetables', 'weight', 0.09, {
    aliases: ['bell pepper', 'shimla mirch'],
    pieceGrams: 150,
  }),
  i('cucumber', 'Cucumber', 'vegetables', 'weight', 0.034, {
    aliases: ['kheera', 'khira'],
    pieceGrams: 200,
  }),

  // Fruits
  i('lemon', 'Lemon', 'fruits', 'piece', 5.5, {
    aliases: ['nimbu', 'lime'],
    pieceGrams: 60,
  }),
  i('mango', 'Mango', 'fruits', 'weight', 0.11, {
    aliases: ['aam', 'alphonso'],
    pieceGrams: 200,
  }),
  i('banana', 'Banana', 'fruits', 'piece', 5.5, {
    aliases: ['kela'],
    pieceGrams: 120,
  }),
  i('apple', 'Apple', 'fruits', 'weight', 0.16, {
    aliases: ['seb'],
    pieceGrams: 180,
  }),
  i('coconut', 'Fresh coconut', 'fruits', 'weight', 0.085, {
    aliases: ['nariyal', 'grated coconut'],
  }),
  i('coconut_milk', 'Coconut milk', 'fruits', 'volume', 0.23, {
    aliases: ['nariyal doodh', 'thick coconut milk'],
    density: 0.97,
  }),
  i('tamarind', 'Tamarind pulp', 'fruits', 'weight', 0.21, {
    aliases: ['imli', 'tamarind concentrate'],
    density: 1.1,
  }),

  // Pulses & legumes
  i('chana', 'Kabuli chana', 'pulses', 'weight', 0.095, {
    aliases: ['chickpeas', 'chole', 'garbanzo beans'],
    staple: true,
  }),
  i('rajma', 'Rajma (kidney beans)', 'pulses', 'weight', 0.125, {
    aliases: ['kidney beans', 'red beans'],
    staple: true,
  }),
  i('moong_dal', 'Moong dal (split)', 'pulses', 'weight', 0.115, {
    aliases: ['green gram', 'mung dal', 'yellow moong dal'],
    staple: true,
  }),
  i('toor_dal', 'Toor dal', 'pulses', 'weight', 0.135, {
    aliases: ['arhar dal', 'pigeon pea', 'tuvar dal'],
    staple: true,
  }),
  i('urad_dal', 'Urad dal', 'pulses', 'weight', 0.125, {
    aliases: ['black gram', 'urad'],
    staple: true,
  }),

  // Meat & seafood
  i('chicken', 'Chicken (curry cut)', 'meat_seafood', 'weight', 0.29, {
    aliases: ['murgh', 'chicken curry cut'],
  }),
  i('mutton', 'Mutton (curry cut)', 'meat_seafood', 'weight', 0.72, {
    aliases: ['goat meat', 'lamb'],
  }),
  i('fish', 'Rohu fish', 'meat_seafood', 'weight', 0.36, {
    aliases: ['machli', 'rohu', 'fish curry cut'],
    allergens: ['fish'],
  }),
  i('prawn', 'Prawns', 'meat_seafood', 'weight', 0.62, {
    aliases: ['shrimp', 'jhinga'],
    allergens: ['shellfish'],
  }),

  // Oils & fats
  i('oil', 'Sunflower oil', 'spices', 'volume', 0.145, {
    aliases: ['cooking oil', 'refined oil', 'tel'],
    density: 0.92,
    staple: true,
  }),
  i('mustard_oil', 'Mustard oil', 'spices', 'volume', 0.17, {
    aliases: ['sarson ka tel', 'kachi ghani mustard oil'],
    density: 0.92,
    allergens: ['mustard'],
  }),

  // Spices & condiments
  i('cumin', 'Cumin seeds', 'spices', 'weight', 0.42, {
    aliases: ['jeera', 'jeerakam'],
    density: 0.55,
    staple: true,
  }),
  i('mustard_seeds', 'Mustard seeds', 'spices', 'weight', 0.16, {
    aliases: ['rai', 'sarson'],
    density: 0.6,
    allergens: ['mustard'],
    staple: true,
  }),
  i('turmeric', 'Turmeric powder', 'spices', 'weight', 0.26, {
    aliases: ['haldi'],
    density: 0.5,
    staple: true,
  }),
  i('coriander_powder', 'Coriander powder', 'spices', 'weight', 0.31, {
    aliases: ['dhania powder'],
    density: 0.45,
    staple: true,
  }),
  i('garam_masala', 'Garam masala', 'spices', 'weight', 0.85, {
    aliases: ['garam masala powder'],
    density: 0.45,
    staple: true,
  }),
  i('chilli_powder', 'Red chilli powder', 'spices', 'weight', 0.42, {
    aliases: ['lal mirch', 'red chilli powder'],
    density: 0.5,
    staple: true,
  }),
  i('salt', 'Salt', 'spices', 'weight', 0.022, {
    aliases: ['namak', 'rock salt'],
    density: 1.2,
    staple: true,
  }),
  i('sugar', 'Sugar', 'spices', 'weight', 0.048, {
    aliases: ['cheeni', 'shakkar'],
    density: 0.85,
    staple: true,
  }),
  i('jaggery', 'Jaggery', 'spices', 'weight', 0.085, {
    aliases: ['gur', 'gud'],
    density: 0.7,
  }),
  i('bay_leaf', 'Bay leaf', 'spices', 'weight', 0.55, {
    aliases: ['tej patta', 'bay leaves'],
  }),
  i('cardamom', 'Green cardamom', 'spices', 'weight', 2.6, {
    aliases: ['elaichi', 'choti elaichi'],
    pieceGrams: 0.3,
  }),
  i('cinnamon', 'Cinnamon stick', 'spices', 'weight', 0.75, {
    aliases: ['dalchini'],
  }),
  i('cloves', 'Cloves', 'spices', 'weight', 2.1, {
    aliases: ['laung', 'lavang'],
  }),
  i('asafoetida', 'Asafoetida', 'spices', 'weight', 1.3, {
    aliases: ['hing'],
  }),
  i('kasuri_methi', 'Kasuri methi', 'spices', 'weight', 0.55, {
    aliases: ['dried fenugreek leaves'],
  }),
  i('curry_leaves', 'Curry leaves', 'spices', 'weight', 0.22, {
    aliases: ['kadi patta', 'meetha neem'],
  }),
  i('chaat_masala', 'Chaat masala', 'spices', 'weight', 0.62, {
    aliases: ['chat masala'],
  }),
  i('sambar_powder', 'Sambar powder', 'spices', 'weight', 0.52, {
    aliases: ['sambhar powder'],
  }),

  // Nuts, seeds & sweeteners
  i('peanuts', 'Peanuts', 'snacks', 'weight', 0.13, {
    aliases: ['moongphali', 'groundnuts'],
    allergens: ['peanuts'],
  }),
  i('cashew', 'Cashew nuts', 'snacks', 'weight', 0.92, {
    aliases: ['kaju'],
    allergens: ['tree_nuts'],
  }),
  i('almond', 'Almonds', 'snacks', 'weight', 0.82, {
    aliases: ['badam'],
    allergens: ['tree_nuts'],
  }),
  i('sesame', 'Sesame seeds', 'spices', 'weight', 0.22, {
    aliases: ['til', 'gingelly'],
    allergens: ['sesame'],
  }),
  i('dates', 'Dates', 'snacks', 'weight', 0.32, {
    aliases: ['khajur', 'medjool dates'],
  }),
];

export const ingredientMap: Record<string, Ingredient> = Object.fromEntries(
  ingredients.map((ing) => [ing.id, ing]),
);

export function getIngredient(id: string): Ingredient | undefined {
  return ingredientMap[id];
}

export function ingredientName(id: string): string {
  return ingredientMap[id]?.name ?? id.replace(/_/g, ' ');
}

export const allergenIngredientIds: Record<string, string[]> = {
  peanuts: ['peanuts'],
  tree_nuts: ['cashew', 'almond'],
  milk: ['paneer', 'milk', 'curd', 'ghee', 'butter', 'cream', 'cheese'],
  wheat: ['atta', 'maida', 'rava', 'bread', 'oats'],
  eggs: ['egg'],
  fish: ['fish'],
  shellfish: ['prawn'],
  mustard: ['mustard_oil', 'mustard_seeds'],
  sesame: ['sesame'],
  soy: [],
};
