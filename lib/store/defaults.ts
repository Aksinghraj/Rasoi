import { AppData, Consents, NotificationSettings, Preferences } from '@/lib/types';

export const defaultConsents: Consents = {
  analytics: false,
  personalisation: true,
  offers: false,
  retailerSharing: false,
};

export const defaultNotifications: NotificationSettings = {
  weeklyPlan: true,
  groceryReminder: true,
  pantryExpiry: true,
  cookingReminder: false,
  offers: false,
};

export const defaultPreferences: Preferences = {
  country: 'India',
  state: 'Karnataka',
  city: 'Bengaluru',
  pincode: '',
  locality: '',
  diet: 'vegetarian',
  region: 'Karnataka',
  restrictions: [],
  allergens: [],
  customExclusions: [],
  dislikes: [],
  equipment: ['gas_stove', 'mixer_grinder'],
  budget: { daily: 500, weekly: 3500, monthly: 14000 },
  mealTypes: ['breakfast', 'lunch', 'dinner', 'snack'],
  cookingTime: 'balanced',
  planDay: 'monday',
  language: 'en',
};

export function createEmptyData(): AppData {
  return {
    session: null,
    user: null,
    household: null,
    preferences: null,
    pantry: [],
    autoDeductPantry: true,
    favorites: [],
    plans: [],
    activePlanId: null,
    recentRecipeIds: [],
    customRecipes: [],
    extras: [],
    checkedItems: {},
    cooking: null,
    cookingHistory: [],
    orders: [],
    notifications: defaultNotifications,
    consents: defaultConsents,
    auditLogs: [],
    verifiedRecipeIds: [],
    createdAt: new Date().toISOString(),
  };
}
