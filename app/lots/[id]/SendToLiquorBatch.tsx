"use client";

import { useState } from "react";
import { createLiquorBatchAction } from "@/app/actions/liquorBatches";
import { MartiniIcon } from "@/components/ui/icons";

type RecipeOption = {
  id: string;
  name: string;
  version: number;
  productId: string;
  productName: string;
  productIcon: string | null;
  hasInventoryLink: boolean;
};

/**
 * Convierte un lote de agave terminado en una elaboración de licor,
 * arrastrando el lote de origen para no perder la trazabilidad:
 * de la botella se puede regresar hasta el lote que la produjo.
 */
export default function SendToLiquorBatch({
  lotId,
  lotCode,
  totalLiters,
  recipes,
  alreadySent,
}: {
  lotId: string;
  lotCode: string;
  totalLiters: number;
  recipes: RecipeOption[];
  alreadySent: { id: string; code: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [recipeId, setRecipeId] = useState(recipes[0]?.id ?? "");
  const [liters, setLiters] = useState(String(totalLiters));
  const [saving, setSaving] = useState(false);

  const selected = recipes.find((r) => r.id === recipeId);

  if (recipes.length === 0) {
    return (
      <div className="rounded-2xl border border-secondary/30 bg-secondary/10 p-6">
        <h3 className="font-bold text-secondary">
          No hay recetas activas para elaborar
        </h3>

        <p className="mt-2 text-sm text-on-surface-variant">
          Para enviar los {totalLiters.toLocaleString("es-MX")} L de este lote a
          elaboración, primero crea un producto de licor con su receta en
          Elaboración de Licores.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-xl font-bold text-on-surface">
            <MartiniIcon className="h-5 w-5 text-on-surface-variant" />
            Enviar a elaboración de licor
          </h3>

          <p className="mt-2 max-w-xl text-sm text-on-surface-variant">
            Convierte los {totalLiters.toLocaleString("es-MX")} L obtenidos en
            una orden de elaboración. El lote {lotCode} queda registrado como
            origen, para poder rastrear cada botella hasta aquí.
          </p>
        </div>

        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="rounded-xl bg-primary px-5 py-3 font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
          >
            Enviar a elaboración
          </button>
        )}
      </div>

      {alreadySent.length > 0 && (
        <div className="mt-4 rounded-xl border border-outline-variant bg-background/40 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-outline">
            Elaboraciones ya creadas desde este lote
          </p>

          <ul className="mt-2 space-y-1">
            {alreadySent.map((batch) => (
              <li key={batch.id} className="text-sm text-on-surface-variant">
                {batch.code}
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && (
        <form
          action={async (formData) => {
            setSaving(true);
            await createLiquorBatchAction(formData);
          }}
          className="mt-6 space-y-5 border-t border-outline-variant pt-6"
        >
          <input type="hidden" name="lotId" value={lotId} />
          <input type="hidden" name="productId" value={selected?.productId ?? ""} />

          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-on-surface-variant">
                Producto y receta
              </span>

              <select
                name="recipeId"
                value={recipeId}
                onChange={(e) => setRecipeId(e.target.value)}
                required
                className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
              >
                {recipes.map((recipe) => (
                  <option key={recipe.id} value={recipe.id}>
                    {recipe.productIcon ?? "🍾"} {recipe.productName} —{" "}
                    {recipe.name} v{recipe.version}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-on-surface-variant">
                Litros a elaborar
                <span className="ml-1 text-error" aria-hidden="true">
                  *
                </span>
              </span>

              <input
                name="requestedLiters"
                type="number"
                step="0.01"
                min="0.01"
                value={liters}
                onChange={(e) => setLiters(e.target.value)}
                required
                className="peer w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary user-invalid:border-error"
              />

              <span className="mt-1 hidden text-xs font-semibold text-error peer-user-invalid:block">
                Indica cuántos litros se van a elaborar.
              </span>
            </label>
          </div>

          {selected && !selected.hasInventoryLink && (
            <div className="rounded-xl border border-secondary/30 bg-secondary/10 p-4 text-sm text-secondary">
              <strong>{selected.productName}</strong> no tiene un producto de
              inventario vinculado. La elaboración se va a crear, pero al
              embotellar <strong>no se abonará nada al inventario de Veliz</strong>.
              Vincúlalo primero si esperas ver el stock.
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-primary px-6 py-3 font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100"
            >
              {saving ? "Creando elaboración..." : "Crear elaboración"}
            </button>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-outline-variant px-6 py-3 font-bold text-on-surface-variant transition hover:text-on-surface"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
