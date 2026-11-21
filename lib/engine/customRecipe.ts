import { RecipeIngredient, RecipeStep } from '@/lib/types';

/**
 * Cleans user-entered steps without losing the timer or tip that belongs to
 * each step. Empty rows are removed only after the text is trimmed, so a blank
 * middle row can never shift a timer onto the wrong instruction.
 */
export function cleanRecipeSteps(steps: RecipeStep[]): RecipeStep[] {
  return steps
    .map((step) => ({
      ...step,
      text: typeof step.text === 'string' ? step.text.trim() : '',
      tip: typeof step.tip === 'string' && step.tip.trim() ? step.tip.trim() : undefined,
      timerMinutes:
        Number.isFinite(step.timerMinutes) && (step.timerMinutes as number) > 0
          ? Math.round(step.timerMinutes as number)
          : undefined,
    }))
    .filter((step) => step.text.length > 0);
}

/** Every ingredient must have a finite quantity above zero. */
export function hasValidIngredientQuantities(ingredients: RecipeIngredient[]): boolean {
  return (
    ingredients.length > 0 &&
    ingredients.every(
      (item) => Number.isFinite(item.quantity) && item.quantity > 0 && Boolean(item.unit),
    )
  );
}

/** Prevents a zero or negative serving count from producing Infinity nutrition. */
export function safeBaseServings(value: number): number {
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.min(50, Math.round(value));
}
