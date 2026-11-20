import { ingredients } from '@/lib/data/ingredients';
import { Ingredient, Product, ProductMatch, RetailerMode, Unit } from '@/lib/types';

export const DEMO_CATALOG_VERIFIED_AT = '2026-11-20T06:30:00.000Z';

export interface RetailerInfo {
  id: string;
  name: string;
  shortName: string;
  mode: RetailerMode;
  status: 'sandbox' | 'deeplink' | 'manual';
  description: string;
  accent: string;
  eta: string;
  minimumOrder: number;
  deliveryFee: number;
  deepLinkBase?: string;
}

export const retailers: RetailerInfo[] = [
  {
    id: 'rasoi_market',
    name: 'Rasoi Market (sandbox)',
    shortName: 'Rasoi Market',
    mode: 'A',
    status: 'sandbox',
    description:
      'Demo retailer sandbox. Cart and checkout are simulated locally so the full journey can be tested. No real order is placed.',
    accent: '#0C3B2E',
    eta: 'Demo · 20–30 min',
    minimumOrder: 199,
    deliveryFee: 0,
  },
  {
    id: 'bigbasket',
    name: 'BigBasket',
    shortName: 'BigBasket',
    mode: 'B',
    status: 'deeplink',
    description:
      'Approved deep-link mode. We prepare a matched list and hand you to BigBasket search. Live prices, availability and checkout stay with BigBasket.',
    accent: '#84B817',
    eta: 'Retailer controlled',
    minimumOrder: 0,
    deliveryFee: 0,
    deepLinkBase: 'https://www.bigbasket.com/ps/?q=',
  },
  {
    id: 'blinkit',
    name: 'Blinkit',
    shortName: 'Blinkit',
    mode: 'B',
    status: 'deeplink',
    description:
      'Approved deep-link mode. We open Blinkit search for each matched item. Final prices, stock and delivery are controlled by Blinkit.',
    accent: '#F8CB46',
    eta: 'Retailer controlled',
    minimumOrder: 0,
    deliveryFee: 0,
    deepLinkBase: 'https://blinkit.com/s/?q=',
  },
  {
    id: 'zepto',
    name: 'Zepto',
    shortName: 'Zepto',
    mode: 'B',
    status: 'deeplink',
    description:
      'Approved deep-link mode. We open Zepto search for each matched item. Final prices, stock and delivery are controlled by Zepto.',
    accent: '#6C2BD9',
    eta: 'Retailer controlled',
    minimumOrder: 0,
    deliveryFee: 0,
    deepLinkBase: 'https://www.zeptonow.com/search?query=',
  },
  {
    id: 'instamart',
    name: 'Swiggy Instamart',
    shortName: 'Instamart',
    mode: 'B',
    status: 'deeplink',
    description:
      'Approved deep-link mode. We open Instamart search for each matched item. Final prices, stock and delivery are controlled by Swiggy.',
    accent: '#FC8019',
    eta: 'Retailer controlled',
    minimumOrder: 0,
    deliveryFee: 0,
    deepLinkBase: 'https://www.swiggy.com/instamart/search?query=',
  },
];

export const retailerMap: Record<string, RetailerInfo> = Object.fromEntries(
  retailers.map((r) => [r.id, r]),
);

function packSizes(ingredient: Ingredient): number[] {
  if (ingredient.dimension === 'piece') {
    if (ingredient.id === 'egg') return [6, 12, 30];
    if (ingredient.id === 'bread') return [8, 16];
    if (ingredient.id === 'lemon') return [4, 6, 12];
    if (ingredient.id === 'banana') return [6, 12];
    return [1, 2, 4];
  }
  if (ingredient.dimension === 'volume') {
    if (ingredient.category === 'dairy') return [200, 500, 1000];
    return [500, 1000, 2000];
  }
  switch (ingredient.category) {
    case 'vegetables':
    case 'fruits':
      return [250, 500, 1000];
    case 'dairy':
      return [100, 200, 250, 500];
    case 'spices':
      return [50, 100, 200];
    case 'grains':
      return [500, 1000, 2000];
    case 'pulses':
      return [500, 1000];
    case 'meat_seafood':
      return [250, 500, 1000];
    case 'snacks':
      return [100, 200, 500];
    default:
      return [250, 500, 1000];
  }
}

function hash(text: string): number {
  let value = 0;
  for (let index = 0; index < text.length; index += 1) {
    value = (value * 31 + text.charCodeAt(index)) % 100000;
  }
  return value;
}

const RETAILER_BRANDS: Record<string, string[]> = {
  rasoi_market: ['Rasoi Select', 'Farm Fresh'],
  bigbasket: ['Fresho'],
  blinkit: ['Daily Fresh'],
  zepto: ['Zepto Fresh'],
  instamart: ['Instamart Fresh'],
};

const RETAILER_MULTIPLIER: Record<string, number> = {
  rasoi_market: 1,
  bigbasket: 1.05,
  blinkit: 1.11,
  zepto: 1.08,
  instamart: 1.07,
};

function buildProducts(): Product[] {
  const list: Product[] = [];
  for (const ingredient of ingredients) {
    const sizes = packSizes(ingredient);
    for (const retailer of retailers) {
      const brands = RETAILER_BRANDS[retailer.id] ?? ['Fresh'];
      const count = retailer.id === 'rasoi_market' ? Math.min(3, sizes.length) : 1;
      for (let index = 0; index < count; index += 1) {
        const size = sizes[index % sizes.length];
        const brand = brands[index % brands.length];
        const brandFactor = 1 + (hash(`${ingredient.id}${brand}`) % 9) / 100;
        const retailerFactor = RETAILER_MULTIPLIER[retailer.id] ?? 1;
        const rawPrice = size * ingredient.pricePerBase * brandFactor * retailerFactor;
        const price = Math.max(9, Math.round(rawPrice));
        const unit: Unit = ingredient.dimension === 'weight' ? 'g' : ingredient.dimension === 'volume' ? 'ml' : 'piece';
        list.push({
          id: `${retailer.id}_${ingredient.id}_${size}`,
          retailerId: retailer.id,
          retailerName: retailer.name,
          ingredientId: ingredient.id,
          name: `${brand} ${ingredient.name} · ${size >= 1000 ? `${size / 1000} ${unit === 'g' ? 'kg' : 'l'}` : `${size} ${unit === 'piece' ? 'pc' : unit}`}`,
          brand,
          packSize: size,
          packUnit: unit,
          price,
          inStock: true,
          updatedAt: DEMO_CATALOG_VERIFIED_AT,
        });
      }
    }
  }
  return list;
}

export const products: Product[] = buildProducts();

function bestCombination(skus: Product[], target: number): ProductMatch | null {
  const targetInt = Math.ceil(target - 1e-6);
  if (targetInt <= 0 || skus.length === 0) return null;
  const maxPack = Math.max(...skus.map((sku) => sku.packSize));
  const limit = targetInt + maxPack;
  const cost = new Array<number>(limit + 1).fill(Number.POSITIVE_INFINITY);
  const picks = new Array<number>(limit + 1).fill(-1);
  const counts = new Array<number>(limit + 1).fill(0);
  cost[0] = 0;

  for (let quantity = 0; quantity <= limit; quantity += 1) {
    if (!Number.isFinite(cost[quantity])) continue;
    for (let skuIndex = 0; skuIndex < skus.length; skuIndex += 1) {
      const sku = skus[skuIndex];
      const next = quantity + sku.packSize;
      if (next > limit) continue;
      const nextCost = cost[quantity] + sku.price;
      const nextCount = counts[quantity] + 1;
      if (
        nextCost < cost[next] - 0.001 ||
        (Math.abs(nextCost - cost[next]) < 0.001 && nextCount < counts[next])
      ) {
        cost[next] = nextCost;
        picks[next] = skuIndex;
        counts[next] = nextCount;
      }
    }
  }

  let bestQuantity = -1;
  let bestCost = Number.POSITIVE_INFINITY;
  for (let quantity = targetInt; quantity <= limit; quantity += 1) {
    if (cost[quantity] < bestCost - 0.001) {
      bestCost = cost[quantity];
      bestQuantity = quantity;
    }
  }
  if (bestQuantity < 0 || !Number.isFinite(bestCost)) return null;

  const selected = new Map<string, { product: Product; count: number }>();
  let cursor = bestQuantity;
  while (cursor > 0) {
    const skuIndex = picks[cursor];
    if (skuIndex < 0) break;
    const sku = skus[skuIndex];
    const existing = selected.get(sku.id);
    selected.set(sku.id, { product: sku, count: (existing?.count ?? 0) + 1 });
    cursor -= sku.packSize;
  }

  const primary = [...selected.values()].sort((a, b) => b.count * b.product.packSize - a.count * a.product.packSize)[0];
  if (!primary) return null;

  return {
    product: primary.product,
    packs: primary.count,
    totalQuantity: bestQuantity,
    totalPrice: Math.round(bestCost * 100) / 100,
    unitPrice: Math.round((bestCost / bestQuantity) * 1000) / 1000,
  };
}

export interface IngredientMatchResult {
  best: ProductMatch | null;
  alternatives: ProductMatch[];
  byRetailer: { retailerId: string; match: ProductMatch | null }[];
}

export function matchProductsForIngredient(
  ingredientId: string,
  requiredBase: number,
  catalogue: Product[] = products,
  retailerId?: string,
): IngredientMatchResult {
  const available = catalogue.filter(
    (product) =>
      product.ingredientId === ingredientId &&
      product.inStock &&
      (!retailerId || product.retailerId === retailerId),
  );

  const grouped = new Map<string, Product[]>();
  for (const product of available) {
    const group = grouped.get(product.retailerId) ?? [];
    group.push(product);
    grouped.set(product.retailerId, group);
  }

  const byRetailer = [...grouped.entries()].map(([id, skus]) => ({
    retailerId: id,
    match: bestCombination(skus, requiredBase),
  }));

  const ranked = byRetailer
    .filter((entry): entry is { retailerId: string; match: ProductMatch } => entry.match !== null)
    .sort((a, b) => a.match.totalPrice - b.match.totalPrice);

  const best = ranked[0]?.match ?? null;
  const alternatives = ranked
    .filter((entry) => entry.match.product.id !== best?.product.id || entry.retailerId !== best?.product.retailerId)
    .slice(0, 4)
    .map((entry) => entry.match);

  return { best, alternatives, byRetailer };
}

export function productsForIngredient(ingredientId: string, catalogue: Product[] = products): Product[] {
  return catalogue
    .filter((product) => product.ingredientId === ingredientId && product.inStock)
    .sort((a, b) => a.packSize - b.packSize);
}

export function packLabel(product: Product): string {
  if (product.packUnit === 'piece') return `${product.packSize} pc`;
  if (product.packUnit === 'g') return product.packSize >= 1000 ? `${product.packSize / 1000} kg` : `${product.packSize} g`;
  return product.packSize >= 1000 ? `${product.packSize / 1000} l` : `${product.packSize} ml`;
}
