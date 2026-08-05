"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { createLiquorBatchAction } from "@/app/actions/liquorBatches";
import {
  scaleRecipe,
  type RecipeIngredientInput,
} from "@/lib/liquors/RecipeEngine";

type Props = {
  productId: string;
  recipeId: string;

  productName: string;
  productIcon?: string | null;

  recipeName: string;
  recipeVersion: number;

  targetLiters: number;
  targetAlcohol?: number | null;

  ingredients: RecipeIngredientInput[];
};

export default function LiquorRecipeCalculator({
  productId,
  recipeId,
  productName,
  productIcon,
  recipeName,
  recipeVersion,
  targetLiters,
  targetAlcohol,
  ingredients,
}: Props) {
  const [liters, setLiters] = useState("");

  const requestedLiters = Number(liters);

  const scaledRecipe = useMemo(() => {
    if (!Number.isFinite(requestedLiters) || requestedLiters <= 0) {
      return null;
    }

    return scaleRecipe(
      {
        targetLiters,
        targetAlcohol,
        ingredients,
      },
      requestedLiters
    );
  }, [
    requestedLiters,
    targetLiters,
    targetAlcohol,
    ingredients,
  ]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-outline-variant bg-surface-container p-6 sm:p-8">
        <label
          htmlFor="requestedLiters"
          className="text-sm font-semibold text-on-surface-variant"
        >
          ¿Cuántos litros deseas elaborar?
        </label>

        <input
          id="requestedLiters"
          type="number"
          min="0.1"
          step="0.1"
          value={liters}
          onChange={(event) => setLiters(event.target.value)}
          placeholder="100"
          className="mt-4 w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
        />

        <p className="mt-3 text-sm text-outline">
          La receta se actualizará automáticamente mientras escribes.
        </p>
      </section>

      {scaledRecipe && (
        <section className="rounded-3xl border border-primary/25 bg-surface-container p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-mono text-sm font-semibold uppercase tracking-[0.3em] text-outline">
                Orden de producción
              </p>

              <h2 className="mt-3 text-3xl font-black text-on-surface">
                {productIcon ?? "🍹"} {productName}
              </h2>

              <p className="mt-2 text-on-surface-variant">
                {recipeName} · Versión {recipeVersion}
              </p>
            </div>

            <div className="rounded-2xl border border-primary/20 bg-primary/[0.06] px-5 py-4">
              <p className="text-xs uppercase tracking-wider text-on-surface-variant">
                Volumen objetivo
              </p>

              <p className="mt-1 text-3xl font-black text-primary">
                {formatNumber(scaledRecipe.requestedLiters)} L
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <SummaryCard
              title="Receta base"
              value={`${formatNumber(scaledRecipe.baseLiters)} L`}
            />

            <SummaryCard
              title="Factor aplicado"
              value={scaledRecipe.factor.toFixed(4)}
            />

            <SummaryCard
              title="Alcohol objetivo"
              value={
                scaledRecipe.targetAlcohol !== null
                  ? `${formatNumber(scaledRecipe.targetAlcohol)}%`
                  : "No definido"
              }
            />
          </div>

          <div className="mt-8">
            <h3 className="text-xl font-bold text-on-surface">
              Ingredientes calculados
            </h3>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {scaledRecipe.ingredients.map((ingredient) => (
                <div
                  key={ingredient.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-outline-variant bg-background/50 p-4"
                >
                  <div>
                    <p className="font-semibold text-on-surface">
                      {ingredient.name}
                    </p>

                    {ingredient.optional && (
                      <p className="mt-1 text-xs font-semibold text-on-surface-variant">
                        Ingrediente opcional
                      </p>
                    )}

                    {ingredient.notes && (
                      <p className="mt-1 text-xs text-outline">
                        {ingredient.notes}
                      </p>
                    )}
                  </div>

                  <p className="shrink-0 text-lg font-black text-primary">
                    {formatNumber(ingredient.scaledQuantity)}{" "}
                    {ingredient.unit}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <form action={createLiquorBatchAction} className="mt-8">
            <input
              type="hidden"
              name="productId"
              value={productId}
            />

            <input
              type="hidden"
              name="recipeId"
              value={recipeId}
            />

            <input
              type="hidden"
              name="requestedLiters"
              value={scaledRecipe.requestedLiters}
            />

            <SubmitButton />
          </form>
        </section>
      )}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl bg-primary py-4 text-lg font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.02] hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
    >
      {pending
        ? "Creando lote y preparando elaboración..."
        : "Crear lote e iniciar elaboración"}
    </button>
  );
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-background/50 p-4">
      <p className="text-sm text-outline">{title}</p>
      <p className="mt-2 text-xl font-black text-on-surface">{value}</p>
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 2,
  }).format(value);
}