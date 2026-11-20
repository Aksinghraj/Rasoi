import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowUpDown,
  Check,
  ChefHat,
  Filter,
  Heart,
  Leaf,
  Search,
  SlidersHorizontal,
  Sparkles,
  Wallet,
  X,
  Zap,
} from 'lucide-react-native';
import { defaultPreferences, useApp } from '@/lib/store/AppContext';
import {
  Badge,
  Button,
  Chip,
  EmptyState,
  Field,
  Sheet,
  Txt,
} from '@/components/ui';
import { RecipeCard } from '@/components/RecipeCard';
import { colors, difficultyLabels, mealSlotLabels, radius, spacing } from '@/lib/theme';
import { availableCuisines, RecipeFilters, recommendRecipes, surpriseMe } from '@/lib/engine/recommendation';
import { MealSlot } from '@/lib/types';

type Mode = 'foryou' | 'pantry' | 'quick' | 'budget' | 'protein' | 'favourites';
type Sort = 'recommended' | 'time' | 'cost' | 'protein';

export default function RecipesScreen() {
  const { state, allRecipes, toggleFavorite } = useApp();
  const router = useRouter();
  const prefs = state.preferences ?? defaultPreferences;
  const [query, setQuery] = useState('');
  const [mealType, setMealType] = useState<MealSlot | 'all'>('all');
  const [mode, setMode] = useState<Mode>('foryou');
  const [sort, setSort] = useState<Sort>('recommended');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [cuisine, setCuisine] = useState('All');
  const [maxTime, setMaxTime] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState('All');
  const [maxCost, setMaxCost] = useState<number | null>(null);

  const cuisines = useMemo(() => availableCuisines(allRecipes), [allRecipes]);
  const pantryIds = state.pantry.map((item) => item.ingredientId);

  const results = useMemo(() => {
    const filters: RecipeFilters = {
      query,
      mealType,
      cuisine,
      difficulty,
      maxTime: maxTime ?? (mode === 'quick' ? 30 : 180),
      maxCost: mode === 'budget' ? 45 : (maxCost ?? undefined),
    };
    let entries = recommendRecipes(
      {
        prefs,
        recipes: allRecipes,
        recentRecipeIds: state.recentRecipeIds,
        pantryIngredientIds: pantryIds,
      },
      filters,
      60,
    );
    if (mode === 'pantry') {
      entries = entries.filter(
        (entry) =>
          entry.recipe.ingredients.filter((item) => pantryIds.includes(item.ingredientId)).length >= 2,
      );
    }
    if (mode === 'protein') {
      entries = entries.filter((entry) => entry.recipe.nutrition.protein >= 18);
    }
    if (mode === 'favourites') {
      entries = entries.filter((entry) => state.favorites.includes(entry.recipe.id));
    }
    if (sort === 'time') {
      entries = [...entries].sort(
        (a, b) =>
          a.recipe.prepMinutes + a.recipe.cookMinutes - (b.recipe.prepMinutes + b.recipe.cookMinutes),
      );
    }
    if (sort === 'cost') {
      entries = [...entries].sort((a, b) => a.recipe.costPerServing - b.recipe.costPerServing);
    }
    if (sort === 'protein') {
      entries = [...entries].sort((a, b) => b.recipe.nutrition.protein - a.recipe.nutrition.protein);
    }
    return entries;
  }, [
    prefs,
    allRecipes,
    state.recentRecipeIds,
    state.favorites,
    pantryIds,
    query,
    mealType,
    mode,
    cuisine,
    difficulty,
    maxTime,
    maxCost,
    sort,
  ]);

  const activeFilterCount =
    (cuisine !== 'All' ? 1 : 0) +
    (maxTime ? 1 : 0) +
    (difficulty !== 'All' ? 1 : 0) +
    (maxCost ? 1 : 0);

  const handleSurprise = () => {
    const recipe = surpriseMe({
      prefs,
      recipes: allRecipes,
      recentRecipeIds: state.recentRecipeIds,
      pantryIngredientIds: pantryIds,
    });
    if (recipe) router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } });
  };

  const modes: { id: Mode; label: string; icon: typeof Sparkles }[] = [
    { id: 'foryou', label: 'For you', icon: Sparkles },
    { id: 'pantry', label: 'Use my pantry', icon: ChefHat },
    { id: 'quick', label: 'Quick', icon: Zap },
    { id: 'budget', label: 'Budget', icon: Wallet },
    { id: 'protein', label: 'High protein', icon: Leaf },
    { id: 'favourites', label: 'Saved', icon: Heart },
  ];

  const header = (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Txt variant="tiny" color={colors.orange} style={{ fontWeight: '800', letterSpacing: 1.5, marginBottom: 5 }}>THE RECIPE COLLECTION</Txt>
          <Txt variant="h1">Find something lovely to cook.</Txt>
          <Txt variant="small" color={colors.inkSoft} style={{ marginTop: 2 }}>
            {allRecipes.length} recipes matched to your kitchen
          </Txt>
        </View>
        <Pressable
          onPress={() => router.push('/recipe/create')}
          style={styles.addButton}
          accessibilityLabel="Create a recipe"
        >
          <ChefHat size={17} color={colors.forest} />
          <Txt variant="tiny" color={colors.forest} style={{ fontWeight: '700' }}>
            Add
          </Txt>
        </Pressable>
      </View>

      <View style={[styles.searchWrap, { borderRadius: radius.md, minHeight: 52, marginTop: spacing.lg }]}>
        <Search size={18} color={colors.inkFaint} />
        <Field
          placeholder="Search dishes, cuisines or ingredients"
          value={query}
          onChangeText={setQuery}
          style={{ marginBottom: 0, paddingVertical: 4 }}
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
            <X size={17} color={colors.inkSoft} />
          </Pressable>
        ) : null}
      </View>

      <Txt variant="tiny" color={colors.inkFaint} style={{ fontWeight: '800', letterSpacing: 1, marginTop: spacing.md }}>
        BROWSE BY MEAL
      </Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: spacing.sm }}>
        <Chip label="All meals" selected={mealType === 'all'} onPress={() => setMealType('all')} />
        {(['breakfast', 'lunch', 'dinner', 'snack'] as MealSlot[]).map((slot) => (
          <Chip
            key={slot}
            label={mealSlotLabels[slot]}
            selected={mealType === slot}
            onPress={() => setMealType(slot)}
          />
        ))}
      </ScrollView>

      <Txt variant="tiny" color={colors.inkFaint} style={{ fontWeight: '800', letterSpacing: 1, marginTop: spacing.xs }}>
        YOUR SHORTCUTS
      </Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: spacing.sm }}>
        {modes.map((item) => {
          const Icon = item.icon;
          return (
            <Chip
              key={item.id}
              label={item.label}
              icon={<Icon size={13} color={mode === item.id ? colors.white : colors.inkSoft} />}
              selected={mode === item.id}
              onPress={() => setMode(item.id)}
            />
          );
        })}
      </ScrollView>

      <View style={styles.toolbar}>
        <Txt variant="small" color={colors.inkSoft}>
          <Txt variant="small" style={{ fontWeight: '800', color: colors.ink }}>
            {results.length}
          </Txt>{' '}
          recipes
        </Txt>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Pressable onPress={() => setSortOpen(true)} style={styles.toolButton}>
            <ArrowUpDown size={14} color={colors.forest} />
            <Txt variant="tiny" color={colors.forest} style={{ fontWeight: '700' }}>
              {sort === 'recommended' ? 'Best match' : sort === 'time' ? 'Quickest' : sort === 'cost' ? 'Cheapest' : 'Protein'}
            </Txt>
          </Pressable>
          <Pressable onPress={() => setFiltersOpen(true)} style={styles.toolButton}>
            <SlidersHorizontal size={14} color={colors.forest} />
            <Txt variant="tiny" color={colors.forest} style={{ fontWeight: '700' }}>
              Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
            </Txt>
          </Pressable>
        </View>
      </View>

      <Pressable onPress={handleSurprise} style={styles.surprise}>
        <View style={styles.surpriseIcon}>
          <Sparkles size={16} color={colors.forest} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="small" style={{ fontWeight: '700' }}>
            Surprise me
          </Txt>
          <Txt variant="tiny" color={colors.inkSoft}>
            One safe, personalised pick from your filters
          </Txt>
        </View>
        <Badge label="Try it" tone="mint" />
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
      <FlatList
        data={results}
        keyExtractor={(item) => item.recipe.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item.recipe}
            reasons={item.reasons}
            isFavorite={state.favorites.includes(item.recipe.id)}
            onToggleFavorite={() => toggleFavorite(item.recipe.id)}
            onPress={() =>
              router.push({ pathname: '/recipe/[id]', params: { id: item.recipe.id } })
            }
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon={<Search size={24} color={colors.forest} />}
            title="No recipes match yet"
            message="Try clearing a filter, searching a different ingredient, or switching the meal type."
            actionLabel="Clear filters"
            onAction={() => {
              setQuery('');
              setMealType('all');
              setMode('foryou');
              setCuisine('All');
              setMaxTime(null);
              setDifficulty('All');
              setMaxCost(null);
            }}
          />
        }
      />

      <Sheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filter recipes">
        <Txt variant="label" color={colors.inkSoft} style={{ marginBottom: spacing.sm }}>
          Cuisine
        </Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: spacing.lg }}>
          <Chip label="All" selected={cuisine === 'All'} onPress={() => setCuisine('All')} />
          {cuisines.map((item) => (
            <Chip key={item} label={item} selected={cuisine === item} onPress={() => setCuisine(item)} />
          ))}
        </ScrollView>

        <Txt variant="label" color={colors.inkSoft} style={{ marginBottom: spacing.sm }}>
          Maximum cooking time
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg }}>
          {[20, 30, 45, 60, 90, 180].map((minutes) => (
            <Chip
              key={minutes}
              label={minutes === 180 ? 'Any time' : `≤ ${minutes} min`}
              selected={(maxTime ?? 180) === minutes}
              onPress={() => setMaxTime(minutes === 180 ? null : minutes)}
            />
          ))}
        </View>

        <Txt variant="label" color={colors.inkSoft} style={{ marginBottom: spacing.sm }}>
          Difficulty
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg }}>
          {['All', 'easy', 'medium', 'hard'].map((item) => (
            <Chip
              key={item}
              label={item === 'All' ? 'Any level' : difficultyLabels[item]}
              selected={difficulty === item}
              onPress={() => setDifficulty(item)}
            />
          ))}
        </View>

        <Txt variant="label" color={colors.inkSoft} style={{ marginBottom: spacing.sm }}>
          Maximum cost per serving
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg }}>
          {[30, 45, 60, 90, 150].map((cost) => (
            <Chip
              key={cost}
              label={`≤ ₹${cost}`}
              selected={maxCost === cost}
              onPress={() => setMaxCost(maxCost === cost ? null : cost)}
            />
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button
            label="Reset"
            variant="outline"
            onPress={() => {
              setCuisine('All');
              setMaxTime(null);
              setDifficulty('All');
              setMaxCost(null);
            }}
            style={{ flex: 1 }}
          />
          <Button
            label="Show recipes"
            onPress={() => setFiltersOpen(false)}
            icon={<Check size={16} color={colors.white} />}
            style={{ flex: 2 }}
          />
        </View>
      </Sheet>

      <Sheet visible={sortOpen} onClose={() => setSortOpen(false)} title="Sort recipes">
        {(
          [
            ['recommended', 'Best match', 'Our personalisation score'],
            ['time', 'Quickest first', 'Total prep and cook time'],
            ['cost', 'Cheapest first', 'Estimated cost per serving'],
            ['protein', 'Highest protein', 'Protein per serving'],
          ] as [Sort, string, string][]
        ).map(([id, title, description]) => (
          <Pressable
            key={id}
            onPress={() => {
              setSort(id);
              setSortOpen(false);
            }}
            style={styles.sortRow}
          >
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">{title}</Txt>
              <Txt variant="tiny" color={colors.inkSoft}>
                {description}
              </Txt>
            </View>
            {sort === id ? <Check size={18} color={colors.forest} /> : null}
          </Pressable>
        ))}
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.mint,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    height: 36,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    height: 30,
  },
  surprise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.creamDeep,
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  surpriseIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
    gap: spacing.md,
  },
});
