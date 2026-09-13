export type RecipeIngredientInput = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  notes?: string | null;
  optional?: boolean;
};

export type RecipeInput = {
  targetLiters: number;
  targetAlcohol?: number | null;
  ingredients: RecipeIngredientInput[];
};

export type ScaledRecipeIngredient = RecipeIngredientInput & {
  scaledQuantity: number;
};

export type ScaledRecipe = {
  requestedLiters: number;
  baseLiters: number;
  factor: number;
  targetAlcohol: number | null;
  ingredients: ScaledRecipeIngredient[];
};

export function scaleRecipe(
  recipe: RecipeInput,
  requestedLiters: number
): ScaledRecipe {
  if (!Number.isFinite(requestedLiters) || requestedLiters <= 0) {
    throw new Error("La cantidad solicitada debe ser mayor que cero.");
  }

  if (!Number.isFinite(recipe.targetLiters) || recipe.targetLiters <= 0) {
    throw new Error("La receta base no tiene un volumen válido.");
  }

  const factor = requestedLiters / recipe.targetLiters;

  return {
    requestedLiters,
    baseLiters: recipe.targetLiters,
    factor,
    targetAlcohol: recipe.targetAlcohol ?? null,
    ingredients: recipe.ingredients.map((ingredient) => ({
      ...ingredient,
      scaledQuantity: roundQuantity(
        ingredient.quantity * factor,
        ingredient.unit
      ),
    })),
  };
}

function roundQuantity(value: number, unit: string) {
  const normalizedUnit = unit.trim().toLowerCase();

  if (normalizedUnit === "gotas" || normalizedUnit === "gota") {
    return Math.max(1, Math.round(value));
  }

  if (
    normalizedUnit === "g" ||
    normalizedUnit === "gramos" ||
    normalizedUnit === "ml"
  ) {
    return Math.round(value * 10) / 10;
  }

  return Math.round(value * 100) / 100;
}