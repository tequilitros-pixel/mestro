"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  deleteLiquorRecipeIngredientAction,
  initialLiquorRecipeIngredientState,
  moveLiquorRecipeIngredientDownAction,
  moveLiquorRecipeIngredientUpAction,
  saveLiquorRecipeIngredientAction,
} from "@/app/actions/liquorRecipeIngredients";

type RecipeIngredient = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  position: number;
  optional: boolean;
  notes: string | null;
  rawMaterialId: string | null;
};

type RawMaterialOption = {
  id: string;
  name: string;
  code: string;
  baseUnit: string;
  category: string | null;
};

type Props = {
  recipeId: string;
  ingredients: RecipeIngredient[];
  rawMaterials: RawMaterialOption[];
};

export default function RecipeIngredientsEditor({
  recipeId,
  ingredients,
  rawMaterials,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingIngredient, setEditingIngredient] =
    useState<RecipeIngredient | null>(null);

  function openCreateForm() {
    setEditingIngredient(null);
    setShowForm(true);
  }

  function openEditForm(ingredient: RecipeIngredient) {
    setEditingIngredient(ingredient);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingIngredient(null);
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70">
      <header className="flex flex-col gap-4 border-b border-slate-800 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-purple-300">
            Fórmula
          </p>

          <h2 className="mt-2 text-2xl font-black text-white">
            🧪 Ingredientes
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Materias primas, cantidades y orden de incorporación.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="rounded-2xl bg-purple-600 px-5 py-3 font-black text-white transition hover:bg-purple-500"
        >
          + Agregar ingrediente
        </button>
      </header>

      {ingredients.length === 0 ? (
        <EmptyIngredients onCreate={openCreateForm} />
      ) : (
        <div className="divide-y divide-slate-800">
          {ingredients.map((ingredient, index) => (
            <IngredientRow
              key={ingredient.id}
              recipeId={recipeId}
              ingredient={ingredient}
              isFirst={index === 0}
              isLast={index === ingredients.length - 1}
              onEdit={() => openEditForm(ingredient)}
            />
          ))}
        </div>
      )}

      <footer className="border-t border-slate-800 px-6 py-4 sm:px-8">
        <p className="text-sm text-slate-500">
          {ingredients.length === 1
            ? "1 ingrediente registrado"
            : `${ingredients.length} ingredientes registrados`}
        </p>
      </footer>

      {showForm && (
        <IngredientFormModal
          key={editingIngredient?.id ?? "new-ingredient"}
          recipeId={recipeId}
          ingredient={editingIngredient}
          rawMaterials={rawMaterials}
          onClose={closeForm}
        />
      )}
    </section>
  );
}

function IngredientRow({
  recipeId,
  ingredient,
  isFirst,
  isLast,
  onEdit,
}: {
  recipeId: string;
  ingredient: RecipeIngredient;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
}) {
  return (
    <article className="p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950 font-black text-slate-300">
            {ingredient.position}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black text-white">
                {ingredient.name}
              </h3>

              {ingredient.optional && (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-black text-amber-300">
                  Opcional
                </span>
              )}

              {ingredient.rawMaterialId ? (
                <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-1 text-xs font-bold text-green-300">
                  Materia prima vinculada
                </span>
              ) : (
                <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-400">
                  Ingrediente personalizado
                </span>
              )}
            </div>

            <p className="mt-2 text-xl font-black text-purple-200">
              {formatQuantity(ingredient.quantity)} {ingredient.unit}
            </p>

            {ingredient.notes && (
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                {ingredient.notes}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <MoveIngredientForm
            recipeId={recipeId}
            ingredientId={ingredient.id}
            direction="up"
            disabled={isFirst}
          />

          <MoveIngredientForm
            recipeId={recipeId}
            ingredientId={ingredient.id}
            direction="down"
            disabled={isLast}
          />

          <button
            type="button"
            onClick={onEdit}
            className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-bold text-slate-200 transition hover:border-purple-500/50 hover:bg-purple-500/10"
          >
            ✏️ Editar
          </button>

          <DeleteIngredientForm
            recipeId={recipeId}
            ingredientId={ingredient.id}
            ingredientName={ingredient.name}
          />
        </div>
      </div>
    </article>
  );
}

function MoveIngredientForm({
  recipeId,
  ingredientId,
  direction,
  disabled,
}: {
  recipeId: string;
  ingredientId: string;
  direction: "up" | "down";
  disabled: boolean;
}) {
  const action =
    direction === "up"
      ? moveLiquorRecipeIngredientUpAction
      : moveLiquorRecipeIngredientDownAction;

  return (
    <form action={action}>
      <input type="hidden" name="recipeId" value={recipeId} />
      <input
        type="hidden"
        name="ingredientId"
        value={ingredientId}
      />

      <button
        type="submit"
        disabled={disabled}
        title={
          direction === "up"
            ? "Mover ingrediente arriba"
            : "Mover ingrediente abajo"
        }
        className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-black text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-25"
      >
        {direction === "up" ? "↑" : "↓"}
      </button>
    </form>
  );
}

function DeleteIngredientForm({
  recipeId,
  ingredientId,
  ingredientName,
}: {
  recipeId: string;
  ingredientId: string;
  ingredientName: string;
}) {
  return (
    <form
      action={deleteLiquorRecipeIngredientAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `¿Eliminar "${ingredientName}" de esta receta?`
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="recipeId" value={recipeId} />
      <input
        type="hidden"
        name="ingredientId"
        value={ingredientId}
      />

      <button
        type="submit"
        className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/20"
      >
        🗑 Eliminar
      </button>
    </form>
  );
}

function IngredientFormModal({
  recipeId,
  ingredient,
  rawMaterials,
  onClose,
}: {
  recipeId: string;
  ingredient: RecipeIngredient | null;
  rawMaterials: RawMaterialOption[];
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(
    saveLiquorRecipeIngredientAction,
    initialLiquorRecipeIngredientState
  );

  const initialRawMaterial =
    rawMaterials.find(
      (rawMaterial) =>
        rawMaterial.id === ingredient?.rawMaterialId
    ) ?? null;

  const [selectedRawMaterialId, setSelectedRawMaterialId] =
    useState(ingredient?.rawMaterialId ?? "");

  const [name, setName] = useState(
    ingredient?.name ?? initialRawMaterial?.name ?? ""
  );

  const [unit, setUnit] = useState(
    ingredient?.unit ?? initialRawMaterial?.baseUnit ?? ""
  );

  useEffect(() => {
    if (state.success) {
      onClose();
    }
  }, [state.success, onClose]);

  function handleRawMaterialChange(
    event: React.ChangeEvent<HTMLSelectElement>
  ) {
    const rawMaterialId = event.target.value;

    setSelectedRawMaterialId(rawMaterialId);

    if (!rawMaterialId) {
      return;
    }

    const selectedMaterial = rawMaterials.find(
      (rawMaterial) => rawMaterial.id === rawMaterialId
    );

    if (!selectedMaterial) {
      return;
    }

    setName(selectedMaterial.name);
    setUnit(selectedMaterial.baseUnit);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="max-h-[95vh] w-full overflow-y-auto rounded-t-3xl border border-slate-700 bg-slate-900 shadow-2xl sm:max-w-2xl sm:rounded-3xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 p-6">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-purple-300">
              Constructor de recetas
            </p>

            <h2 className="mt-2 text-2xl font-black text-white">
              {ingredient
                ? "Editar ingrediente"
                : "Nuevo ingrediente"}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 text-xl text-slate-300 transition hover:bg-slate-800"
            aria-label="Cerrar formulario"
          >
            ×
          </button>
        </header>

        <form action={formAction} className="space-y-6 p-6">
          <input type="hidden" name="recipeId" value={recipeId} />

          {ingredient && (
            <input
              type="hidden"
              name="ingredientId"
              value={ingredient.id}
            />
          )}

          {state.error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">
              {state.error}
            </div>
          )}

          <Field
            label="Materia prima"
            description="Puedes vincular el ingrediente con el catálogo o capturarlo manualmente."
          >
            <select
              name="rawMaterialId"
              value={selectedRawMaterialId}
              onChange={handleRawMaterialChange}
              className={inputClassName}
            >
              <option value="">
                Ingrediente personalizado
              </option>

              {rawMaterials.map((rawMaterial) => (
                <option
                  key={rawMaterial.id}
                  value={rawMaterial.id}
                >
                  {rawMaterial.name} · {rawMaterial.code}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Nombre del ingrediente">
            <input
              name="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Agua purificada"
              className={inputClassName}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Cantidad">
              <input
                name="quantity"
                type="number"
                min="0.0001"
                step="any"
                required
                defaultValue={ingredient?.quantity ?? ""}
                placeholder="Ej. 7"
                className={inputClassName}
              />
            </Field>

            <Field label="Unidad">
              <input
                name="unit"
                required
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                placeholder="L, kg, g, ml..."
                className={inputClassName}
              />
            </Field>
          </div>

          <Field label="Notas">
            <textarea
              name="notes"
              rows={3}
              defaultValue={ingredient?.notes ?? ""}
              placeholder="Marca, concentración, preparación o alguna indicación especial..."
              className={inputClassName}
            />
          </Field>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-700 bg-slate-950/50 p-4">
            <input
              name="optional"
              type="checkbox"
              defaultChecked={ingredient?.optional ?? false}
              className="mt-1 h-5 w-5 accent-purple-600"
            />

            <span>
              <span className="block font-black text-white">
                Ingrediente opcional
              </span>

              <span className="mt-1 block text-sm text-slate-400">
                Márcalo cuando la receta pueda ejecutarse sin este
                ingrediente.
              </span>
            </span>
          </label>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-800 pt-6 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-700 px-6 py-3 font-bold text-slate-300 transition hover:bg-slate-800"
            >
              Cancelar
            </button>

            <SaveIngredientButton isEditing={Boolean(ingredient)} />
          </div>
        </form>
      </div>
    </div>
  );
}

function SaveIngredientButton({
  isEditing,
}: {
  isEditing: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-2xl bg-purple-600 px-7 py-3 font-black text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
    >
      {pending
        ? "Guardando..."
        : isEditing
          ? "Guardar cambios"
          : "Agregar ingrediente"}
    </button>
  );
}

function EmptyIngredients({
  onCreate,
}: {
  onCreate: () => void;
}) {
  return (
    <div className="px-6 py-12 text-center sm:px-8">
      <div className="text-5xl">🧪</div>

      <h3 className="mt-5 text-xl font-black text-white">
        La receta todavía no tiene ingredientes
      </h3>

      <p className="mx-auto mt-3 max-w-lg text-slate-400">
        Agrega las materias primas oficiales y sus cantidades para
        construir la fórmula base.
      </p>

      <button
        type="button"
        onClick={onCreate}
        className="mt-6 rounded-2xl border border-purple-500/30 bg-purple-500/10 px-5 py-3 font-black text-purple-200 transition hover:bg-purple-500/20"
      >
        + Registrar primer ingrediente
      </button>
    </div>
  );
}

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-200">
        {label}
      </span>

      {description && (
        <span className="mt-1 block text-xs text-slate-500">
          {description}
        </span>
      )}

      <div className="mt-2">{children}</div>
    </label>
  );
}

function formatQuantity(quantity: number) {
  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 4,
  }).format(quantity);
}

const inputClassName =
  "w-full rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-purple-400";