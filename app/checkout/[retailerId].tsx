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
  ShoppingBag,
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
  LoadingState,
  ScreenHeader,
  Txt,
} from '@/components/ui';
import { colors, radius, spacing } from '@/lib/theme';
import { formatINR, uid } from '@/lib/format';
import { buildGroceryList, shoppingListText } from '@/lib/engine/grocery';
import { formatQuantity } from '@/lib/engine/units';
import { retailerMap } from '@/lib/data/products';
import {
  CartRequestItem,
  CartResult,
  RetailerNotSupportedError,
  RetailerUnavailableError,
  ServiceabilityResult,
  getRetailerAdapter,
} from '@/lib/retailers/adapters';
import { OrderRecord } from '@/lib/types';

export default function CheckoutScreen() {
  const { retailerId } = useLocalSearchParams<{ retailerId: string }>();
  const router = useRouter();
  const { state, activePlan, allRecipes, recordOrder, addAudit } = useApp();
  const info = retailerId ? retailerMap[retailerId] : undefined;
  const adapter = retailerId ? getRetailerAdapter(retailerId) : null;

  const [serviceability, setServiceability] = useState<ServiceabilityResult | null>(null);
  const [serviceLoading, setServiceLoading] = useState(true);
  const [cart, setCart] = useState<CartResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  useEffect(() => {
    let mounted = true;
    if (!adapter) return;
    setServiceLoading(true);
    adapter
      .getServiceability(pincode)
      .then((result) => {
        if (mounted) setServiceability(result);
      })
      .catch(() => {
        if (mounted) setServiceability(null);
      })
      .finally(() => {
        if (mounted) setServiceLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [adapter, pincode]);

  if (!info || !adapter) {
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

  const createCart = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await adapter.createCart(cartItems);
      setCart(result);
      addAudit('sandbox_cart_created', `${result.lines.length} lines in ${info.shortName} sandbox cart`);
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
      const order: OrderRecord = {
        id: uid('order'),
        retailerId: info.id,
        retailerName: info.name,
        mode: 'A',
        status: 'sandbox_created',
        total: cart.total,
        itemCount: cart.lines.length,
        createdAt: new Date().toISOString(),
        note: result.note,
        items: cart.lines.map((line) => ({
          name: line.productName,
          quantity: line.quantity,
          price: line.price,
        })),
      };
      recordOrder(order);
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

  const openDeepLink = async (query: string, price?: number | null) => {
    const url = adapter.getDeepLink(query);
    if (!url) {
      setError(`${info.shortName} did not provide a deep link for this item.`);
      return;
    }
    try {
      await Linking.openURL(url);
      const order: OrderRecord = {
        id: uid('order'),
        retailerId: info.id,
        retailerName: info.name,
        mode: 'B',
        status: 'handed_off',
        total: price ?? 0,
        itemCount: 1,
        createdAt: new Date().toISOString(),
        note: `Opened ${info.shortName} search for "${query}". Price and availability are controlled by the retailer.`,
        items: [{ name: query, quantity: '1', price: price ?? undefined }],
      };
      recordOrder(order);
      addAudit('retailer_handoff', `Opened ${info.shortName} for ${query}`);
    } catch {
      setError(`Could not open ${info.shortName}. Check that the app is installed or try again.`);
    }
  };

  const shareList = async () => {
    if (!grocery) return;
    const text = shoppingListText(grocery, activePlan?.name ?? 'My grocery list');
    try {
      await Share.share({ message: text });
      recordOrder({
        id: uid('order'),
        retailerId: info.id,
        retailerName: info.name,
        mode: 'B',
        status: 'copied',
        total: grocery.totals.estimated,
        itemCount: buyLines.length,
        createdAt: new Date().toISOString(),
        note: 'Grocery list shared to paste into the retailer app. No order was placed by Rasoi.',
        items: buyLines.map((line) => ({
          name: line.name,
          quantity: formatQuantity(line.toBuyDisplay, line.toBuyUnit),
          price: line.estimatedPrice ?? undefined,
        })),
      });
      addAudit('list_shared', `Shared grocery list for ${info.shortName}`);
    } catch {
      setError('Sharing was cancelled or is unavailable on this device.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
      <ScreenHeader title={info.shortName} subtitle={info.status === 'sandbox' ? 'Sandbox integration' : 'Deep-link handoff'} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={[styles.logo, { backgroundColor: info.accent }]}>
              <ShoppingBag size={20} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="h3">{info.name}</Txt>
              <Txt variant="tiny" color={colors.inkSoft}>
                {info.description}
              </Txt>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
            <Badge label={info.mode === 'A' ? 'Sandbox cart' : 'Deep link'} tone={info.mode === 'A' ? 'mint' : 'neutral'} />
            <Badge label={info.eta} tone="neutral" />
            {info.minimumOrder > 0 ? <Badge label={`Min ${formatINR(info.minimumOrder)}`} tone="neutral" /> : null}
          </View>
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Truck size={16} color={colors.forest} />
            <Txt variant="bodyStrong">Serviceability</Txt>
          </View>
          {serviceLoading ? (
            <Txt variant="small" color={colors.inkSoft} style={{ marginTop: spacing.sm }}>
              Checking PIN code {pincode || '—'}…
            </Txt>
          ) : (
            <View style={{ marginTop: spacing.sm }}>
              {serviceability?.serviceable === true ? (
                <Badge label="Serviceable (sandbox)" tone="mint" />
              ) : serviceability?.serviceable === false ? (
                <Badge label="Not serviceable" tone="red" />
              ) : (
                <Badge label="Confirm in retailer app" tone="neutral" />
              )}
              <Txt variant="tiny" color={colors.inkSoft} style={{ marginTop: spacing.sm }}>
                {serviceability?.note ?? 'Serviceability could not be checked.'}
              </Txt>
            </View>
          )}
        </Card>

        <View style={{ marginTop: spacing.lg }}>
          <Txt variant="h3">
            {buyLines.length} item{buyLines.length === 1 ? '' : 's'} to buy
          </Txt>
          <Txt variant="tiny" color={colors.inkSoft}>
            Estimated {formatINR(grocery?.totals.estimated ?? 0)} from the demo catalogue
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
                    {info.mode === 'B' ? (
                      <Pressable
                        onPress={() => openDeepLink(line.name, line.estimatedPrice)}
                        hitSlop={6}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}
                      >
                        <Txt variant="tiny" color={colors.forest} style={{ fontWeight: '700' }}>
                          Open
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
            <InfoBanner tone="mint" title="Sandbox only" message={notice} />
          </View>
        ) : null}

        {error ? (
          <View style={{ marginTop: spacing.lg }}>
            <InfoBanner
              tone="red"
              title="Could not complete"
              message={error}
              icon={<AlertTriangle size={16} color={colors.red} />}
            />
          </View>
        ) : null}

        <View style={{ marginTop: spacing.lg }}>
          <InfoBanner
            tone={info.mode === 'A' ? 'orange' : 'neutral'}
            title={info.mode === 'A' ? 'This is a sandbox, not a real retailer' : 'You complete checkout with the retailer'}
            message={
              info.mode === 'A'
                ? 'Rasoi Market is a demo sandbox built into this app. Creating a cart and checking out only simulates the flow locally. No payment is collected, no order is transmitted and no delivery will arrive.'
                : `${info.shortName} is connected in approved deep-link mode. Rasoi prepares your list and opens the retailer app or site, but prices, stock, payment and delivery stay entirely with ${info.shortName}.`
            }
            icon={<Info size={16} color={info.mode === 'A' ? colors.orange : colors.inkSoft} />}
          />
        </View>

        {buyLines.length > 0 ? (
          <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
            {info.mode === 'A' ? (
              <Button
                label={cart ? 'Cart created' : 'Create sandbox cart'}
                icon={<ShoppingCart size={16} color={colors.white} />}
                disabled={Boolean(cart)}
                loading={busy}
                onPress={createCart}
              />
            ) : (
              <>
                <Button
                  label={`Open ${info.shortName} search`}
                  icon={<ExternalLink size={16} color={colors.white} />}
                  onPress={() => openDeepLink(buyLines[0]?.name ?? '')}
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
