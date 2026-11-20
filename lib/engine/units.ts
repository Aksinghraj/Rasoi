import { Dimension, Ingredient, Unit } from '@/lib/types';

export const unitLabels: Record<Unit, string> = {
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'l',
  piece: 'pc',
  tbsp: 'tbsp',
  tsp: 'tsp',
  cup: 'cup',
};

const ML_PER: Record<string, number> = {
  tbsp: 15,
  tsp: 5,
  cup: 240,
};

export function normalizeUnit(input: string): Unit {
  const value = input.trim().toLowerCase();
  if (['g', 'gm', 'gram', 'grams', 'gramme'].includes(value)) return 'g';
  if (['kg', 'kgs', 'kilogram', 'kilograms'].includes(value)) return 'kg';
  if (['ml', 'millilitre', 'milliliter', 'millilitres', 'milliliters'].includes(value)) return 'ml';
  if (['l', 'lt', 'litre', 'liter', 'litres', 'liters'].includes(value)) return 'l';
  if (['piece', 'pieces', 'pc', 'pcs', 'nos', 'no', 'unit', 'units'].includes(value)) return 'piece';
  if (['tbsp', 'tablespoon', 'tablespoons'].includes(value)) return 'tbsp';
  if (['tsp', 'teaspoon', 'teaspoons'].includes(value)) return 'tsp';
  if (['cup', 'cups'].includes(value)) return 'cup';
  throw new Error(`Unsupported unit: ${input}`);
}

export function canonicalUnitFor(ingredient: Ingredient): Unit {
  return ingredient.dimension === 'weight' ? 'g' : ingredient.dimension === 'volume' ? 'ml' : 'piece';
}

export function dimensionFor(ingredient: Ingredient): Dimension {
  return ingredient.dimension;
}

/**
 * Convert a recipe quantity into the ingredient's canonical unit (g / ml / piece).
 * Weight and volume are never treated as interchangeable without a density.
 */
export function toBase(quantity: number, unit: Unit, ingredient: Ingredient): number {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error(`Invalid quantity for ${ingredient.name}`);
  }
  const density = ingredient.density ?? 1;

  const asGrams = (): number => {
    switch (unit) {
      case 'g':
        return quantity;
      case 'kg':
        return quantity * 1000;
      case 'ml':
        return quantity * density;
      case 'l':
        return quantity * 1000 * density;
      case 'piece':
        if (!ingredient.pieceGrams) throw new Error(`No piece weight configured for ${ingredient.name}`);
        return quantity * ingredient.pieceGrams;
      case 'tbsp':
      case 'tsp':
      case 'cup':
        return quantity * ML_PER[unit] * density;
      default:
        throw new Error(`Cannot convert ${unit} to weight`);
    }
  };

  const asMl = (): number => {
    switch (unit) {
      case 'ml':
        return quantity;
      case 'l':
        return quantity * 1000;
      case 'g':
        return quantity / density;
      case 'kg':
        return (quantity * 1000) / density;
      case 'piece':
        if (!ingredient.pieceGrams) throw new Error(`No piece weight configured for ${ingredient.name}`);
        return (quantity * ingredient.pieceGrams) / density;
      case 'tbsp':
      case 'tsp':
      case 'cup':
        return quantity * ML_PER[unit];
      default:
        throw new Error(`Cannot convert ${unit} to volume`);
    }
  };

  switch (ingredient.dimension) {
    case 'weight':
      return roundTo(asGrams(), 2);
    case 'volume':
      return roundTo(asMl(), 2);
    case 'piece':
      switch (unit) {
        case 'piece':
          return roundTo(quantity, 3);
        case 'g':
        case 'kg': {
          const grams = unit === 'g' ? quantity : quantity * 1000;
          if (!ingredient.pieceGrams) throw new Error(`No piece weight configured for ${ingredient.name}`);
          return roundTo(grams / ingredient.pieceGrams, 3);
        }
        default:
          throw new Error(`Cannot convert ${unit} to pieces for ${ingredient.name}`);
      }
    default:
      throw new Error(`Unknown dimension for ${ingredient.name}`);
  }
}

export function displayUnitFor(ingredient: Ingredient, baseQuantity: number): Unit {
  if (ingredient.dimension === 'weight') return baseQuantity >= 1000 ? 'kg' : 'g';
  if (ingredient.dimension === 'volume') return baseQuantity >= 1000 ? 'l' : 'ml';
  return 'piece';
}

export function fromBase(baseQuantity: number, ingredient: Ingredient, unit?: Unit): number {
  const target = unit ?? displayUnitFor(ingredient, baseQuantity);
  switch (target) {
    case 'g':
    case 'ml':
    case 'piece':
      return roundTo(baseQuantity, 2);
    case 'kg':
    case 'l':
      return roundTo(baseQuantity / 1000, 3);
    default:
      throw new Error(`Cannot display canonical quantity in ${target}`);
  }
}

export function formatQuantity(quantity: number, unit: Unit): string {
  if (unit === 'piece') {
    const rounded = Math.round(quantity * 10) / 10;
    return `${rounded} ${rounded === 1 ? 'piece' : 'pieces'}`;
  }
  const rounded =
    quantity >= 100 ? Math.round(quantity) : Math.round(quantity * 10) / 10;
  return `${rounded} ${unitLabels[unit]}`;
}

export function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function sumBaseQuantities(
  entries: { quantity: number; unit: Unit }[],
  ingredient: Ingredient,
): number {
  return roundTo(
    entries.reduce((total, entry) => total + toBase(entry.quantity, entry.unit, ingredient), 0),
    2,
  );
}
