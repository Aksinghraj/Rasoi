export type Unit = 'g' | 'kg' | 'ml' | 'l' | 'piece' | 'tbsp' | 'tsp' | 'cup';
export type Dimension = 'weight' | 'volume' | 'piece';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type DietType =
  | 'vegetarian'
  | 'vegan'
  | 'eggetarian'
  | 'non_vegetarian'
  | 'pescatarian'
  | 'jain';

export type FoodType = 'veg' | 'egg' | 'non_veg';

export type IngredientCategory =
  | 'vegetables'
  | 'fruits'
  | 'dairy'
  | 'grains'
  | 'pulses'
  | 'spices'
  | 'meat_seafood'
  | 'frozen'
  | 'snacks'
  | 'household'
  | 'other';

export type EquipmentId =
  | 'gas_stove'
  | 'induction'
  | 'oven'
  | 'microwave'
  | 'air_fryer'
  | 'pressure_cooker'
  | 'rice_cooker'
  | 'mixer_grinder';

export type RestrictionId =
  | 'gluten_free'
  | 'dairy_free'
  | 'low_carb'
  | 'high_protein'
  | 'low_sodium'
  | 'nut_free';

export type Season = 'summer' | 'monsoon' | 'winter' | 'all';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type CookingTimePreference = 'quick' | 'balanced' | 'relaxed';

export type RetailerMode = 'A' | 'B' | 'C';

export interface Ingredient {
  id: string;
  name: string;
  hindiName?: string;
  category: IngredientCategory;
  dimension: Dimension;
  aliases: string[];
  allergens: string[];
  /** Grams per piece, required when a piece is converted to weight. */
  pieceGrams?: number;
  /** Grams per millilitre, required when volume is converted to weight. */
  density?: number;
  /** Base price per canonical unit (per g / ml / piece), in INR. Demo catalogue data. */
  pricePerBase: number;
  staple?: boolean;
}

export interface RecipeIngredient {
  ingredientId: string;
  quantity: number;
  unit: Unit;
  optional?: boolean;
  note?: string;
}

export interface RecipeStep {
  text: string;
  tip?: string;
  timerMinutes?: number;
}

export interface Nutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre?: number;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  cuisine: string;
  region: string;
  mealTypes: MealSlot[];
  dietTypes: DietType[];
  foodType: FoodType;
  image: string;
  prepMinutes: number;
  cookMinutes: number;
  difficulty: Difficulty;
  baseServings: number;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  nutrition: Nutrition;
  tags: string[];
  equipment: EquipmentId[];
  season: Season;
  costPerServing: number;
  videoUrl?: string;
  curated?: boolean;
  verified?: boolean;
}

export interface HouseholdMember {
  id: string;
  name: string;
  ageGroup: 'adult' | 'child';
  diet?: DietType;
}

export interface Household {
  adults: number;
  children: number;
  defaultServings: number;
  members: HouseholdMember[];
}

export interface Budget {
  daily: number;
  weekly: number;
  monthly: number;
}

export interface Preferences {
  country: string;
  state: string;
  city: string;
  pincode: string;
  locality: string;
  diet: DietType;
  region: string;
  restrictions: RestrictionId[];
  allergens: string[];
  customExclusions: string[];
  dislikes: string[];
  equipment: EquipmentId[];
  budget: Budget;
  mealTypes: MealSlot[];
  cookingTime: CookingTimePreference;
  planDay: 'sunday' | 'monday';
  language: 'en' | 'hi';
}

export interface UserProfile {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  authMethod: 'phone' | 'email' | 'demo';
  createdAt: string;
  isAdmin?: boolean;
}

export interface PlannedMeal {
  id: string;
  recipeId: string;
  servings: number;
  cooked?: boolean;
}

export interface PlanDay {
  date: string;
  meals: Record<MealSlot, PlannedMeal[]>;
}

export interface MealPlan {
  id: string;
  name: string;
  startDate: string;
  days: PlanDay[];
  createdAt: string;
  source: 'generated' | 'manual' | 'demo';
}

export interface PantryItem {
  id: string;
  ingredientId: string;
  quantity: number;
  unit: Unit;
  expiresOn?: string;
  staple?: boolean;
  addedAt: string;
}

export interface ExtraItem {
  id: string;
  name: string;
  category: IngredientCategory;
  quantity: number;
  unit: Unit;
  note?: string;
  addedAt: string;
}

export interface NutritionSummary {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface GrocerySource {
  recipeId: string;
  recipeName: string;
  quantity: number;
  unit: Unit;
}

export interface GroceryLine {
  key: string;
  ingredientId: string;
  name: string;
  category: IngredientCategory;
  requiredBase: number;
  requiredDisplay: number;
  displayUnit: Unit;
  dimension: Dimension;
  pantryUsed: number;
  toBuy: number;
  toBuyDisplay: number;
  toBuyUnit: Unit;
  sources: GrocerySource[];
  status: 'matched' | 'unmatched' | 'pantry_covered';
  best?: ProductMatch;
  alternatives: ProductMatch[];
  estimatedPrice: number | null;
}

export interface ExtraGroceryLine {
  key: string;
  extra: ExtraItem;
  category: IngredientCategory;
  checked: boolean;
}

export interface Product {
  id: string;
  retailerId: string;
  retailerName: string;
  ingredientId: string;
  name: string;
  brand: string;
  packSize: number;
  packUnit: Unit;
  price: number;
  mrp?: number;
  inStock: boolean;
  updatedAt: string;
}

export interface ProductMatch {
  product: Product;
  packs: number;
  totalQuantity: number;
  totalPrice: number;
  unitPrice: number;
}

export interface RetailerComparison {
  retailerId: string;
  retailerName: string;
  total: number;
  matchedLines: number;
  totalLines: number;
  deliveryNote: string;
}

export interface GroceryList {
  generatedAt: string;
  lines: GroceryLine[];
  extras: ExtraGroceryLine[];
  sections: { category: IngredientCategory; title: string; lines: GroceryLine[] }[];
  totals: {
    estimated: number;
    matchedCount: number;
    lineCount: number;
    pantrySaved: number;
    extraEstimate: number;
  };
  nutrition: NutritionSummary;
  comparisons: RetailerComparison[];
}

export interface MealPlanContext {
  plan: MealPlan;
  recipes: Recipe[];
  pantry: PantryItem[];
  autoDeduct: boolean;
  extras: ExtraItem[];
  checked: Record<string, boolean>;
  products: Product[];
  generatedAt?: string;
}

export interface RecommendationContext {
  prefs: Preferences;
  recipes: Recipe[];
  recentRecipeIds: string[];
  pantryIngredientIds?: string[];
  today?: string;
}

export interface ScoredRecipe {
  recipe: Recipe;
  score: number;
  reasons: string[];
}

export interface OrderRecord {
  id: string;
  retailerId: string;
  retailerName: string;
  mode: RetailerMode;
  status: 'sandbox_created' | 'handed_off' | 'copied' | 'failed';
  total: number;
  itemCount: number;
  createdAt: string;
  note: string;
  items: { name: string; quantity: string; price?: number }[];
}

export interface Consents {
  analytics: boolean;
  personalisation: boolean;
  offers: boolean;
  retailerSharing: boolean;
}

export interface NotificationSettings {
  weeklyPlan: boolean;
  groceryReminder: boolean;
  pantryExpiry: boolean;
  cookingReminder: boolean;
  offers: boolean;
}

export interface CookingSession {
  recipeId: string;
  servings: number;
  stepIndex: number;
  startedAt: string;
  checkedIngredients: string[];
}

export interface AuditEntry {
  id: string;
  action: string;
  detail: string;
  actor: string;
  at: string;
}

export interface AuthSession {
  userId: string;
  method: 'phone' | 'email' | 'demo';
  signedInAt: string;
}

export interface PendingOtp {
  identifier: string;
  channel: 'phone' | 'email';
  code: string;
  expiresAt: number;
}

export interface AppData {
  session: AuthSession | null;
  user: UserProfile | null;
  household: Household | null;
  preferences: Preferences | null;
  pantry: PantryItem[];
  autoDeductPantry: boolean;
  favorites: string[];
  plans: MealPlan[];
  activePlanId: string | null;
  recentRecipeIds: string[];
  customRecipes: Recipe[];
  extras: ExtraItem[];
  checkedItems: Record<string, boolean>;
  cooking: CookingSession | null;
  cookingHistory: { recipeId: string; completedAt: string }[];
  orders: OrderRecord[];
  notifications: NotificationSettings;
  consents: Consents;
  auditLogs: AuditEntry[];
  verifiedRecipeIds: string[];
  createdAt: string;
}
