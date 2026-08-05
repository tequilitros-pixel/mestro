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
      className="space-y-8 rounded-3xl border border-outline-variant bg-surface-container/70 p-6 sm:p-8"
    >
      {state.error && (
        <div className="rounded-2xl border border-error/30 bg-error/10 p-4 text-error">
          {state.error}
        </div>
      )}

      <section>
        <p className="font-mono text-sm font-black uppercase tracking-[0.2em] text-outline">
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

              <span className="shrink-0 font-bold text-on-surface-variant">
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

              <span className="shrink-0 font-bold text-on-surface-variant">
                % Alc.
              </span>
            </div>
          </Field>
        </div>
      </section>

      <section className="border-t border-outline-variant pt-8">
        <p className="font-mono text-sm font-black uppercase tracking-[0.2em] text-outline">
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

      <div className="flex flex-col-reverse gap-3 border-t border-outline-variant pt-6 sm:flex-row sm:justify-end">
        <Link
          href="/liquors/recipes"
          className="rounded-2xl border border-outline-variant px-6 py-3 text-center font-bold text-on-surface-variant transition hover:bg-surface-container-high"
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
      <span className="text-sm font-semibold text-on-surface-variant">
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
      className="rounded-2xl bg-primary px-7 py-3 font-black text-on-surface transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-surface-container-highest disabled:text-on-surface-variant"
    >
      {pending
        ? "Guardando receta..."
        : "Guardar y agregar ingredientes →"}
    </button>
  );
}

const inputClassName =
  "resize-none w-full rounded-xl border border-outline-variant bg-background/60 px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary";