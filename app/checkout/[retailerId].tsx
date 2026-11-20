import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Info,
  ShoppingCart,
  Truck,
} from 'lucide-react-native';
import { useApp } from '@/lib/store/AppContext';
import {
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  InfoBanner,
  ScreenHeader,
  Txt,
} from '@/components/ui';
import { RetailerStatusCard } from '@/components/RetailerStatusCard';
import { colors, radius, spacing } from '@/lib/theme';
import { formatINR, uid } from '@/lib/format';
import { buildGroceryList, shoppingListText } from '@/lib/engine/grocery';
import { formatQuantity } from '@/lib/engine/units';
import {
  CartRequestItem,
  CartResult,
  LinkOpener,
  RetailerNotSupportedError,
  RetailerUnavailableError,
  ServiceabilityResult,
  getRetailerAdapter,
  getRetailerCapabilityView,
  openRetailerHandoff,
} from '@/lib/retailers/adapters';
import { OrderRecord } from '@/lib/types';

const opener: LinkOpener = {
  canOpen: (url) => Linking.canOpenURL(url),
  open: (url) => Linking.openURL(url),
};

export default function CheckoutScreen() {
  const { retailerId } = useLocalSearchParams<{ retailerId: string }>();
  const router = useRouter();
  const { state, activePlan, allRecipes, recordOrder, addAudit } = useApp();
  const view = retailerId ? getRetailerCapabilityView(retailerId) : null;
  const adapter = retailerId ? getRetailerAdapter(retailerId) : null;

  const [serviceability, setServiceability] = useState<ServiceabilityResult | null>(null);
  const [cart, setCart] = useState<CartResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [handedOff, setHandedOff] = useState(false);

  const grocery = useMemo(() => {
    if (!activePlan || !state.preferences) return null;
    return buildGroceryList({
      plan: activePlan,
      recipes: allRecipes,
      pantry: state.pantry,
      autoDeduct: state.autoDeductPantry,
      extras: state.extras,
      checked: state.checkedItems,
    });
  }, [activePlan, state.preferences, state.pantry, state.autoDeductPantry, state.extras, state.checkedItems, allRecipes]);

  const buyLines = grocery?.lines.filter((line) => line.toBuy > 0.001) ?? [];
  const pincode = state.preferences?.pincode ?? '';
  const isSandbox = view?.status === 'sandbox';

  useEffect(() => {
    let mounted = true;
    if (!adapter || !isSandbox) return;
    adapter
      .getServiceability(pincode)
      .then((result) => {
        if (mounted) setServiceability(result);
      })
      .catch(() => {
        if (mounted) setServiceability(null);
      });
    return () => {
      mounted = false;
    };
  }, [adapter, pincode, isSandbox]);

  if (!view || !adapter) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
        <ScreenHeader title="Shop" onBack={() => router.back()} />
        <EmptyState
          title="Retailer not found"
          message="This retailer is not available in this build."
          actionLabel="Back to grocery list"
          onAction={() => router.replace('/(tabs)/grocery')}
        />
      </SafeAreaView>
    );
  }

  const cartItems: CartRequestItem[] = buyLines.map((line) => ({
    ingredientId: line.ingredientId,
    name: line.name,
    quantityBase: line.toBuy,
    display: formatQuantity(line.toBuyDisplay, line.toBuyUnit),
  }));

  const orderSnapshot = (note: string, status: OrderRecord['status']): OrderRecord => ({
    id: uid('order'),
    retailerId: view.id,
    retailerName: view.name,
    mode: view.mode,
    status,
    total: grocery?.totals.estimated ?? 0,
    itemCount: buyLines.length,
    createdAt: new Date().toISOString(),
    note,
    items: buyLines.map((line) => ({
      name: line.name,
      quantity: formatQuantity(line.toBuyDisplay, line.toBuyUnit),
      price: line.estimatedPrice ?? undefined,
    })),
  });

  const createCart = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await adapter.createCart(cartItems);
      setCart(result);
      addAudit('sandbox_cart_created', `${result.lines.length} lines in ${view.shortName} sandbox cart`);
    } catch (err) {
      if (err instanceof RetailerNotSupportedError) setError(err.message);
      else if (err instanceof RetailerUnavailableError) setError(err.message);
      else setError('The sandbox cart could not be created. No cart changes were made.');
    } finally {
      setBusy(false);
    }
  };

  const handOffSandbox = async () => {
    if (!cart?.cartId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await adapter.initiateCheckout(cart.cartId);
      if (!result.ok) {
        setError(result.note);
        return;
      }
      recordOrder(orderSnapshot(result.note, 'sandbox_created'));
      addAudit('sandbox_checkout', `Sandbox hand-off ${result.reference ?? ''} for ${formatINR(cart.total)}`);
      setNotice(
        'Sandbox checkout simulated. No payment was taken and no real order was placed. This is a test of the journey only.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout could not be simulated.');
    } finally {
      setBusy(false);
    }
  };

  const handOff = async (query: string) => {
    setBusy(true);
    setError(null);
    const result = await openRetailerHandoff(adapter, query, opener);
    if (!result.ok) {
      setError(result.note);
      setBusy(false);
      return;
    }
    setNotice(result.note);
    if (!handedOff) {
      recordOrder(orderSnapshot(result.note, 'handed_off'));
      setHandedOff(true);
    }
    addAudit(
      result.usedFallback ? 'retailer_web_fallback' : 'retailer_handoff',
      `Opened ${view.shortName} for "${query}". List kept unchanged.`,
    );
    setBusy(false);
  };

  const shareList = async () => {
    if (!grocery) return;
    const text = shoppingListText(grocery, activePlan?.name ?? 'My grocery list');
    try {
      await Share.share({ message: text });
      recordOrder(
        orderSnapshot(
          'Grocery list shared to paste into the retailer app. No order was placed by Rasoi.',
          'copied',
        ),
      );
      addAudit('list_shared', `Shared grocery list for ${view.shortName}`);
    } catch {
      setError('Sharing was cancelled or is unavailable on this device.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
      <ScreenHeader title={view.shortName} subtitle={`${view.modeLabel} · no live retailer API`} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <RetailerStatusCard
          view={view}
          estimate={grocery?.totals.estimated ?? null}
          matchedLines={grocery?.totals.matchedCount}
          totalLines={grocery?.totals.lineCount}
          onOpen={buyLines.length > 0 ? () => handOff(buyLines[0]?.name ?? '') : undefined}
          opening={busy}
        />

        <Card style={{ marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Truck size={16} color={colors.forest} />
            <Txt variant="bodyStrong">Delivery serviceability</Txt>
          </View>
          {isSandbox ? (
            <View style={{ marginTop: spacing.sm }}>
              <Badge
                label={serviceability?.serviceable ? 'Simulated check passed' : 'Simulated check failed'}
                tone={serviceability?.serviceable ? 'mint' : 'red'}
              />
              <Txt variant="tiny" color={colors.inkSoft} style={{ marginTop: spacing.sm }}>
                {serviceability?.note ?? view.serviceabilityNote}
              </Txt>
            </View>
          ) : (
            <View style={{ marginTop: spacing.sm }}>
              <Badge label={`Confirmed by ${view.shortName}`} tone="blue" />
              <Txt variant="tiny" color={colors.inkSoft} style={{ marginTop: spacing.sm }}>
                {view.serviceabilityNote}
              </Txt>
            </View>
          )}
        </Card>

        <View style={{ marginTop: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Txt variant="h3">
              {buyLines.length} item{buyLines.length === 1 ? '' : 's'} to buy
            </Txt>
            <Txt variant="tiny" color={colors.inkFaint}>
              {grocery?.totals.matchedCount ?? 0}/{grocery?.totals.lineCount ?? 0} matched
            </Txt>
          </View>
          <Txt variant="tiny" color={colors.inkSoft}>
            Prices are Rasoi estimates from the demo catalogue, not live {view.shortName} prices.
          </Txt>
        </View>

        {buyLines.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart size={24} color={colors.forest} />}
            title="Nothing to buy"
            message="Your pantry already covers this plan. Add meals or extras to the plan to build a basket."
            actionLabel="Back to grocery list"
            onAction={() => router.replace('/(tabs)/grocery')}
          />
        ) : (
          <Card padded={false} style={{ marginTop: spacing.md }}>
            {buyLines.map((line, index) => (
              <View key={line.key}>
                {index > 0 ? <Divider style={{ marginHorizontal: spacing.lg }} /> : null}
                <View style={styles.lineRow}>
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyStrong">{line.name}</Txt>
                    <Txt variant="tiny" color={colors.inkSoft}>
                      {formatQuantity(line.toBuyDisplay, line.toBuyUnit)}
                      {line.best ? ` · ${line.best.product.name}` : ' · no catalogue match'}
                    </Txt>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Txt variant="bodyStrong">{formatINR(line.estimatedPrice)}</Txt>
                    <Txt variant="tiny" color={colors.inkFaint}>
                      est. only
                    </Txt>
                    {view.deepLink ? (
                      <Pressable
                        onPress={() => handOff(line.name)}
                        hitSlop={6}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}
                      >
                        <Txt variant="tiny" color={colors.forest} style={{ fontWeight: '700' }}>
                          Search
                        </Txt>
                        <ExternalLink size={11} color={colors.forest} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </View>
            ))}
          </Card>
        )}

        {cart ? (
          <Card style={{ marginTop: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <CheckCircle2 size={17} color={colors.forest} />
              <Txt variant="h3">Sandbox cart ready</Txt>
            </View>
            <Txt variant="tiny" color={colors.inkSoft} style={{ marginTop: 4 }}>
              Cart {cart.cartId} · {cart.lines.length} lines · {formatINR(cart.total)}
            </Txt>
            {cart.unmatched.length > 0 ? (
              <View style={{ marginTop: spacing.sm }}>
                <InfoBanner
                  tone="orange"
                  message={`Not added automatically: ${cart.unmatched.join(', ')}. These stay on your manual list.`}
                />
              </View>
            ) : null}
            <Button
              label="Simulate checkout hand-off"
              variant="secondary"
              style={{ marginTop: spacing.md }}
              loading={busy}
              onPress={handOffSandbox}
            />
          </Card>
        ) : null}

        {notice ? (
          <View style={{ marginTop: spacing.lg }}>
            <InfoBanner
              tone="mint"
              title={isSandbox ? 'Sandbox only' : 'Hand-off started'}
              message={notice}
              icon={<CheckCircle2 size={16} color={colors.forest} />}
            />
          </View>
        ) : null}

        {error ? (
          <View style={{ marginTop: spacing.lg }}>
            <InfoBanner
              tone="red"
              title="Could not open retailer"
              message={error}
              icon={<AlertTriangle size={16} color={colors.red} />}
            />
          </View>
        ) : null}

        <View style={{ marginTop: spacing.lg }}>
          <InfoBanner
            tone="neutral"
            title={isSandbox ? 'Sandbox, not a real shop' : `Prices and stock are ${view.shortName}’s`}
            message={
              isSandbox
                ? 'Rasoi Market is a demo sandbox inside this app. Creating a cart and checking out only simulates the flow on this device. No payment is collected, no order is transmitted and no delivery will arrive.'
                : `${view.pricingNote} ${view.stockNote} Rasoi does not add products to a ${view.shortName} cart, and no ${view.shortName} order is placed from here.`
            }
            icon={<Info size={16} color={colors.inkSoft} />}
          />
        </View>

        {buyLines.length > 0 ? (
          <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
            {isSandbox ? (
              <Button
                label={cart ? 'Sandbox cart created' : 'Create sandbox cart'}
                icon={<ShoppingCart size={16} color={colors.white} />}
                disabled={Boolean(cart)}
                loading={busy}
                onPress={createCart}
              />
            ) : (
              <>
                <Button
                  label={view.openLabel}
                  icon={<ExternalLink size={16} color={colors.white} />}
                  loading={busy}
                  onPress={() => handOff(buyLines[0]?.name ?? '')}
                />
                <Button
                  label="Share / copy full list"
                  variant="secondary"
                  icon={<Copy size={16} color={colors.forest} />}
                  onPress={shareList}
                />
              </>
            )}
          </View>
        ) : null}

        <Txt variant="tiny" color={colors.inkFaint} style={{ marginTop: spacing.md, textAlign: 'center' }}>
          Your list stays saved in Rasoi and is not changed by opening {view.shortName}.
        </Txt>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
