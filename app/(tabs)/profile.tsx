import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Bell,
  BookOpen,
  ChevronRight,
  Download,
  Heart,
  HelpCircle,
  Languages,
  LogOut,
  Package,
  Settings,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react-native';
import { defaultPreferences, useApp } from '@/lib/store/AppContext';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  Divider,
  Eyebrow,
  Field,
  InfoBanner,
  Sheet,
  Stepper,
  Txt,
  ToggleRow,
} from '@/components/ui';
import { colors, dietLabels, equipmentLabels, radius, spacing } from '@/lib/theme';
import { formatDay, formatINR, relativeTime } from '@/lib/format';
import { planCost, weekLabel } from '@/lib/engine/planner';

export default function ProfileScreen() {
  const {
    state,
    allRecipes,
    activePlan,
    setActivePlan,
    updateProfile,
    updateHousehold,
    updateNotifications,
    signOut,
    deleteAccount,
    exportData,
  } = useApp();
  const router = useRouter();
  const [nameOpen, setNameOpen] = useState(false);
  const [name, setName] = useState(state.user?.name ?? '');
  const [householdOpen, setHouseholdOpen] = useState(false);
  const [adults, setAdults] = useState(state.household?.adults ?? 2);
  const [children, setChildren] = useState(state.household?.children ?? 0);
  const [servings, setServings] = useState(state.household?.defaultServings ?? 2);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const prefs = state.preferences ?? defaultPreferences;
  const household = state.household ?? { adults: 2, children: 0, defaultServings: 2, members: [] };
  const favorites = state.favorites.filter((id) => allRecipes.some((recipe) => recipe.id === id)).length;
  const planSpend = useMemo(
    () => (activePlan ? planCost(activePlan, allRecipes).total : 0),
    [activePlan, allRecipes],
  );

  const shareExport = async () => {
    try {
      const data = exportData();
      await Share.share({ message: data, title: 'Rasoi data export' });
    } catch {
      setNotice('Export is unavailable on this device.');
    }
  };

  const confirmDelete = async () => {
    if (deleteConfirm.trim().toUpperCase() !== 'DELETE') return;
    await deleteAccount();
    setDeleteOpen(false);
    router.replace('/auth');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Avatar name={state.user?.name ?? 'Rasoi'} size={56} />
            <View style={{ flex: 1 }}>
              <Eyebrow color={colors.mintStrong}>Your kitchen</Eyebrow>
              <Txt variant="h2" color={colors.white} numberOfLines={1}>
                {state.user?.name ?? 'Rasoi cook'}
              </Txt>
              <Txt variant="small" color={colors.mintStrong} numberOfLines={1}>
                {state.user?.phone ? `+91 ${state.user.phone}` : state.user?.email ?? 'Local demo account'}
              </Txt>
            </View>
            <Pressable
              onPress={() => {
                setName(state.user?.name ?? '');
                setNameOpen(true);
              }}
              style={styles.editButton}
              accessibilityLabel="Edit name"
            >
              <Settings size={16} color={colors.mint} />
            </Pressable>
          </View>
          <View style={styles.statRow}>
            <View style={styles.heroStat}>
              <Txt variant="h3" color={colors.white}>
                {favorites}
              </Txt>
              <Txt variant="tiny" color={colors.mintStrong}>
                saved recipes
              </Txt>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Txt variant="h3" color={colors.white}>
                {state.plans.length}
              </Txt>
              <Txt variant="tiny" color={colors.mintStrong}>
                meal plans
              </Txt>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Txt variant="h3" color={colors.white}>
                {state.pantry.length}
              </Txt>
              <Txt variant="tiny" color={colors.mintStrong}>
                pantry items
              </Txt>
            </View>
          </View>
          {state.user?.isAdmin ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <Badge label="Demo admin" tone="yellow" icon={<Shield size={11} color="#8A6A12" />} />
              <Badge label={prefs.language === 'hi' ? 'हिंदी beta' : 'English'} tone="mint" />
            </View>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: spacing.xl, marginTop: -spacing.xl }}>
          {notice ? (
            <View style={{ marginBottom: spacing.md }}>
              <InfoBanner message={notice} tone="mint" />
            </View>
          ) : null}

          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.sectionIcon}>
                <Users size={18} color={colors.forest} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Txt variant="bodyStrong">Your household</Txt>
                <Txt variant="tiny" color={colors.inkSoft}>
                  {household.adults} adult{household.adults === 1 ? '' : 's'} · {household.children} child
                  {household.children === 1 ? '' : 'ren'} · {household.defaultServings} servings
                </Txt>
              </View>
              <Pressable
                onPress={() => {
                  setAdults(household.adults);
                  setChildren(household.children);
                  setServings(household.defaultServings);
                  setHouseholdOpen(true);
                }}
                style={styles.smallButton}
              >
                <Txt variant="tiny" color={colors.forest} style={{ fontWeight: '700' }}>
                  Edit
                </Txt>
              </Pressable>
            </View>
            <Divider style={{ marginVertical: spacing.md }} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <Badge label={dietLabels[prefs.diet]} tone="mint" />
              <Badge label={prefs.region} tone="neutral" />
              <Badge label={`${prefs.city} ${prefs.pincode}`} tone="neutral" />
              <Badge label={formatINR(prefs.budget.weekly) + '/week'} tone="orange" />
            </View>
          </Card>

          <Txt variant="label" color={colors.inkFaint} style={styles.groupLabel}>
            KITCHEN
          </Txt>
          <Card padded={false}>
            <MenuRow
              icon={<Settings size={17} color={colors.forest} />}
              title="Food preferences & diet"
              subtitle="Diet, allergies, equipment, budget"
              onPress={() => router.push('/preferences')}
            />
            <Divider />
            <MenuRow
              icon={<Package size={17} color={colors.forest} />}
              title="Pantry"
              subtitle={`${state.pantry.length} items · ${state.autoDeductPantry ? 'auto-deduct on' : 'auto-deduct off'}`}
              onPress={() => router.push('/pantry')}
            />
            <Divider />
            <MenuRow
              icon={<BookOpen size={17} color={colors.forest} />}
              title="Saved recipes"
              subtitle={`${favorites} saved`}
              onPress={() => router.push('/(tabs)/recipes')}
            />
            <Divider />
            <MenuRow
              icon={<Heart size={17} color={colors.forest} />}
              title="Meal plans"
              subtitle={activePlan ? activePlan.name : 'No plan yet'}
              onPress={() => setPlansOpen(true)}
            />
            <Divider />
            <MenuRow
              icon={<ShoppingBag size={17} color={colors.forest} />}
              title="Shopping history"
              subtitle={
                state.orders.length
                  ? `${state.orders.length} handoff${state.orders.length === 1 ? '' : 's'} · sandbox only`
                  : 'No retailer handoffs yet'
              }
              onPress={() => setOrdersOpen(true)}
            />
          </Card>

          <Txt variant="label" color={colors.inkFaint} style={styles.groupLabel}>
            PREFERENCES
          </Txt>
          <Card padded={false}>
            <MenuRow
              icon={<Bell size={17} color={colors.forest} />}
              title="Notifications"
              subtitle="Planning, groceries, pantry expiry"
              onPress={() => setNotificationsOpen(true)}
            />
            <Divider />
            <MenuRow
              icon={<Languages size={17} color={colors.forest} />}
              title="Language"
              subtitle={prefs.language === 'hi' ? 'हिंदी (beta)' : 'English'}
              onPress={() => router.push('/preferences')}
            />
            <Divider />
            <MenuRow
              icon={<Wallet size={17} color={colors.forest} />}
              title="Budget"
              subtitle={`${formatINR(prefs.budget.daily)}/day · ${formatINR(prefs.budget.monthly)}/month`}
              onPress={() => router.push('/preferences')}
            />
            <Divider />
            <MenuRow
              icon={<ShieldCheck size={17} color={colors.forest} />}
              title="Privacy & data"
              subtitle="Consent, export, account deletion"
              onPress={() => router.push('/privacy')}
            />
            <Divider />
            <MenuRow
              icon={<HelpCircle size={17} color={colors.forest} />}
              title="Help & grievance"
              subtitle="Contact support, report a problem"
              onPress={() => setHelpOpen(true)}
            />
          </Card>

          {state.user?.isAdmin ? (
            <>
              <Txt variant="label" color={colors.inkFaint} style={styles.groupLabel}>
                ADMIN
              </Txt>
              <Card padded={false}>
                <MenuRow
                  icon={<Shield size={17} color={colors.forest} />}
                  title="Admin console (demo)"
                  subtitle="Users, recipes, ingredients, retailers, analytics"
                  onPress={() => router.push('/admin')}
                />
              </Card>
            </>
          ) : null}

          <Txt variant="label" color={colors.inkFaint} style={styles.groupLabel}>
            ACCOUNT
          </Txt>
          <Card padded={false}>
            <MenuRow
              icon={<Download size={17} color={colors.forest} />}
              title="Export my data"
              subtitle="Download a JSON copy of this device’s data"
              onPress={shareExport}
            />
            <Divider />
            <MenuRow
              icon={<LogOut size={17} color={colors.inkSoft} />}
              title="Sign out"
              subtitle="Your kitchen stays on this device"
              onPress={() => setSignOutOpen(true)}
            />
            <Divider />
            <MenuRow
              icon={<Trash2 size={17} color={colors.red} />}
              title="Delete my account"
              subtitle="Erase this kitchen and all local data"
              danger
              onPress={() => {
                setDeleteConfirm('');
                setDeleteOpen(true);
              }}
            />
          </Card>

          <View style={styles.about}>
            <Txt variant="tiny" color={colors.inkFaint} center>
              Rasoi · v1.0.0 · India-first meal planning
            </Txt>
            <Txt variant="tiny" color={colors.inkFaint} center style={{ marginTop: 2 }}>
              Demo build · no real retailer orders or payments
            </Txt>
          </View>
        </View>
      </ScrollView>

      <Sheet visible={nameOpen} onClose={() => setNameOpen(false)} title="Your name">
        <Field label="Display name" value={name} onChangeText={setName} autoCapitalize="words" />
        <Button
          label="Save name"
          onPress={() => {
            if (name.trim().length < 2) return;
            updateProfile({ name: name.trim() });
            setNameOpen(false);
            setNotice('Name updated.');
          }}
        />
      </Sheet>

      <Sheet visible={householdOpen} onClose={() => setHouseholdOpen(false)} title="Household">
        <Txt variant="small" color={colors.inkSoft} style={{ marginBottom: spacing.md }}>
          Serving changes apply to new meals and regenerated plans. Existing meals keep their own serving counts.
        </Txt>
        <View style={styles.householdRow}>
          <Txt variant="bodyStrong" style={{ flex: 1 }}>
            Adults
          </Txt>
          <Stepper value={adults} onChange={setAdults} min={0} max={12} label="adults" />
        </View>
        <View style={styles.householdRow}>
          <Txt variant="bodyStrong" style={{ flex: 1 }}>
            Children
          </Txt>
          <Stepper value={children} onChange={setChildren} min={0} max={10} label="children" />
        </View>
        <View style={styles.householdRow}>
          <Txt variant="bodyStrong" style={{ flex: 1 }}>
            Default servings
          </Txt>
          <Stepper value={servings} onChange={setServings} min={1} max={20} label="servings" />
        </View>
        <Button
          label="Save household"
          onPress={() => {
            updateHousehold({
              ...household,
              adults,
              children,
              defaultServings: servings,
            });
            setHouseholdOpen(false);
            setNotice('Household updated. Future meals use the new serving size.');
          }}
          style={{ marginTop: spacing.lg }}
        />
      </Sheet>

      <Sheet visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} title="Notifications">
        <Txt variant="small" color={colors.inkSoft} style={{ marginBottom: spacing.md }}>
          Saved on this device. Push delivery requires FCM configuration; this build does not fake notification delivery.
        </Txt>
        <ToggleRow
          title="Weekly planning nudge"
          description="A reminder to plan the week"
          value={state.notifications.weeklyPlan}
          onValueChange={(value) => updateNotifications({ weeklyPlan: value })}
        />
        <ToggleRow
          title="Grocery reminders"
          description="When your list changes or is ready"
          value={state.notifications.groceryReminder}
          onValueChange={(value) => updateNotifications({ groceryReminder: value })}
        />
        <ToggleRow
          title="Pantry expiry"
          description="Before staples expire"
          value={state.notifications.pantryExpiry}
          onValueChange={(value) => updateNotifications({ pantryExpiry: value })}
        />
        <ToggleRow
          title="Cooking reminders"
          description="Resume unfinished recipes"
          value={state.notifications.cookingReminder}
          onValueChange={(value) => updateNotifications({ cookingReminder: value })}
        />
        <ToggleRow
          title="Offers"
          description="Only with explicit consent"
          value={state.notifications.offers}
          onValueChange={(value) => updateNotifications({ offers: value })}
        />
        <Button label="Done" onPress={() => setNotificationsOpen(false)} style={{ marginTop: spacing.md }} />
      </Sheet>

      <Sheet visible={plansOpen} onClose={() => setPlansOpen(false)} title="Meal plans">
        {state.plans.length === 0 ? (
          <Txt variant="small" color={colors.inkSoft}>
            No plans yet. Create one from the Plan tab.
          </Txt>
        ) : (
          state.plans.map((plan) => (
            <Pressable
              key={plan.id}
              onPress={() => {
                setActivePlan(plan.id);
                setPlansOpen(false);
                router.push('/(tabs)/plan');
              }}
              style={styles.planRow}
            >
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong">{plan.name}</Txt>
                <Txt variant="tiny" color={colors.inkSoft}>
                  {weekLabel(plan)} · {planCost(plan, allRecipes).servings} servings
                </Txt>
              </View>
              {plan.id === activePlan?.id ? <Badge label="Active" tone="mint" /> : <ChevronRight size={16} color={colors.inkFaint} />}
            </Pressable>
          ))
        )}
        <Button
          label="Create a new week"
          variant="secondary"
          onPress={() => {
            setPlansOpen(false);
            router.push('/(tabs)/plan');
          }}
          style={{ marginTop: spacing.md }}
        />
      </Sheet>

      <Sheet visible={ordersOpen} onClose={() => setOrdersOpen(false)} title="Shopping history">
        {state.orders.length === 0 ? (
          <View>
            <Txt variant="small" color={colors.inkSoft}>
              No retailer handoffs yet. When you send a list to a retailer, it is recorded here with its true status.
            </Txt>
            <InfoBanner
              message="Rasoi never records an order as placed unless a retailer confirms it. Sandbox carts are labelled as sandbox."
              tone="neutral"
            />
          </View>
        ) : (
          state.orders.map((order) => (
            <View key={order.id} style={styles.orderRow}>
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong">{order.retailerName}</Txt>
                <Txt variant="tiny" color={colors.inkSoft}>
                  {relativeTime(order.createdAt)} · {order.itemCount} items · {formatINR(order.total)}
                </Txt>
                <Txt variant="tiny" color={colors.inkFaint} numberOfLines={2}>
                  {order.note}
                </Txt>
              </View>
              <Badge
                label={
                  order.status === 'sandbox_created'
                    ? 'Sandbox cart'
                    : order.status === 'handed_off'
                      ? 'Handed off'
                      : order.status === 'copied'
                        ? 'Copied'
                        : 'Failed'
                }
                tone={order.status === 'failed' ? 'red' : order.status === 'handed_off' ? 'blue' : 'neutral'}
              />
            </View>
          ))
        )}
      </Sheet>

      <Sheet visible={helpOpen} onClose={() => setHelpOpen(false)} title="Help & grievance">
        <Txt variant="small" color={colors.inkSoft}>
          Rasoi is a demo build. For production, publish a real grievance officer, support email and response timelines as
          required under Indian consumer protection rules.
        </Txt>
        <View style={{ height: spacing.md }} />
        <MenuRow
          icon={<HelpCircle size={17} color={colors.forest} />}
          title="Email support"
          subtitle="grievance@rasoi.example (demo)"
          onPress={() => Linking.openURL('mailto:grievance@rasoi.example?subject=Rasoi%20support')}
        />
        <MenuRow
          icon={<ShieldCheck size={17} color={colors.forest} />}
          title="Read privacy policy"
          subtitle="Data, consent and deletion"
          onPress={() => {
            setHelpOpen(false);
            router.push('/privacy');
          }}
        />
        <MenuRow
          icon={<UserRound size={17} color={colors.forest} />}
          title="Report a recipe"
          subtitle="Flag unsafe or incorrect content"
          onPress={async () => {
            try {
              await Share.share({ message: 'I would like to report a recipe in Rasoi: ' });
            } catch {
              setNotice('Could not open the share sheet.');
            }
          }}
        />
      </Sheet>

      <Sheet visible={signOutOpen} onClose={() => setSignOutOpen(false)} title="Sign out?">
        <Txt variant="small" color={colors.inkSoft} style={{ marginBottom: spacing.lg }}>
          Your plans, pantry and preferences stay saved on this device so you can sign back in.
        </Txt>
        <Button
          label="Sign out"
          variant="outline"
          onPress={async () => {
            setSignOutOpen(false);
            await signOut();
            router.replace('/auth');
          }}
        />
        <View style={{ height: spacing.sm }} />
        <Button label="Stay signed in" variant="ghost" onPress={() => setSignOutOpen(false)} />
      </Sheet>

      <Sheet visible={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete account">
        <InfoBanner
          title="This cannot be undone"
          message="Your profile, household, meal plans, pantry, favourites and shopping history on this device will be erased."
          tone="red"
        />
        <View style={{ height: spacing.lg }} />
        <Field
          label="Type DELETE to confirm"
          value={deleteConfirm}
          onChangeText={setDeleteConfirm}
          autoCapitalize="characters"
          placeholder="DELETE"
        />
        <Button
          label="Delete everything"
          variant="danger"
          disabled={deleteConfirm.trim().toUpperCase() !== 'DELETE'}
          onPress={confirmDelete}
          icon={<Trash2 size={16} color={colors.red} />}
        />
      </Sheet>
    </SafeAreaView>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  onPress,
  danger = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: colors.mintPale }]}>
      <View style={[styles.menuIcon, danger && { backgroundColor: colors.redSoft }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Txt variant="bodyStrong" color={danger ? colors.red : colors.ink}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="tiny" color={colors.inkSoft} numberOfLines={1}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      <ChevronRight size={16} color={colors.inkFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.forest,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  editButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(221,243,231,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
  heroStat: { flex: 1 },
  heroStatDivider: { width: 1, height: 28, backgroundColor: 'rgba(221,243,231,0.2)' },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButton: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  groupLabel: { marginTop: spacing.xl, marginBottom: spacing.sm },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.mintPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  householdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  about: { marginTop: spacing.xl, paddingTop: spacing.lg },
});
