"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { completeLiquorIngredientAction } from "@/app/actions/liquorBatchAssistant";

type Ingredient = {
  id: string;
  name: string;
  scaledQuantity: number;
  actualQuantity: number | null;
  unit: string;
  completed: boolean;
  notes: string | null;
};

type Props = {
  batchId: string;
  ingredients: Ingredient[];
};

export default function LiquorBatchAssistant({
  batchId,
  ingredients,
}: Props) {
  const completedCount = ingredients.filter(
    (ingredient) => ingredient.completed
  ).length;

  const totalCount = ingredients.length;

  const currentIngredient = ingredients.find(
    (ingredient) => !ingredient.completed
  );

  const progress =
    totalCount > 0
      ? Math.round((completedCount / totalCount) * 100)
      : 0;

  if (!currentIngredient) {
    return (
      <section className="rounded-3xl border border-green-500/30 bg-green-500/10 p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
          Ingredientes completados
        </p>

        <h2 className="mt-3 text-3xl font-black text-white">
          Todo listo para continuar
        </h2>

        <p className="mt-3 text-slate-300">
          Ya se agregaron todos los ingredientes de la orden.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-purple-500/30 bg-slate-900 p-6 sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-purple-400">
            Asistente de elaboración
          </p>

          <h2 className="mt-2 text-2xl font-black text-white">
            Paso {completedCount + 1} de {totalCount}
          </h2>
        </div>

        <p className="text-2xl font-black text-purple-300">
          {progress}%
        </p>
      </div>

      <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-purple-500 transition-all"
          style={{
            width: `${progress}%`,
          }}
        />
      </div>

      <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-950/60 p-6 sm:p-8">
        <p className="text-sm uppercase tracking-wider text-slate-500">
          Agrega
        </p>

        <h3 className="mt-3 text-3xl font-black text-white">
          {currentIngredient.name}
        </h3>

        <p className="mt-5 text-5xl font-black text-purple-300">
          {formatNumber(currentIngredient.scaledQuantity)}{" "}
          {currentIngredient.unit}
        </p>

        {currentIngredient.notes && (
          <p className="mt-4 text-slate-400">
            {currentIngredient.notes}
          </p>
        )}

        <IngredientForm
          batchId={batchId}
          ingredient={currentIngredient}
        />
      </div>
    </section>
  );
}

function IngredientForm({
  batchId,
  ingredient,
}: {
  batchId: string;
  ingredient: Ingredient;
}) {
  const [actualQuantity, setActualQuantity] = useState(
    String(ingredient.scaledQuantity)
  );

  return (
    <form
      action={completeLiquorIngredientAction}
      className="mt-8 space-y-5"
    >
      <input
        type="hidden"
        name="batchId"
        value={batchId}
      />

      <input
        type="hidden"
        name="ingredientId"
        value={ingredient.id}
      />

      <div>
        <label
          htmlFor="actualQuantity"
          className="text-sm font-semibold text-slate-300"
        >
          Cantidad real utilizada
        </label>

        <div className="mt-2 flex items-center gap-3">
          <input
            id="actualQuantity"
            name="actualQuantity"
            type="number"
            min="0"
            step="0.01"
            value={actualQuantity}
            onChange={(event) =>
              setActualQuantity(event.target.value)
            }
            className="w-full rounded-2xl border border-slate-700 bg-slate-900 p-4 text-2xl font-bold text-white outline-none focus:border-purple-400"
          />

          <span className="shrink-0 text-lg font-bold text-slate-400">
            {ingredient.unit}
          </span>
        </div>
      </div>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl bg-purple-500 py-4 text-lg font-bold text-white transition hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Guardando..." : "✓ Marcar como agregado"}
    </button>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 2,
  }).format(value);
}