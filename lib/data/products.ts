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
  /** Only set when a delivery estimate is genuinely known (sandbox demo only). */
  eta?: string;
  minimumOrder: number;
  deliveryFee: number;
  deepLinkBase?: string;
  /** Text mark used in place of a retailer logo asset. */
  logoText: string;
  /** Label for the primary hand-off action. */
  openLabel: string;
  /** How this retailer's prices relate to the estimates Rasoi shows. */
  pricingNote: string;
  /** What Rasoi can and cannot know about stock. */
  stockNote: string;
  /** Where delivery availability is actually confirmed. */
  serviceabilityNote: string;
  /** Retailer-specific guidance for the hand-off. */
  handoffTip: string;
  /** Public store URL used if the search deep link cannot be opened. */
  webFallbackBase?: string;
}

export const retailers: RetailerInfo[] = [
  {
    id: 'rasoi_market',
    name: 'Rasoi Market (sandbox)',
    shortName: 'Rasoi Market',
    mode: 'A',
    status: 'sandbox',
    description:
      'A demo retailer built into Rasoi. Carts and checkout are simulated on this device so the whole journey can be tested. Nothing is sent to a real shop.',
    accent: '#0C3B2E',
    eta: 'Demo · 20–30 min',
    minimumOrder: 199,
    deliveryFee: 0,
    logoText: 'RM',
    openLabel: 'Open Rasoi Market',
    pricingNote: 'Sandbox prices come from Rasoi’s demo catalogue. No real retailer price is involved.',
    stockNote: 'Sandbox stock is simulated locally and is always available for the demo.',
    serviceabilityNote: 'Sandbox serviceability only checks that your PIN code looks valid. It is not a delivery promise.',
    handoffTip: 'Sandbox carts live in this app only and are never transmitted anywhere.',
  },
  {
    id: 'bigbasket',
    name: 'BigBasket',
    shortName: 'BigBasket',
    mode: 'B',
    status: 'deeplink',
    description:
      'Rasoi matches your list to BigBasket products and opens BigBasket search. BigBasket shows its own live price, stock and delivery slots.',
    accent: '#84B817',
    minimumOrder: 0,
    deliveryFee: 0,
    deepLinkBase: 'https://www.bigbasket.com/ps/?q=',
    webFallbackBase: 'https://www.bigbasket.com/',
    logoText: 'BB',
    openLabel: 'Open BigBasket',
    pricingNote: 'Prices shown here are Rasoi estimates from a demo catalogue, not BigBasket’s live price.',
    stockNote: 'BigBasket stock is checked inside BigBasket. Rasoi cannot read BigBasket inventory.',
    serviceabilityNote: 'BigBasket confirms whether it delivers to your address after you open the app.',
    handoffTip: 'Opens a BigBasket search for each item. Your Rasoi list stays saved so you can compare item by item.',
  },
  {
    id: 'blinkit',
    name: 'Blinkit',
    shortName: 'Blinkit',
    mode: 'B',
    status: 'deeplink',
    description:
      'Rasoi matches your list to Blinkit products and opens Blinkit search. Blinkit shows its own live price, stock and delivery estimate.',
    accent: '#F8CB46',
    minimumOrder: 0,
    deliveryFee: 0,
    deepLinkBase: 'https://blinkit.com/s/?q=',
    webFallbackBase: 'https://blinkit.com/',
    logoText: 'BL',
    openLabel: 'Open Blinkit',
    pricingNote: 'Blinkit prices change through the day. The totals here are Rasoi estimates and are never a Blinkit quote.',
    stockNote: 'Blinkit availability depends on your local store. Only the Blinkit app can confirm it.',
    serviceabilityNote: 'Blinkit confirms whether your address is serviceable when you open the app.',
    handoffTip: 'Opens Blinkit search. Add items there — Rasoi cannot create or edit a Blinkit cart.',
  },
  {
    id: 'zepto',
    name: 'Zepto',
    shortName: 'Zepto',
    mode: 'B',
    status: 'deeplink',
    description:
      'Rasoi matches your list to Zepto products and opens Zepto search. Zepto shows its own live price, stock and delivery estimate.',
    accent: '#6C2BD9',
    minimumOrder: 0,
    deliveryFee: 0,
    deepLinkBase: 'https://www.zeptonow.com/search?query=',
    webFallbackBase: 'https://www.zeptonow.com/',
    logoText: 'ZP',
    openLabel: 'Open Zepto',
    pricingNote: 'Zepto runs its own pricing and offers. The totals here are Rasoi estimates, not a Zepto price.',
    stockNote: 'Zepto stock is not exposed to Rasoi. Check each item inside Zepto before paying.',
    serviceabilityNote: 'Zepto confirms delivery for your location inside its app.',
    handoffTip: 'Opens Zepto search for the first item. Use Share list to work through the rest in the Zepto app.',
  },
  {
    id: 'instamart',
    name: 'Swiggy Instamart',
    shortName: 'Instamart',
    mode: 'B',
    status: 'deeplink',
    description:
      'Rasoi matches your list to Instamart products and opens Instamart search. Swiggy shows its own live price, stock and delivery estimate.',
    accent: '#FC8019',
    minimumOrder: 0,
    deliveryFee: 0,
    deepLinkBase: 'https://www.swiggy.com/instamart/search?query=',
    webFallbackBase: 'https://www.swiggy.com/instamart',
    logoText: 'IM',
    openLabel: 'Open Instamart',
    pricingNote: 'Instamart prices and fees are set by Swiggy. Rasoi estimates are indicative only.',
    stockNote: 'Instamart stock is managed by Swiggy and is not visible to Rasoi.',
    serviceabilityNote: 'Instamart delivery availability is checked by Swiggy inside the app.',
    handoffTip: 'Opens Instamart search. Your Rasoi list is kept unchanged so you can follow it in Swiggy.',
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
