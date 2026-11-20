import {
  DEMO_CATALOG_VERIFIED_AT,
  IngredientMatchResult,
  RetailerInfo,
  matchProductsForIngredient,
  products as demoProducts,
  retailerMap,
  retailers,
} from '@/lib/data/products';
import { Product, ProductMatch, RetailerMode } from '@/lib/types';

export interface ServiceabilityResult {
  serviceable: boolean | null;
  eta: string;
  note: string;
  checkedAt: string;
}

export interface CartRequestItem {
  ingredientId: string;
  name: string;
  quantityBase: number;
  display: string;
}

export interface CartLine {
  ingredientId: string;
  name: string;
  productId: string;
  productName: string;
  packs: number;
  quantity: string;
  price: number;
}

export interface CartResult {
  ok: boolean;
  cartId: string | null;
  status: 'sandbox_created' | 'unsupported' | 'failed';
  lines: CartLine[];
  total: number;
  unmatched: string[];
  note: string;
  mode: RetailerMode;
  verifiedAt: string;
}

export interface CheckoutResult {
  ok: boolean;
  status: 'sandbox_cart_ready' | 'unsupported';
  reference: string | null;
  note: string;
}

export class RetailerNotSupportedError extends Error {
  constructor(retailer: string, capability: string) {
    super(`${retailer} does not expose ${capability} through this integration mode.`);
    this.name = 'RetailerNotSupportedError';
  }
}

export class RetailerUnavailableError extends Error {
  constructor(retailer: string) {
    super(`${retailer} is temporarily unavailable. No cart changes were made.`);
    this.name = 'RetailerUnavailableError';
  }
}

export interface RetailerAdapter {
  info: RetailerInfo;
  capabilities: {
    catalogue: boolean;
    cart: boolean;
    checkout: boolean;
    deepLink: boolean;
  };
  authenticate(): Promise<{ ok: boolean; note: string }>;
  getServiceability(pincode: string): Promise<ServiceabilityResult>;
  searchProducts(query: string): Promise<Product[]>;
  getProductDetails(productId: string): Promise<Product | null>;
  getInventory(productId: string): Promise<{ productId: string; inStock: boolean; checkedAt: string }>;
  getPricing(productId: string): Promise<{ productId: string; price: number; checkedAt: string }>;
  getDeliveryOptions(pincode: string): Promise<{ options: string[]; note: string }>;
  createCart(items: CartRequestItem[]): Promise<CartResult>;
  updateCart(cartId: string, items: CartRequestItem[]): Promise<CartResult>;
  removeCartItem(cartId: string, ingredientId: string): Promise<CartResult>;
  getCart(cartId: string): Promise<CartResult | null>;
  initiateCheckout(cartId: string): Promise<CheckoutResult>;
  getOrderStatus(orderId: string): Promise<{ orderId: string; status: string; note: string }>;
  getDeepLink(query: string): string | null;
  match(ingredientId: string, quantityBase: number): IngredientMatchResult;
}

class SandboxRetailerAdapter implements RetailerAdapter {
  info: RetailerInfo;
  capabilities = { catalogue: true, cart: true, checkout: true, deepLink: false };
  private carts = new Map<string, CartResult>();
  private online: boolean;

  constructor(info: RetailerInfo, online = true) {
    this.info = info;
    this.online = online;
  }

  private assertOnline() {
    if (!this.online) throw new RetailerUnavailableError(this.info.shortName);
  }

  async authenticate() {
    return {
      ok: true,
      note: 'Sandbox session. Credentials are not stored; production uses OAuth2 client credentials held server-side.',
    };
  }

  async getServiceability(pincode: string): Promise<ServiceabilityResult> {
    const valid = /^[1-9][0-9]{5}$/.test(pincode);
    return {
      serviceable: valid,
      eta: valid ? '20–30 min (sandbox)' : 'Enter a valid 6-digit PIN code',
      note: 'Sandbox serviceability only. Production must call the retailer serviceability API.',
      checkedAt: DEMO_CATALOG_VERIFIED_AT,
    };
  }

  async searchProducts(query: string): Promise<Product[]> {
    this.assertOnline();
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return demoProducts
      .filter((product) => product.retailerId === this.info.id)
      .filter((product) => `${product.name} ${product.ingredientId}`.toLowerCase().includes(term))
      .slice(0, 30);
  }

  async getProductDetails(productId: string): Promise<Product | null> {
    return demoProducts.find((product) => product.id === productId) ?? null;
  }

  async getInventory(productId: string) {
    const product = demoProducts.find((item) => item.id === productId);
    return {
      productId,
      inStock: Boolean(product?.inStock),
      checkedAt: DEMO_CATALOG_VERIFIED_AT,
    };
  }

  async getPricing(productId: string) {
    const product = demoProducts.find((item) => item.id === productId);
    if (!product) throw new Error('Product not found in sandbox catalogue');
    return { productId, price: product.price, checkedAt: DEMO_CATALOG_VERIFIED_AT };
  }

  async getDeliveryOptions(pincode: string) {
    return {
      options: /^[1-9][0-9]{5}$/.test(pincode) ? ['Standard (demo)', 'Express (demo)'] : [],
      note: 'Delivery options are simulated in sandbox mode.',
    };
  }

  async createCart(items: CartRequestItem[]): Promise<CartResult> {
    this.assertOnline();
    const lines: CartLine[] = [];
    const unmatched: string[] = [];
    for (const item of items) {
      const match = matchProductsForIngredient(item.ingredientId, item.quantityBase, demoProducts, this.info.id);
      if (!match.best) {
        unmatched.push(item.name);
        continue;
      }
      lines.push(this.toLine(match.best, item));
    }
    const total = Math.round(lines.reduce((sum, line) => sum + line.price, 0) * 100) / 100;
    const cart: CartResult = {
      ok: lines.length > 0,
      cartId: `sandbox_cart_${Date.now().toString(36)}`,
      status: 'sandbox_created',
      lines,
      total,
      unmatched,
      note:
        'Sandbox cart created in the demo retailer. Nothing was ordered, no payment was taken and no real retailer was contacted.',
      mode: 'A',
      verifiedAt: DEMO_CATALOG_VERIFIED_AT,
    };
    if (cart.cartId) this.carts.set(cart.cartId, cart);
    return cart;
  }

  async updateCart(cartId: string, items: CartRequestItem[]): Promise<CartResult> {
    const existing = this.carts.get(cartId);
    if (!existing) throw new Error('Sandbox cart not found');
    const next = await this.createCart(items);
    const updated = { ...next, cartId, status: 'sandbox_created' as const };
    this.carts.set(cartId, updated);
    return updated;
  }

  async removeCartItem(cartId: string, ingredientId: string): Promise<CartResult> {
    const existing = this.carts.get(cartId);
    if (!existing) throw new Error('Sandbox cart not found');
    const lines = existing.lines.filter((line) => line.ingredientId !== ingredientId);
    const updated: CartResult = {
      ...existing,
      lines,
      total: Math.round(lines.reduce((sum, line) => sum + line.price, 0) * 100) / 100,
    };
    this.carts.set(cartId, updated);
    return updated;
  }

  async getCart(cartId: string): Promise<CartResult | null> {
    return this.carts.get(cartId) ?? null;
  }

  async initiateCheckout(cartId: string): Promise<CheckoutResult> {
    const cart = this.carts.get(cartId);
    if (!cart) {
      return {
        ok: false,
        status: 'unsupported',
        reference: null,
        note: 'Sandbox cart not found. Create the cart again before checkout.',
      };
    }
    return {
      ok: true,
      status: 'sandbox_cart_ready',
      reference: `sandbox_ref_${Date.now().toString(36)}`,
      note:
        'Sandbox checkout hand-off simulated. No payment was collected and no real order was placed with any retailer.',
    };
  }

  async getOrderStatus(orderId: string) {
    return {
      orderId,
      status: 'sandbox_only',
      note: 'Sandbox orders have no real fulfilment status.',
    };
  }

  getDeepLink(): string | null {
    return null;
  }

  match(ingredientId: string, quantityBase: number): IngredientMatchResult {
    return matchProductsForIngredient(ingredientId, quantityBase, demoProducts, this.info.id);
  }

  private toLine(match: ProductMatch, item: CartRequestItem): CartLine {
    return {
      ingredientId: item.ingredientId,
      name: item.name,
      productId: match.product.id,
      productName: match.product.name,
      packs: match.packs,
      quantity: item.display,
      price: match.totalPrice,
    };
  }
}

class DeepLinkRetailerAdapter implements RetailerAdapter {
  info: RetailerInfo;
  capabilities = { catalogue: false, cart: false, checkout: false, deepLink: true };

  constructor(info: RetailerInfo) {
    this.info = info;
  }

  async authenticate() {
    return {
      ok: false,
      note: 'No credential exchange. Deep-link mode does not authenticate with the retailer.',
    };
  }

  async getServiceability(): Promise<ServiceabilityResult> {
    return {
      serviceable: null,
      eta: 'Retailer controlled',
      note: 'Serviceability is confirmed inside the retailer app. Deep-link mode cannot verify it.',
      checkedAt: new Date().toISOString(),
    };
  }

  async searchProducts(): Promise<Product[]> {
    return [];
  }

  async getProductDetails(): Promise<Product | null> {
    return null;
  }

  async getInventory(productId: string) {
    return { productId, inStock: false, checkedAt: new Date().toISOString() };
  }

  async getPricing(productId: string): Promise<{ productId: string; price: number; checkedAt: string }> {
    void productId;
    throw new RetailerNotSupportedError(this.info.shortName, 'live pricing');
  }

  async getDeliveryOptions() {
    return {
      options: [],
      note: 'Delivery options are shown inside the retailer app.',
    };
  }

  async createCart(): Promise<CartResult> {
    throw new RetailerNotSupportedError(this.info.shortName, 'cart transfer');
  }

  async updateCart(): Promise<CartResult> {
    throw new RetailerNotSupportedError(this.info.shortName, 'cart updates');
  }

  async removeCartItem(): Promise<CartResult> {
    throw new RetailerNotSupportedError(this.info.shortName, 'cart updates');
  }

  async getCart(): Promise<CartResult | null> {
    return null;
  }

  async initiateCheckout(): Promise<CheckoutResult> {
    throw new RetailerNotSupportedError(this.info.shortName, 'checkout');
  }

  async getOrderStatus(orderId: string) {
    return {
      orderId,
      status: 'retailer_controlled',
      note: 'Track this order in the retailer app. Deep-link mode has no order API access.',
    };
  }

  getDeepLink(query: string): string | null {
    if (!this.info.deepLinkBase) return null;
    return `${this.info.deepLinkBase}${encodeURIComponent(query)}`;
  }

  match(ingredientId: string, quantityBase: number): IngredientMatchResult {
    return matchProductsForIngredient(ingredientId, quantityBase, demoProducts);
  }
}

const adapters = new Map<string, RetailerAdapter>();
const sandboxInstances = new Map<string, SandboxRetailerAdapter>();

export function getRetailerAdapter(retailerId: string): RetailerAdapter {
  const existing = adapters.get(retailerId);
  if (existing) return existing;
  const info = retailerMap[retailerId];
  if (!info) throw new Error(`Unknown retailer: ${retailerId}`);
  const adapter =
    info.status === 'sandbox'
      ? new SandboxRetailerAdapter(info)
      : new DeepLinkRetailerAdapter(info);
  adapters.set(retailerId, adapter);
  if (adapter instanceof SandboxRetailerAdapter) sandboxInstances.set(retailerId, adapter);
  return adapter;
}

export function listRetailerAdapters(): RetailerAdapter[] {
  return retailers.map((info) => getRetailerAdapter(info.id));
}

export function getSandboxAdapter(online = true): SandboxRetailerAdapter {
  return new SandboxRetailerAdapter(retailerMap.rasoi_market, online);
}

export function retailerModeLabel(mode: RetailerMode): string {
  if (mode === 'A') return 'Authorized integration (sandbox)';
  if (mode === 'B') return 'Approved deep link';
  return 'Manual grocery list';
}
