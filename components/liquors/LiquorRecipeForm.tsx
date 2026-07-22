"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createLiquorRecipeAction,
  type CreateLiquorRecipeState,
} from "@/app/actions/liquorRecipes";

type ProductOption = {
  id: string;
  name: string;
  icon: string | null;
};

type Props = {
  products: ProductOption[];
};

const initialState: CreateLiquorRecipeState = {
  error: null,
};

export default function LiquorRecipeForm({
  products,
}: Props) {
  const [state, formAction] = useActionState(
    createLiquorRecipeAction,
    initialState
  );

  return (
    <form
      action={formAction}
      className="space-y-8 rounded-3xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8"
    >
      {state.error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
          {state.error}
        </div>
      )}

      <section>
        <p className="text-sm font-black uppercase tracking-[0.2em] text-purple-300">
          Información general
        </p>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field label="Producto">
            <select
              name="productId"
              required
              defaultValue=""
              className={inputClassName}
            >
              <option value="" disabled>
                Selecciona un producto
              </option>

              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.icon ?? "🍹"} {product.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Nombre de la receta">
            <input
              name="name"
              required
              placeholder="Ej. Mojito Premium"
              className={inputClassName}
            />
          </Field>

          <Field label="Versión">
            <input
              name="version"
              type="number"
              min="1"
              step="1"
              required
              defaultValue="1"
              className={inputClassName}
            />
          </Field>

          <Field label="Volumen base">
            <div className="flex items-center gap-3">
              <input
                name="targetLiters"
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="20"
                className={inputClassName}
              />

              <span className="shrink-0 font-bold text-slate-400">
                L
              </span>
            </div>
          </Field>

          <Field label="Alcohol objetivo">
            <div className="flex items-center gap-3">
              <input
                name="targetAlcohol"
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="16"
                className={inputClassName}
              />

              <span className="shrink-0 font-bold text-slate-400">
                % Alc.
              </span>
            </div>
          </Field>
        </div>
      </section>

      <section className="border-t border-slate-800 pt-8">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-purple-300">
          Información adicional
        </p>

        <div className="mt-5 space-y-5">
          <Field label="Instrucciones generales">
            <textarea
              name="instructions"
              rows={4}
              placeholder="Descripción general del proceso de elaboración..."
              className={inputClassName}
            />
          </Field>

          <Field label="Notas internas">
            <textarea
              name="notes"
              rows={3}
              placeholder="Observaciones sobre la fórmula o esta versión..."
              className={inputClassName}
            />
          </Field>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-3 border-t border-slate-800 pt-6 sm:flex-row sm:justify-end">
        <Link
          href="/liquors/recipes"
          className="rounded-2xl border border-slate-700 px-6 py-3 text-center font-bold text-slate-300 transition hover:bg-slate-800"
        >
          Cancelar
        </Link>

        <SubmitButton />
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-300">
        {label}
      </span>

      <div className="mt-2">{children}</div>
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-2xl bg-purple-600 px-7 py-3 font-black text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
    >
      {pending
        ? "Guardando receta..."
        : "Guardar y agregar ingredientes →"}
    </button>
  );
}

const inputClassName =
  "w-full rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-purple-400";