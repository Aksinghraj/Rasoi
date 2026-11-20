import { useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Download, Mail, ShieldCheck, Trash2 } from 'lucide-react-native';
import { useApp } from '@/lib/store/AppContext';
import {
  Badge,
  Button,
  Card,
  InfoBanner,
  ScreenHeader,
  Sheet,
  Txt,
  ToggleRow,
} from '@/components/ui';
import { colors, spacing } from '@/lib/theme';

export default function PrivacyScreen() {
  const router = useRouter();
  const { state, updateConsents, exportData, deleteAccount, addAudit } = useApp();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exported, setExported] = useState(false);

  const handleExport = async () => {
    const payload = exportData();
    setBusy(true);
    try {
      await Share.share({ message: payload, title: 'Rasoi data export' });
      addAudit('data_exported', 'User exported their account data');
      setExported(true);
    } catch {
      addAudit('data_export_failed', 'Data export could not be shared');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    await deleteAccount();
    setDeleteOpen(false);
    setBusy(false);
    router.replace('/auth');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
      <ScreenHeader title="Privacy & data" subtitle="Consent, export and deletion" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <ShieldCheck size={18} color={colors.forest} />
            <Txt variant="h3">Your choices</Txt>
          </View>
          <Txt variant="tiny" color={colors.inkSoft} style={{ marginTop: 4 }}>
            You can change these at any time. Turning something off stops future use; it does not delete past data.
          </Txt>
          <View style={{ marginTop: spacing.md }}>
            <ToggleRow
              title="Personalised recommendations"
              description="Use diet, pantry and plan history to rank recipes on this device."
              value={state.consents.personalisation}
              onValueChange={(value) => updateConsents({ personalisation: value })}
            />
            <ToggleRow
              title="Usage analytics"
              description="Share anonymised feature events to improve the app. Off by default."
              value={state.consents.analytics}
              onValueChange={(value) => updateConsents({ analytics: value })}
            />
            <ToggleRow
              title="Offers and promotions"
              description="Receive occasional retailer offers. Never shared without this consent."
              value={state.consents.offers}
              onValueChange={(value) => updateConsents({ offers: value })}
            />
            <ToggleRow
              title="Share list with retailer on hand-off"
              description="Send matched item names to a retailer when you open its app. Required for deep-link hand-off."
              value={state.consents.retailerSharing}
              onValueChange={(value) => updateConsents({ retailerSharing: value })}
            />
          </View>
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Txt variant="h3">What Rasoi stores</Txt>
          <View style={{ marginTop: spacing.sm, gap: 6 }}>
            <Row label="Account" value={state.user?.phone ?? state.user?.email ?? 'Demo session'} />
            <Row label="Household & diet" value={state.preferences ? `${state.preferences.diet} · ${state.preferences.city}` : 'Not set'} />
            <Row label="Pantry items" value={`${state.pantry.length}`} />
            <Row label="Meal plans" value={`${state.plans.length}`} />
            <Row label="Retailer hand-offs" value={`${state.orders.length} (sandbox / deep link)`} />
            <Row label="Data location" value="This device (AsyncStorage)" />
          </View>
          <View style={{ marginTop: spacing.md }}>
            <InfoBanner
              message="This build stores everything locally on your device. There is no Rasoi server receiving your household, pantry or plan data. Demo mode is clearly labelled throughout."
              tone="neutral"
            />
          </View>
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Txt variant="h3">Export your data</Txt>
          <Txt variant="tiny" color={colors.inkSoft} style={{ marginTop: 4 }}>
            Download a JSON copy of your profile, preferences, pantry, plans, orders and audit log.
          </Txt>
          <Button
            label={exported ? 'Export again' : 'Export as JSON'}
            variant="secondary"
            icon={<Download size={16} color={colors.forest} />}
            style={{ marginTop: spacing.md }}
            loading={busy}
            onPress={handleExport}
          />
          {exported ? (
            <Txt variant="tiny" color={colors.forest} style={{ marginTop: spacing.sm }}>
              Export shared. The payload contains your local data only.
            </Txt>
          ) : null}
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Txt variant="h3">Delete your account</Txt>
          <Txt variant="tiny" color={colors.inkSoft} style={{ marginTop: 4 }}>
            Removes your session, household, plans, pantry, orders and audit log from this device immediately. This cannot be
            undone.
          </Txt>
          <Button
            label="Delete account and data"
            variant="danger"
            icon={<Trash2 size={16} color={colors.red} />}
            style={{ marginTop: spacing.md }}
            onPress={() => setDeleteOpen(true)}
          />
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Txt variant="h3">Your rights and our duties</Txt>
          <View style={{ marginTop: spacing.sm, gap: spacing.md }}>
            <Legal
              title="Consent and purpose limitation"
              body="We ask for consent before using personal data for personalisation, analytics, offers or retailer sharing, in line with India's Digital Personal Data Protection Act, 2023. We collect only what a feature needs."
            />
            <Legal
              title="Data minimisation"
              body="Your PIN code is used only to check serviceability. We do not store payment details. Retailer credentials are never held in the app."
            />
            <Legal
              title="Retailer and consumer rules"
              body="Rasoi does not place orders on your behalf in deep-link mode. Prices, stock, payments and delivery are the retailer's responsibility. Sandbox mode never places a real order."
            />
            <Legal
              title="Grievance officer"
              body="For data or consumer grievances, write to grievance@rasoi.example with your registered number and a short description. We aim to respond within 30 days."
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }}>
            <Mail size={15} color={colors.forest} />
            <Txt variant="small" color={colors.forest} style={{ fontWeight: '600' }}>
              grievance@rasoi.example
            </Txt>
            <Badge label="Demo contact" tone="neutral" />
          </View>
        </Card>
      </ScrollView>

      <Sheet visible={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete account?">
        <InfoBanner
          tone="red"
          title="This cannot be undone"
          message="Your profile, preferences, pantry, meal plans, orders and audit history will be erased from this device."
        />
        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          <Button label="Yes, delete everything" variant="danger" loading={busy} onPress={handleDelete} />
          <Button label="Keep my account" variant="ghost" onPress={() => setDeleteOpen(false)} />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Txt variant="small" color={colors.inkSoft}>
        {label}
      </Txt>
      <Txt variant="small" style={{ fontWeight: '600', flex: 1, textAlign: 'right' }} numberOfLines={1}>
        {value}
      </Txt>
    </View>
  );
}

function Legal({ title, body }: { title: string; body: string }) {
  return (
    <View>
      <Txt variant="bodyStrong">{title}</Txt>
      <Txt variant="tiny" color={colors.inkSoft} style={{ marginTop: 2 }}>
        {body}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 4,
  },
});
