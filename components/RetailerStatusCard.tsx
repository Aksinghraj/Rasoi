import { Pressable, StyleSheet, View } from 'react-native';
import { Check, ChevronRight, ExternalLink, Minus, Store } from 'lucide-react-native';
import { Badge, Button, Card, Txt } from '@/components/ui';
import { colors, radius, spacing } from '@/lib/theme';
import { formatINR } from '@/lib/format';
import type { RetailerCapabilityView } from '@/lib/retailers/adapters';

export function RetailerLogo({ view, size = 44 }: { view: RetailerCapabilityView; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.sm,
        backgroundColor: view.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityLabel={`${view.name} logo`}
    >
      <Txt color={colors.white} style={{ fontWeight: '800', fontSize: size * 0.32, letterSpacing: 0.4 }}>
        {view.logoText}
      </Txt>
    </View>
  );
}

type StatusTone = 'ours' | 'estimate' | 'unverified' | 'retailer';

function StatusRow({ label, value, tone }: { label: string; value: string; tone: StatusTone }) {
  const palette: Record<StatusTone, { color: string; icon: typeof Check }> = {
    ours: { color: colors.forest, icon: Check },
    estimate: { color: colors.orange, icon: Store },
    unverified: { color: colors.inkFaint, icon: Minus },
    retailer: { color: colors.blue, icon: ExternalLink },
  };
  const meta = palette[tone];
  const Icon = meta.icon;
  return (
    <View style={styles.statusRow}>
      <Txt variant="tiny" color={colors.inkSoft} style={{ flex: 1 }}>
        {label}
      </Txt>
      <View style={styles.statusValue}>
        <Icon size={11} color={meta.color} />
        <Txt variant="tiny" color={meta.color} style={{ fontWeight: '700' }}>
          {value}
        </Txt>
      </View>
    </View>
  );
}

export function RetailerStatusCard({
  view,
  variant = 'full',
  estimate,
  matchedLines,
  totalLines,
  onPress,
  onOpen,
  opening = false,
}: {
  view: RetailerCapabilityView;
  variant?: 'full' | 'compact';
  estimate?: number | null;
  matchedLines?: number;
  totalLines?: number;
  onPress?: () => void;
  onOpen?: () => void;
  opening?: boolean;
}) {
  const isSandbox = view.status === 'sandbox';
  const matchLabel =
    matchedLines !== undefined && totalLines !== undefined
      ? `${matchedLines}/${totalLines} lines matched`
      : 'Matched by Rasoi';

  if (variant === 'compact') {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${view.name}, ${view.modeLabel} integration`}
        style={({ pressed }) => [styles.compact, pressed && { opacity: 0.8 }]}
      >
        <RetailerLogo view={view} size={40} />
        <View style={{ flex: 1 }}>
          <View style={styles.compactTitle}>
            <Txt variant="bodyStrong" numberOfLines={1}>
              {view.name}
            </Txt>
            <Badge label={view.modeLabel} tone={isSandbox ? 'mint' : 'neutral'} />
          </View>
          <Txt variant="tiny" color={colors.inkSoft} numberOfLines={1}>
            {matchLabel}
            {estimate != null ? ` · est. ${formatINR(estimate)}` : ''}
          </Txt>
          <Txt variant="tiny" color={colors.inkFaint} numberOfLines={1}>
            {isSandbox
              ? 'Sandbox estimate · nothing is ordered'
              : `Final price and stock in the ${view.shortName} app`}
          </Txt>
        </View>
        <ChevronRight size={16} color={colors.inkFaint} />
      </Pressable>
    );
  }

  return (
    <Card>
      <View style={styles.header}>
        <RetailerLogo view={view} />
        <View style={{ flex: 1 }}>
          <View style={styles.compactTitle}>
            <Txt variant="h3" numberOfLines={1} style={{ flexShrink: 1 }}>
              {view.name}
            </Txt>
            <Badge label={view.modeLabel} tone={isSandbox ? 'mint' : 'neutral'} />
          </View>
          <Txt variant="tiny" color={colors.inkSoft} numberOfLines={2}>
            {view.description}
          </Txt>
        </View>
      </View>

      <View style={styles.statusList}>
        <StatusRow label="Product matching" value={matchLabel} tone="ours" />
        {estimate != null ? (
          <StatusRow
            label={isSandbox ? 'Sandbox price' : 'Price estimate'}
            value={`${formatINR(estimate)}${isSandbox ? '' : ' · demo catalogue'}`}
            tone="estimate"
          />
        ) : null}
        <StatusRow label="Live price" value="Not verified" tone="unverified" />
        <StatusRow label="Live stock" value="Not verified" tone="unverified" />
        <StatusRow
          label="Delivery"
          value={isSandbox ? 'Simulated only' : `Confirm in ${view.shortName}`}
          tone={isSandbox ? 'unverified' : 'retailer'}
        />
        {view.sandboxCart ? (
          <StatusRow label="Cart" value="Sandbox cart in this app" tone="ours" />
        ) : null}
      </View>

      <Txt variant="tiny" color={colors.inkFaint} style={{ marginTop: spacing.sm }}>
        {view.pricingNote}
      </Txt>

      {onOpen ? (
        <Button
          label={view.openLabel}
          icon={<ExternalLink size={15} color={colors.white} />}
          loading={opening}
          onPress={onOpen}
          style={{ marginTop: spacing.md }}
        />
      ) : null}

      <Txt variant="tiny" color={colors.inkFaint} style={{ marginTop: spacing.sm }}>
        {view.handoffTip}
      </Txt>
    </Card>
  );
}

const styles = StyleSheet.create({
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.paper,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  compactTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  statusList: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 3,
  },
  statusValue: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
