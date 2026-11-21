import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowRight, Check, Leaf, Lock, Mail, Phone, ShieldCheck, Sparkles } from 'lucide-react-native';
import { useApp } from '@/lib/store/AppContext';
import { Button, Field, FoodImage, InfoBanner, Sheet, Txt } from '@/components/ui';
import { colors, radius, shadow, spacing } from '@/lib/theme';

const HERO_IMAGE =
  'https://images.pexels.com/photos/2474661/pexels-photo-2474661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop';

type AuthMode = 'otp' | 'password';

export default function AuthScreen() {
  const {
    requestOtp,
    verifyOtp,
    sendEmailCode,
    verifyEmailCode,
    signInWithPassword,
    signUpWithPassword,
    signInDemo,
    pendingOtp,
    cloud,
  } = useApp();
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('otp');
  const [channel, setChannel] = useState<'phone' | 'email'>('phone');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [passwordTab, setPasswordTab] = useState<'signin' | 'signup'>('signin');
  const [stage, setStage] = useState<'identifier' | 'code'>('identifier');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleSheet, setGoogleSheet] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [cloudCodeSent, setCloudCodeSent] = useState(false);

  const emailUsesCloud = channel === 'email' && cloud.configured;

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setStage('identifier');
    setCode('');
    setPassword('');
    setError(null);
    setNotice(null);
    setCloudCodeSent(false);
  };

  const sendCode = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    if (emailUsesCloud) {
      const result = await sendEmailCode(identifier);
      setBusy(false);
      if (!result.ok) {
        setError(result.error ?? 'Could not send the code.');
        return;
      }
      setCloudCodeSent(true);
      setStage('code');
      setNotice(`We emailed a six-digit code to ${identifier.trim()}.`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 450));
    const result = await requestOtp(identifier, channel);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Could not create a code.');
      return;
    }
    setCloudCodeSent(false);
    setStage('code');
  };

  const verify = async () => {
    setError(null);
    setBusy(true);
    const result = cloudCodeSent
      ? await verifyEmailCode(identifier, code)
      : await verifyOtp(code);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Could not verify that code.');
      return;
    }
    router.replace('/(tabs)');
  };

  const submitPassword = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    const result =
      passwordTab === 'signin'
        ? await signInWithPassword(identifier, password)
        : await signUpWithPassword(identifier, password, name);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Could not sign in.');
      return;
    }
    if (result.needsConfirmation) {
      setNotice(`Check ${identifier.trim()} for a confirmation link, then sign in with your password.`);
      setPasswordTab('signin');
      return;
    }
    router.replace('/(tabs)');
  };

  const demo = async () => {
    setBusy(true);
    await new Promise((resolve) => setTimeout(resolve, 350));
    await signInDemo();
    setBusy(false);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.hero}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <Leaf size={18} color={colors.forest} />
              </View>
              <Txt variant="h2" color={colors.mint}>
                rasoi.
              </Txt>
              <View style={styles.tag}>
                <Txt variant="tiny" color={colors.mint} style={{ fontWeight: '700' }}>
                  INDIA
                </Txt>
              </View>
            </View>
            <Txt variant="display" color={colors.white} style={{ marginTop: spacing.lg }}>
              Dinner sorted.{'\n'}Groceries too.
            </Txt>
            <Txt variant="body" color={colors.mintStrong} style={{ marginTop: spacing.sm, maxWidth: 320 }}>
              Plan your week, cook what you love, and turn every recipe into one smart grocery basket.
            </Txt>
            <FoodImage uri={HERO_IMAGE} height={150} borderRadius={radius.lg}>
              <View style={styles.heroOverlay}>
                <View style={styles.heroBadge}>
                  <Sparkles size={13} color={colors.forest} />
                  <Txt variant="tiny" color={colors.forest} style={{ fontWeight: '700' }}>
                    One plan. One list. Zero guesswork.
                  </Txt>
                </View>
              </View>
            </FoodImage>
          </View>

          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Txt variant="h1">Welcome to your kitchen</Txt>
            <Txt variant="small" color={colors.inkSoft} style={{ marginTop: 4 }}>
              {cloud.configured
                ? 'Sign in to sync your plans, pantry and lists across devices.'
                : 'Sign in to keep your kitchen in one place. Cloud sync is off in this build.'}
            </Txt>

            <View style={styles.modeRow}>
              <Pressable
                onPress={() => switchMode('otp')}
                style={[styles.modeItem, mode === 'otp' && styles.modeActive]}
              >
                <Txt variant="small" color={mode === 'otp' ? colors.forest : colors.inkSoft} style={{ fontWeight: '700' }}>
                  One-time code
                </Txt>
              </Pressable>
              <Pressable
                onPress={() => switchMode('password')}
                style={[styles.modeItem, mode === 'password' && styles.modeActive]}
              >
                <Txt variant="small" color={mode === 'password' ? colors.forest : colors.inkSoft} style={{ fontWeight: '700' }}>
                  Password
                </Txt>
              </Pressable>
            </View>

            {mode === 'otp' ? (
              stage === 'identifier' ? (
                <>
                  <View style={styles.segment}>
                    <Pressable
                      onPress={() => {
                        setChannel('phone');
                        setIdentifier('');
                        setError(null);
                        setNotice(null);
                      }}
                      style={[styles.segmentItem, channel === 'phone' && styles.segmentActive]}
                    >
                      <Phone size={15} color={channel === 'phone' ? colors.forest : colors.inkSoft} />
                      <Txt variant="small" color={channel === 'phone' ? colors.forest : colors.inkSoft} style={{ fontWeight: '700' }}>
                        Phone
                      </Txt>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setChannel('email');
                        setIdentifier('');
                        setError(null);
                        setNotice(null);
                      }}
                      style={[styles.segmentItem, channel === 'email' && styles.segmentActive]}
                    >
                      <Mail size={15} color={channel === 'email' ? colors.forest : colors.inkSoft} />
                      <Txt variant="small" color={channel === 'email' ? colors.forest : colors.inkSoft} style={{ fontWeight: '700' }}>
                        Email
                      </Txt>
                    </Pressable>
                  </View>

                  {channel === 'phone' ? (
                    <Field
                      label="Mobile number"
                      placeholder="98765 43210"
                      keyboardType="phone-pad"
                      autoComplete="tel"
                      value={identifier}
                      onChangeText={(value) => setIdentifier(value.replace(/[^0-9 ]/g, ''))}
                      maxLength={13}
                      error={error ?? undefined}
                      helper="Indian mobile numbers only. +91 is added automatically."
                      right={<Txt variant="small" color={colors.inkFaint}>+91</Txt>}
                    />
                  ) : (
                    <Field
                      label="Email address"
                      placeholder="you@example.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      value={identifier}
                      onChangeText={setIdentifier}
                      error={error ?? undefined}
                      helper={emailUsesCloud ? 'We email a six-digit sign-in code.' : 'Local demo code. Cloud email is not configured.'}
                    />
                  )}

                  <Button
                    label="Send one-time code"
                    onPress={sendCode}
                    loading={busy}
                    icon={<ArrowRight size={17} color={colors.white} />}
                  />
                </>
              ) : (
                <>
                  {cloudCodeSent ? (
                    <InfoBanner
                      title="Check your inbox"
                      message={`We sent a six-digit code to ${identifier.trim()}. It expires shortly, so use it soon.`}
                      tone="neutral"
                      icon={<Mail size={16} color={colors.inkSoft} />}
                    />
                  ) : (
                    <InfoBanner
                      title={`Demo code for ${pendingOtp?.identifier ?? ''}`}
                      message={`${pendingOtp?.code ?? '------'} · This build shows the OTP on screen. Connect an SMS or email provider before production.`}
                      tone="orange"
                    />
                  )}
                  <View style={{ height: spacing.md }} />
                  <Field
                    label="Six-digit code"
                    placeholder="000000"
                    keyboardType="number-pad"
                    value={code}
                    onChangeText={(value) => setCode(value.replace(/[^0-9]/g, '').slice(0, 6))}
                    maxLength={6}
                    error={error ?? undefined}
                    helper="Codes expire after five minutes."
                  />
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Button
                      label="Verify & continue"
                      onPress={verify}
                      loading={busy}
                      disabled={code.length !== 6}
                      style={{ flex: 1 }}
                    />
                    {!cloudCodeSent ? (
                      <Button
                        label="Use demo code"
                        variant="secondary"
                        size="md"
                        fullWidth={false}
                        onPress={() => setCode(pendingOtp?.code ?? '')}
                      />
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => {
                      setStage('identifier');
                      setCode('');
                      setError(null);
                      setNotice(null);
                      setCloudCodeSent(false);
                    }}
                    style={{ marginTop: spacing.md, alignSelf: 'center' }}
                  >
                    <Txt variant="small" color={colors.forest} style={{ fontWeight: '600' }}>
                      Use a different number or email
                    </Txt>
                  </Pressable>
                </>
              )
            ) : (
              <>
                <View style={styles.segment}>
                  <Pressable
                    onPress={() => {
                      setPasswordTab('signin');
                      setError(null);
                      setNotice(null);
                    }}
                    style={[styles.segmentItem, passwordTab === 'signin' && styles.segmentActive]}
                  >
                    <Txt variant="small" color={passwordTab === 'signin' ? colors.forest : colors.inkSoft} style={{ fontWeight: '700' }}>
                      Sign in
                    </Txt>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setPasswordTab('signup');
                      setError(null);
                      setNotice(null);
                    }}
                    style={[styles.segmentItem, passwordTab === 'signup' && styles.segmentActive]}
                  >
                    <Txt variant="small" color={passwordTab === 'signup' ? colors.forest : colors.inkSoft} style={{ fontWeight: '700' }}>
                      Create account
                    </Txt>
                  </Pressable>
                </View>

                {passwordTab === 'signup' ? (
                  <Field
                    label="Your name"
                    placeholder="Meera"
                    autoComplete="name"
                    value={name}
                    onChangeText={setName}
                    helper="Used to greet you in the kitchen."
                  />
                ) : null}

                <Field
                  label="Email address"
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  value={identifier}
                  onChangeText={setIdentifier}
                  error={error ?? undefined}
                />

                <Field
                  label="Password"
                  placeholder="At least 8 characters"
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete={passwordTab === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChangeText={setPassword}
                  right={<Lock size={15} color={colors.inkFaint} />}
                  helper={passwordTab === 'signup' ? 'Use 8+ characters with a letter and a number.' : undefined}
                />

                <Button
                  label={passwordTab === 'signin' ? 'Sign in' : 'Create account'}
                  onPress={submitPassword}
                  loading={busy}
                  disabled={!identifier.trim() || password.length === 0}
                  icon={<ArrowRight size={17} color={colors.white} />}
                />

                {!cloud.configured ? (
                  <Txt variant="tiny" color={colors.inkFaint} style={{ marginTop: spacing.sm }}>
                    Password accounts need a Supabase project. Add the environment keys to enable them.
                  </Txt>
                ) : null}
              </>
            )}

            {cloud.error ? (
              <View style={{ marginTop: spacing.md }}>
                <InfoBanner message={cloud.error} tone="orange" />
              </View>
            ) : null}

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Txt variant="tiny" color={colors.inkFaint}>
                OR
              </Txt>
              <View style={styles.divider} />
            </View>

            <Button
              label="Explore a demo kitchen"
              variant="secondary"
              onPress={demo}
              loading={busy}
              icon={<Check size={17} color={colors.forest} />}
            />
            <Pressable onPress={() => setGoogleSheet(true)} style={styles.googleButton}>
              <Txt variant="bodyStrong" color={colors.ink}>
                G
              </Txt>
              <Txt variant="small" color={colors.inkSoft} style={{ fontWeight: '600' }}>
                Continue with Google
              </Txt>
            </Pressable>

            {notice ? (
              <View style={{ marginTop: spacing.md }}>
                <InfoBanner message={notice} tone="neutral" />
              </View>
            ) : null}

            <View style={styles.legal}>
              <ShieldCheck size={13} color={colors.inkFaint} />
              <Txt variant="tiny" color={colors.inkFaint} style={{ flex: 1 }}>
                By continuing you agree to our Terms and Privacy Policy. OTP delivery, Google OAuth and push notifications
                require provider configuration before launch.
              </Txt>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Sheet visible={googleSheet} onClose={() => setGoogleSheet(false)} title="Google sign-in">
        <InfoBanner
          title="Configuration required"
          message="Google OAuth is not connected in this build, so we will not pretend to sign you in. Enable the Google provider in Supabase to add it."
          tone="neutral"
          icon={<ShieldCheck size={16} color={colors.inkSoft} />}
        />
        <View style={{ height: spacing.lg }} />
        <Button
          label="Use the demo kitchen instead"
          onPress={async () => {
            setGoogleSheet(false);
            await demo();
          }}
          icon={<Sparkles size={17} color={colors.white} />}
        />
        <View style={{ height: spacing.sm }} />
        <Button label="Close" variant="ghost" onPress={() => setGoogleSheet(false)} />
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.forest },
  hero: {
    backgroundColor: colors.forest,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    marginLeft: 'auto',
    borderWidth: 1,
    borderColor: 'rgba(221,243,231,0.35)',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  heroOverlay: { flex: 1, justifyContent: 'flex-end', padding: spacing.md },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.cream,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -18,
    padding: spacing.xl,
    paddingTop: spacing.md,
    minHeight: 480,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  modeItem: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  modeActive: { backgroundColor: colors.mint, borderColor: colors.mint },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.line,
    marginVertical: spacing.lg,
  },
  segmentItem: {
    flex: 1,
    height: 38,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segmentActive: { backgroundColor: colors.mint },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.lg },
  divider: { flex: 1, height: 1, backgroundColor: colors.line },
  googleButton: {
    marginTop: spacing.sm,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...shadow.card,
  },
  legal: { flexDirection: 'row', gap: 6, marginTop: spacing.lg, alignItems: 'flex-start' },
});
