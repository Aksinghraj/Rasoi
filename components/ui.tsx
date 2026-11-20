import { ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Info, Minus, Plus, Utensils, X } from 'lucide-react-native';
import { colors, radius, shadow, spacing } from '@/lib/theme';

type TextVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body'
  | 'bodyStrong'
  | 'small'
  | 'tiny'
  | 'label'
  | 'price';

export function Txt({
  children,
  variant = 'body',
  color = colors.ink,
  style,
  numberOfLines,
  onPress,
  center,
}: {
  children: ReactNode;
  variant?: TextVariant;
  color?: string;
  style?: StyleProp<any>;
  numberOfLines?: number;
  onPress?: () => void;
  center?: boolean;
}) {
  return (
    <Text
      onPress={onPress}
      numberOfLines={numberOfLines}
      maxFontSizeMultiplier={1.35}
      style={[textStyles[variant], { color }, center && { textAlign: 'center' }, style]}
    >
      {children}
    </Text>
  );
}

const textStyles = StyleSheet.create({
  display: { fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -0.8 },
  h1: { fontSize: 26, lineHeight: 32, fontWeight: '800', letterSpacing: -0.5 },
  h2: { fontSize: 21, lineHeight: 27, fontWeight: '700', letterSpacing: -0.3 },
  h3: { fontSize: 17, lineHeight: 23, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  tiny: { fontSize: 11, lineHeight: 15, fontWeight: '500' },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  price: { fontSize: 18, lineHeight: 24, fontWeight: '800', letterSpacing: -0.2 },
});

export function Screen({
  children,
  scroll = false,
  padded = true,
  background = colors.cream,
  edges = ['top'],
  refreshControl,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  background?: string;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  refreshControl?: React.ReactElement<React.ComponentProps<typeof RefreshControl>>;
}) {
  const content = padded ? { padding: spacing.xl } : undefined;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: background }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[{ paddingBottom: spacing.xxxl }, content]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, content]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
  padded = true,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  onPress?: () => void;
}) {
  const base = [styles.card, padded && { padding: spacing.lg }, style];
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [...base, pressed && { opacity: 0.88, transform: [{ scale: 0.995 }] }]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={base}>{children}</View>;
}

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'dark';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  fullWidth = true,
  size = 'md',
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
}) {
  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.forest, fg: colors.white },
    secondary: { bg: colors.mint, fg: colors.forest },
    outline: { bg: 'transparent', fg: colors.forest, border: colors.line },
    ghost: { bg: 'transparent', fg: colors.forest },
    danger: { bg: colors.redSoft, fg: colors.red },
    dark: { bg: colors.forestDeep, fg: colors.white },
  };
  const tone = palette[variant];
  const heights = { sm: 38, md: 48, lg: 54 };
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: tone.bg,
          borderColor: tone.border ?? 'transparent',
          borderWidth: tone.border ? 1 : 0,
          height: heights[size],
          opacity: isDisabled ? 0.5 : pressed ? 0.86 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          paddingHorizontal: size === 'sm' ? spacing.md : spacing.lg,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tone.fg} size="small" />
      ) : (
        <>
          {icon}
          <Text
            maxFontSizeMultiplier={1.3}
            style={{
              color: tone.fg,
              fontWeight: '700',
              fontSize: size === 'sm' ? 13 : 15,
              letterSpacing: 0.1,
            }}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  tone = 'default',
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: ReactNode;
  tone?: 'default' | 'orange' | 'mint';
}) {
  const bg = selected ? colors.forest : tone === 'orange' ? colors.orangeSoft : colors.white;
  const fg = selected ? colors.white : tone === 'orange' ? colors.orange : colors.inkSoft;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: bg, borderColor: selected ? colors.forest : colors.line },
        pressed && { opacity: 0.8 },
      ]}
    >
      {icon}
      <Text maxFontSizeMultiplier={1.25} style={{ color: fg, fontSize: 13, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Badge({
  label,
  tone = 'mint',
  icon,
}: {
  label: string;
  tone?: 'mint' | 'orange' | 'red' | 'neutral' | 'yellow' | 'blue';
  icon?: ReactNode;
}) {
  const map = {
    mint: { bg: colors.mint, fg: colors.forest },
    orange: { bg: colors.orangeSoft, fg: colors.orange },
    red: { bg: colors.redSoft, fg: colors.red },
    neutral: { bg: colors.lineSoft, fg: colors.inkSoft },
    yellow: { bg: colors.yellowSoft, fg: '#8A6A12' },
    blue: { bg: colors.blueSoft, fg: colors.blue },
  };
  const toneColors = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: toneColors.bg }]}>
      {icon}
      <Text maxFontSizeMultiplier={1.2} style={{ color: toneColors.fg, fontSize: 11, fontWeight: '700' }}>
        {label}
      </Text>
    </View>
  );
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
  subtitle,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Txt variant="h2">{title}</Txt>
        {subtitle ? (
          <Txt variant="small" color={colors.inkSoft} style={{ marginTop: 2 }}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text style={{ color: colors.forest, fontWeight: '700', fontSize: 13 }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
  icon,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>{icon ?? <Utensils size={26} color={colors.forest} />}</View>
      <Txt variant="h3" center style={{ marginTop: spacing.md }}>
        {title}
      </Txt>
      <Txt variant="small" color={colors.inkSoft} center style={{ marginTop: spacing.xs, maxWidth: 280 }}>
        {message}
      </Txt>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} size="sm" fullWidth={false} style={{ marginTop: spacing.lg }} />
      ) : null}
    </View>
  );
}

export function LoadingState({ message = 'Loading…' }: { message?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
      <ActivityIndicator color={colors.forest} />
      <Txt variant="small" color={colors.inkSoft} style={{ marginTop: spacing.md }}>
        {message}
      </Txt>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.redSoft }]}>
        <Info size={24} color={colors.red} />
      </View>
      <Txt variant="h3" center style={{ marginTop: spacing.md }}>
        Something went wrong
      </Txt>
      <Txt variant="small" color={colors.inkSoft} center style={{ marginTop: spacing.xs }}>
        {message}
      </Txt>
      {onRetry ? <Button label="Try again" onPress={onRetry} size="sm" fullWidth={false} style={{ marginTop: spacing.lg }} /> : null}
    </View>
  );
}

export function ProgressBar({ value, height = 8, tone = colors.forest }: { value: number; height?: number; tone?: string }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, backgroundColor: colors.lineSoft, borderRadius: radius.pill, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height, backgroundColor: tone, borderRadius: radius.pill }} />
    </View>
  );
}

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 20,
  label = 'servings',
  compact = false,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  compact?: boolean;
}) {
  return (
    <View style={[styles.stepper, compact && { height: 34 }]}>
      <Pressable
        accessibilityLabel={`Decrease ${label}`}
        disabled={value <= min}
        onPress={() => onChange(Math.max(min, value - 1))}
        style={[styles.stepperButton, value <= min && { opacity: 0.35 }]}
      >
        <Minus size={compact ? 14 : 16} color={colors.forest} />
      </Pressable>
      <View style={{ alignItems: 'center', minWidth: compact ? 34 : 54 }}>
        <Text style={{ fontWeight: '800', color: colors.ink, fontSize: compact ? 13 : 16 }}>{value}</Text>
        {!compact ? (
          <Text style={{ fontSize: 10, color: colors.inkFaint, fontWeight: '600' }}>{label}</Text>
        ) : null}
      </View>
      <Pressable
        accessibilityLabel={`Increase ${label}`}
        disabled={value >= max}
        onPress={() => onChange(Math.min(max, value + 1))}
        style={[styles.stepperButton, value >= max && { opacity: 0.35 }]}
      >
        <Plus size={compact ? 14 : 16} color={colors.forest} />
      </Pressable>
    </View>
  );
}

export function Field({
  label,
  error,
  helper,
  right,
  ...props
}: TextInputProps & {
  label?: string;
  error?: string;
  helper?: string;
  right?: ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? (
        <Txt variant="small" color={colors.inkSoft} style={{ fontWeight: '600', marginBottom: 6 }}>
          {label}
        </Txt>
      ) : null}
      <View
        style={[
          styles.inputWrap,
          focused && { borderColor: colors.forest },
          error ? { borderColor: colors.red } : null,
          props.multiline && { height: 96, alignItems: 'flex-start' },
        ]}
      >
        <TextInput
          {...props}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
          placeholderTextColor={colors.inkFaint}
          style={[
            styles.input,
            props.multiline && { height: 88, textAlignVertical: 'top', paddingTop: 10 },
            props.style,
          ]}
        />
        {right}
      </View>
      {error ? (
        <Text style={{ color: colors.red, fontSize: 12, marginTop: 5 }}>{error}</Text>
      ) : helper ? (
        <Text style={{ color: colors.inkFaint, fontSize: 12, marginTop: 5 }}>{helper}</Text>
      ) : null}
    </View>
  );
}

export function InfoBanner({
  title,
  message,
  tone = 'mint',
  icon,
}: {
  title?: string;
  message: string;
  tone?: 'mint' | 'orange' | 'red' | 'neutral';
  icon?: ReactNode;
}) {
  const map = {
    mint: { bg: colors.mintPale, fg: colors.forest },
    orange: { bg: colors.orangeSoft, fg: colors.orange },
    red: { bg: colors.redSoft, fg: colors.red },
    neutral: { bg: colors.lineSoft, fg: colors.inkSoft },
  };
  const palette = map[tone];
  return (
    <View style={[styles.banner, { backgroundColor: palette.bg }]}>
      <View style={{ marginTop: 1 }}>{icon ?? <Info size={16} color={palette.fg} />}</View>
      <View style={{ flex: 1 }}>
        {title ? (
          <Text style={{ color: palette.fg, fontWeight: '700', fontSize: 13, marginBottom: 2 }}>{title}</Text>
        ) : null}
        <Text style={{ color: palette.fg, fontSize: 12.5, lineHeight: 18 }}>{message}</Text>
      </View>
    </View>
  );
}

export function Sheet({
  visible,
  onClose,
  title,
  children,
  height,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  height?: number;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close sheet" />
        <View style={[styles.sheet, height ? { height } : null]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Txt variant="h2">{title}</Txt>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <X size={20} color={colors.inkSoft} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  right?: ReactNode;
}) {
  return (
    <View style={styles.screenHeader}>
      <Pressable
        onPress={onBack}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={styles.backButton}
      >
        <ChevronLeft size={22} color={colors.ink} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Txt variant="h3" numberOfLines={1}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="tiny" color={colors.inkFaint} numberOfLines={1}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function FoodImage({
  uri,
  height = 180,
  borderRadius = radius.lg,
  children,
}: {
  uri: string;
  height?: number;
  borderRadius?: number;
  children?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <View
      style={{
        height,
        borderRadius,
        overflow: 'hidden',
        backgroundColor: colors.mint,
        justifyContent: 'flex-end',
      }}
    >
      {failed ? (
        <View style={StyleSheet.absoluteFill as any}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Utensils size={30} color={colors.forest} />
          </View>
        </View>
      ) : (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill as any}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      )}
      {children}
    </View>
  );
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.forest,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: colors.mint, fontWeight: '800', fontSize: size * 0.36 }}>{initials || 'R'}</Text>
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: colors.lineSoft }, style]} />;
}

export function ToggleRow({
  title,
  description,
  value,
  onValueChange,
}: {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      style={styles.toggleRow}
    >
      <View style={{ flex: 1, paddingRight: spacing.md }}>
        <Txt variant="bodyStrong">{title}</Txt>
        {description ? (
          <Txt variant="tiny" color={colors.inkSoft} style={{ marginTop: 2 }}>
            {description}
          </Txt>
        ) : null}
      </View>
      <View
        style={[
          styles.switchTrack,
          { backgroundColor: value ? colors.forest : colors.line },
        ]}
      >
        <View
          style={[
            styles.switchThumb,
            { alignSelf: value ? 'flex-end' : 'flex-start', backgroundColor: colors.white },
          ]}
        />
      </View>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    ...shadow.card,
  },
  button: {
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    padding: 3,
    height: 42,
    backgroundColor: colors.white,
  },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.mintPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrap: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.ink,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  banner: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'flex-start',
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(7, 38, 29, 0.45)' },
  sheet: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingTop: spacing.sm,
    maxHeight: '88%',
    minHeight: 260,
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
    backgroundColor: colors.cream,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 3,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
});
