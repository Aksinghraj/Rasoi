import { Pressable, StyleSheet, View } from 'react-native';
import { Clock, Heart, Users } from 'lucide-react-native';
import { Recipe } from '@/lib/types';
import { colors, radius, spacing } from '@/lib/theme';
import { formatINR } from '@/lib/format';
import { FoodImage, Txt } from '@/components/ui';
import { recipeAllergens } from '@/lib/engine/allergens';

export function DietMark({ foodType, size = 14 }: { foodType: Recipe['foodType']; size?: number }) {
  const color = foodType === 'veg' ? '#1E7A45' : foodType === 'egg' ? '#C98A1B' : '#B23B32';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderWidth: 1.5,
        borderColor: color,
        borderRadius: 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.white,
      }}
    >
      <View style={{ width: size * 0.42, height: size * 0.42, borderRadius: size * 0.21, backgroundColor: color }} />
    </View>
  );
}

export function RecipeCard({
  recipe,
  onPress,
  variant = 'wide',
  reasons,
  isFavorite = false,
  onToggleFavorite,
  compactMeta = false,
}: {
  recipe: Recipe;
  onPress: () => void;
  variant?: 'wide' | 'row';
  reasons?: string[];
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  compactMeta?: boolean;
}) {
  const totalTime = recipe.prepMinutes + recipe.cookMinutes;
  const allergens = recipeAllergens(recipe);

  if (variant === 'row') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${recipe.name}, ${totalTime} minutes`}
        onPress={onPress}
        style={({ pressed }) => [styles.rowCard, pressed && { opacity: 0.86 }]}
      >
        <FoodImage uri={recipe.image} height={92} borderRadius={radius.sm}>
          <View style={styles.rowImageOverlay}>
            <DietMark foodType={recipe.foodType} />
          </View>
        </FoodImage>
        <View style={{ flex: 1, paddingVertical: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Txt variant="tiny" color={colors.inkFaint} numberOfLines={1} style={{ flex: 1 }}>
              {recipe.cuisine} · {recipe.mealTypes[0]}
            </Txt>
            {onToggleFavorite ? (
              <Pressable onPress={onToggleFavorite} hitSlop={8} accessibilityLabel="Toggle favourite">
                <Heart size={16} color={isFavorite ? colors.orange : colors.inkFaint} fill={isFavorite ? colors.orange : 'transparent'} />
              </Pressable>
            ) : null}
          </View>
          <Txt variant="bodyStrong" numberOfLines={1} style={{ marginTop: 2 }}>
            {recipe.name}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 5 }}>
            <View style={styles.metaItem}>
              <Clock size={12} color={colors.inkSoft} />
              <Txt variant="tiny" color={colors.inkSoft}>
                {totalTime} min
              </Txt>
            </View>
            <View style={styles.metaItem}>
              <Users size={12} color={colors.inkSoft} />
              <Txt variant="tiny" color={colors.inkSoft}>
                {recipe.baseServings}
              </Txt>
            </View>
            <Txt variant="tiny" color={colors.forest} style={{ fontWeight: '700' }}>
              {formatINR(recipe.costPerServing)}/serve
            </Txt>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${recipe.name}, ${totalTime} minutes, ${recipe.difficulty}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9, transform: [{ scale: 0.997 }] }]}
    >
      <FoodImage uri={recipe.image} height={188} borderRadius={radius.sm}>
        <View style={styles.topRow}>
          <View style={styles.dietPill}>
            <DietMark foodType={recipe.foodType} />
            <Txt variant="tiny" color={colors.ink} style={{ fontWeight: '700' }}>
              {recipe.foodType === 'non_veg' ? 'Non-veg' : recipe.foodType === 'egg' ? 'Egg' : 'Veg'}
            </Txt>
          </View>
          {onToggleFavorite ? (
            <Pressable
              onPress={onToggleFavorite}
              hitSlop={8}
              accessibilityLabel={isFavorite ? 'Remove from favourites' : 'Save to favourites'}
              style={styles.heart}
            >
              <Heart
                size={17}
                color={isFavorite ? colors.orange : colors.ink}
                fill={isFavorite ? colors.orange : 'rgba(255,255,255,0.7)'}
              />
            </Pressable>
          ) : null}
        </View>
      </FoodImage>
      <View style={{ padding: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Txt variant="tiny" color={colors.orange} style={{ fontWeight: '800', textTransform: 'uppercase' }}>
            {recipe.cuisine}
          </Txt>
          <View style={styles.dot} />
          <Txt variant="tiny" color={colors.inkFaint}>
            {recipe.difficulty}
          </Txt>
          {allergens.length === 0 ? null : (
            <>
              <View style={styles.dot} />
              <Txt variant="tiny" color={colors.inkFaint} numberOfLines={1} style={{ flex: 1 }}>
                {allergens.length} allergen{allergens.length > 1 ? 's' : ''}
              </Txt>
            </>
          )}
        </View>
        <Txt variant="h3" numberOfLines={1} style={{ marginTop: 3 }}>
          {recipe.name}
        </Txt>
        {!compactMeta ? (
          <Txt variant="small" color={colors.inkSoft} numberOfLines={2} style={{ marginTop: 4 }}>
            {recipe.description}
          </Txt>
        ) : null}
        <View style={styles.footer}>
          <View style={styles.metaItem}>
            <Clock size={13} color={colors.forest} />
            <Txt variant="tiny" color={colors.inkSoft} style={{ fontWeight: '600' }}>
              {totalTime} min
            </Txt>
          </View>
          <View style={styles.metaItem}>
            <Users size={13} color={colors.forest} />
            <Txt variant="tiny" color={colors.inkSoft} style={{ fontWeight: '600' }}>
              Serves {recipe.baseServings}
            </Txt>
          </View>
          <Txt variant="tiny" color={colors.forest} style={{ fontWeight: '800', marginLeft: 'auto' }}>
            {formatINR(recipe.costPerServing)}/serve
          </Txt>
        </View>
        {reasons && reasons.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm }}>
            {reasons.slice(0, 2).map((reason) => (
              <View key={reason} style={styles.reason}>
                <Txt variant="tiny" color={colors.forest} style={{ fontWeight: '600' }}>
                  {reason}
                </Txt>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderRadius: radius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  dietPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    height: 26,
  },
  heart: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.inkFaint },
  reason: {
    backgroundColor: 'transparent',
    borderLeftWidth: 2,
    borderLeftColor: colors.terracotta,
    paddingLeft: 6,
    paddingVertical: 1,
  },
  rowCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.paper,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowImageOverlay: {
    padding: 6,
  },
});
