"use client";

import {
  deleteLiquorRecipeStepAction,
  initialLiquorRecipeStepState,
  moveLiquorRecipeStepDownAction,
  moveLiquorRecipeStepUpAction,
  saveLiquorRecipeStepAction,
  toggleLiquorRecipeStepAction,
} from "@/app/actions/liquorRecipeSteps";
import { useActionState, useEffect, useMemo, useState } from "react";

type StepType =
  | "PREPARATION"
  | "INGREDIENT"
  | "MIXING"
  | "WAIT"
  | "MEASUREMENT"
  | "QUALITY_CHECK"
  | "FINISH";

type RecipeIngredient = {
  id: string;
  name: string;
  quantity: number | string;
  unit: string;
  position: number;
  rawMaterial?: {
    id: string;
    name: string;
    unit?: string | null;
  } | null;
};

type RecipeStep = {
  id: string;
  position: number;
  type: StepType;
  title: string;
  instruction: string | null;
  actions: string[];
  checks: string[];
  recipeIngredientId: string | null;
  durationMinutes: number | null;
  measurementLabel: string | null;
  measurementUnit: string | null;
  minimumValue: number | string | null;
  maximumValue: number | string | null;
  required: boolean;
  active: boolean;
  recipeIngredient?: RecipeIngredient | null;
};

type Props = {
  recipeId: string;
  steps: RecipeStep[];
  ingredients: RecipeIngredient[];
};

type StepFormValues = {
  stepId: string;
  type: StepType;
  title: string;
  instruction: string;
  recipeIngredientId: string;
  durationMinutes: string;
  measurementLabel: string;
  measurementUnit: string;
  minimumValue: string;
  maximumValue: string;
  actions: string;
  checks: string;
  required: boolean;
  active: boolean;
};

const STEP_OPTIONS: Array<{
  type: StepType;
  icon: string;
  label: string;
  description: string;
}> = [
  {
    type: "PREPARATION",
    icon: "🛠️",
    label: "Preparación",
    description:
      "Prepara recipientes, equipo, área de trabajo o actividades previas.",
  },
  {
    type: "INGREDIENT",
    icon: "🧂",
    label: "Agregar ingrediente",
    description:
      "Relaciona el paso con un ingrediente de la receta.",
  },
  {
    type: "MIXING",
    icon: "🌀",
    label: "Mezclar",
    description:
      "Indica el tiempo y las instrucciones del mezclado.",
  },
  {
    type: "WAIT",
    icon: "⏱️",
    label: "Esperar",
    description:
      "Crea una espera o reposo controlado por tiempo.",
  },
  {
    type: "MEASUREMENT",
    icon: "🧪",
    label: "Medición",
    description:
      "Registra alcohol, pH, Brix, temperatura u otro valor.",
  },
  {
    type: "QUALITY_CHECK",
    icon: "✅",
    label: "Control de calidad",
    description:
      "Agrega verificaciones obligatorias antes de continuar.",
  },
  {
    type: "FINISH",
    icon: "🏁",
    label: "Finalizar proceso",
    description:
      "Marca la liberación y cierre del procedimiento.",
  },
];
const EMPTY_FORM: StepFormValues = {
  stepId: "",
  type: "INGREDIENT",
  title: "",
  instruction: "",
  recipeIngredientId: "",
  durationMinutes: "",
  measurementLabel: "",
  measurementUnit: "",
  minimumValue: "",
  maximumValue: "",
  actions: "",
  checks: "",
  required: true,
  active: true,
};

export default function RecipeStepsEditor({
  recipeId,
  steps,
  ingredients,
}: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formValues, setFormValues] =
    useState<StepFormValues>(EMPTY_FORM);

  const [state, formAction, isPending] = useActionState(
    saveLiquorRecipeStepAction,
    initialLiquorRecipeStepState
  );

  const sortedSteps = useMemo(
    () => [...steps].sort((a, b) => a.position - b.position),
    [steps]
  );

  useEffect(() => {
  if (!state.success) return;

  const timeoutId = window.setTimeout(() => {
    setIsModalOpen(false);
    setFormValues(EMPTY_FORM);
  }, 0);

  return () => {
    window.clearTimeout(timeoutId);
  };
}, [state]);

  function openCreateModal(type: StepType = "INGREDIENT") {
    setFormValues({
      ...EMPTY_FORM,
      type,
      title: getDefaultTitle(type),
    });

    setIsModalOpen(true);
  }

  function openEditModal(step: RecipeStep) {
    setFormValues({
      stepId: step.id,
      type: step.type,
      title: step.title,
      instruction: step.instruction ?? "",
      recipeIngredientId: step.recipeIngredientId ?? "",
      durationMinutes:
        step.durationMinutes === null
          ? ""
          : String(step.durationMinutes),
      measurementLabel: step.measurementLabel ?? "",
      measurementUnit: step.measurementUnit ?? "",
      minimumValue:
        step.minimumValue === null
          ? ""
          : String(step.minimumValue),
      maximumValue:
        step.maximumValue === null
          ? ""
          : String(step.maximumValue),
      actions: step.actions.join("\n"),
      checks: step.checks.join("\n"),
      required: step.required,
      active: step.active,
    });

    setIsModalOpen(true);
  }

  function closeModal() {
    if (isPending) return;

    setIsModalOpen(false);
    setFormValues(EMPTY_FORM);
  }

  function updateField<K extends keyof StepFormValues>(
    field: K,
    value: StepFormValues[K]
  ) {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function changeStepType(type: StepType) {
    setFormValues((current) => ({
      ...current,
      type,
      title:
        !current.stepId || current.title === getDefaultTitle(current.type)
          ? getDefaultTitle(type)
          : current.title,
      recipeIngredientId:
        type === "INGREDIENT" ? current.recipeIngredientId : "",
      measurementLabel:
        type === "MEASUREMENT" ? current.measurementLabel : "",
      measurementUnit:
        type === "MEASUREMENT" ? current.measurementUnit : "",
      minimumValue:
        type === "MEASUREMENT" ? current.minimumValue : "",
      maximumValue:
        type === "MEASUREMENT" ? current.maximumValue : "",
    }));
  }

  return (
    <>
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 to-slate-800 px-5 py-5 text-white sm:px-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">
                Procedimiento
              </p>

              <h2 className="mt-1 text-2xl font-bold">
                📋 Proceso Maestro
              </h2>

              <p className="mt-1 max-w-2xl text-sm text-slate-300">
                Construye el procedimiento que seguirá el operador
                durante la elaboración del licor.
              </p>
            </div>

            <button
              type="button"
              onClick={() => openCreateModal()}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-slate-100"
            >
              + Agregar paso
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-7">
          {sortedSteps.length === 0 ? (
            <EmptyState onAddStep={openCreateModal} />
          ) : (
            <div className="space-y-4">
              {sortedSteps.map((step, index) => (
                <StepCard
                  key={step.id}
                  recipeId={recipeId}
                  step={step}
                  index={index}
                  totalSteps={sortedSteps.length}
                  onEdit={() => openEditModal(step)}
                />
              ))}
            </div>
          )}

          {sortedSteps.length > 0 && (
            <button
              type="button"
              onClick={() => openCreateModal()}
              className="mt-6 flex min-h-14 w-full items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-4 text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
            >
              + Agregar otro paso
            </button>
          )}
        </div>
      </section>

      {isModalOpen && (
        <StepModal
          recipeId={recipeId}
          ingredients={ingredients}
          formValues={formValues}
          state={state}
          isPending={isPending}
          formAction={formAction}
          onClose={closeModal}
          onChange={updateField}
          onTypeChange={changeStepType}
        />
      )}
    </>
  );
}

function EmptyState({
  onAddStep,
}: {
  onAddStep: (type?: StepType) => void;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 sm:p-8">
      <div className="mx-auto max-w-2xl text-center">
        <div className="text-5xl">🏭</div>

        <h3 className="mt-4 text-xl font-bold text-slate-950">
          Construye el proceso de esta receta
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Selecciona el primer tipo de paso. Después podrás cambiar
          el orden, editarlo o desactivarlo.
        </p>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STEP_OPTIONS.map((option) => (
          <button
            key={option.type}
            type="button"
            onClick={() => onAddStep(option.type)}
            className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md"
          >
            <span className="text-2xl">{option.icon}</span>

            <span className="mt-3 block font-bold text-slate-950">
              {option.label}
            </span>

            <span className="mt-1 block text-xs leading-5 text-slate-500">
              {option.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepCard({
  recipeId,
  step,
  index,
  totalSteps,
  onEdit,
}: {
  recipeId: string;
  step: RecipeStep;
  index: number;
  totalSteps: number;
  onEdit: () => void;
}) {
  const metadata = getStepMetadata(step.type);
  const ingredient = step.recipeIngredient;

  return (
    <article
      className={`overflow-hidden rounded-2xl border shadow-sm transition ${
        step.active
          ? `${metadata.borderClass} bg-white`
          : "border-slate-200 bg-slate-50 opacity-70"
      }`}
    >
      <div
        className={`h-1.5 w-full ${
          step.active ? metadata.barClass : "bg-slate-300"
        }`}
      />

      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-black ${
              step.active
                ? metadata.badgeClass
                : "bg-slate-200 text-slate-600"
            }`}
          >
            {index + 1}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg">{metadata.icon}</span>

                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${
                      step.active
                        ? metadata.labelClass
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {metadata.label}
                  </span>

                  {step.required && (
                    <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white">
                      Obligatorio
                    </span>
                  )}

                  {!step.active && (
                    <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                      Inactivo
                    </span>
                  )}
                </div>

                <h3 className="mt-3 text-lg font-bold text-slate-950">
                  {step.title}
                </h3>

                {step.instruction && (
                  <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-600">
                    {step.instruction}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <form action={moveLiquorRecipeStepUpAction}>
                  <input
                    type="hidden"
                    name="recipeId"
                    value={recipeId}
                  />
                  <input type="hidden" name="stepId" value={step.id} />

                  <button
                    type="submit"
                    disabled={index === 0}
                    title="Mover hacia arriba"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ↑
                  </button>
                </form>

                <form action={moveLiquorRecipeStepDownAction}>
                  <input
                    type="hidden"
                    name="recipeId"
                    value={recipeId}
                  />
                  <input type="hidden" name="stepId" value={step.id} />

                  <button
                    type="submit"
                    disabled={index === totalSteps - 1}
                    title="Mover hacia abajo"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ↓
                  </button>
                </form>

                <button
                  type="button"
                  onClick={onEdit}
                  className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                >
                  Editar
                </button>
              </div>
            </div>

            <StepDetails step={step} ingredient={ingredient} />

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <form action={toggleLiquorRecipeStepAction}>
                <input
                  type="hidden"
                  name="recipeId"
                  value={recipeId}
                />
                <input type="hidden" name="stepId" value={step.id} />

                <button
                  type="submit"
                  className="text-sm font-bold text-slate-600 transition hover:text-slate-950"
                >
                  {step.active ? "Desactivar paso" : "Activar paso"}
                </button>
              </form>

              <form
                action={deleteLiquorRecipeStepAction}
                onSubmit={(event) => {
                  const confirmed = window.confirm(
                    `¿Eliminar el paso “${step.title}”?`
                  );

                  if (!confirmed) {
                    event.preventDefault();
                  }
                }}
              >
                <input
                  type="hidden"
                  name="recipeId"
                  value={recipeId}
                />
                <input type="hidden" name="stepId" value={step.id} />

                <button
                  type="submit"
                  className="text-sm font-bold text-red-600 transition hover:text-red-800"
                >
                  Eliminar
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function StepDetails({
  step,
  ingredient,
}: {
  step: RecipeStep;
  ingredient?: RecipeIngredient | null;
}) {
  const details: Array<{
    label: string;
    value: string;
  }> = [];

  if (step.type === "INGREDIENT" && ingredient) {
    details.push({
      label: "Ingrediente",
      value:
        ingredient.rawMaterial?.name ??
        ingredient.name ??
        "Ingrediente",
    });

    details.push({
      label: "Cantidad base",
      value: `${formatNumber(ingredient.quantity)} ${ingredient.unit}`,
    });
  }

  if (step.durationMinutes !== null) {
    details.push({
      label: "Duración",
      value: formatDuration(step.durationMinutes),
    });
  }

  if (step.type === "MEASUREMENT" && step.measurementLabel) {
    details.push({
      label: "Medición",
      value: step.measurementLabel,
    });

    const range = formatMeasurementRange(step);

    if (range) {
      details.push({
        label: "Objetivo",
        value: range,
      });
    }
  }

  return (
    <>
      {details.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {details.map((detail) => (
            <div
              key={`${detail.label}-${detail.value}`}
              className="rounded-xl bg-slate-50 px-4 py-3"
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {detail.label}
              </p>

              <p className="mt-1 text-sm font-bold text-slate-900">
                {detail.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {step.actions.length > 0 && (
        <DetailList
          title="Acciones"
          items={step.actions}
          icon="•"
        />
      )}

      {step.checks.length > 0 && (
        <DetailList
          title="Verificaciones"
          items={step.checks}
          icon="✓"
        />
      )}
    </>
  );
}

function DetailList({
  title,
  items,
  icon,
}: {
  title: string;
  items: string[];
  icon: string;
}) {
  return (
    <div className="mt-4 rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-black uppercase tracking-wider text-slate-500">
        {title}
      </p>

      <div className="mt-3 space-y-2">
        {items.map((item, index) => (
          <div
            key={`${item}-${index}`}
            className="flex items-start gap-2 text-sm text-slate-700"
          >
            <span className="font-black text-slate-950">{icon}</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepModal({
  recipeId,
  ingredients,
  formValues,
  state,
  isPending,
  formAction,
  onClose,
  onChange,
  onTypeChange,
}: {
  recipeId: string;
  ingredients: RecipeIngredient[];
  formValues: StepFormValues;
  state: {
    success: boolean;
    error: string | null;
  };
  isPending: boolean;
  formAction: (payload: FormData) => void;
  onClose: () => void;
  onChange: <K extends keyof StepFormValues>(
    field: K,
    value: StepFormValues[K]
  ) => void;
  onTypeChange: (type: StepType) => void;
}) {
  const selectedMetadata = getStepMetadata(formValues.type);
  const isEditing = Boolean(formValues.stepId);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <div className="max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-5 backdrop-blur sm:px-7">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                Proceso Maestro
              </p>

              <h2 className="mt-1 text-2xl font-black text-slate-950">
                {isEditing ? "Editar paso" : "Agregar paso"}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-xl font-bold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
            >
              ×
            </button>
          </div>
        </div>

        <form action={formAction} className="p-5 sm:p-7">
          <input type="hidden" name="recipeId" value={recipeId} />
          <input
            type="hidden"
            name="stepId"
            value={formValues.stepId}
          />

          <input
            type="hidden"
            name="type"
            value={formValues.type}
          />

          <div>
            <p className="text-sm font-black text-slate-950">
              Tipo de paso
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {STEP_OPTIONS.map((option) => {
                const selected = option.type === formValues.type;

                return (
                  <button
                    key={option.type}
                    type="button"
                    onClick={() => onTypeChange(option.type)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      selected
                        ? `${getStepMetadata(option.type).borderClass} ${
                            getStepMetadata(option.type).softClass
                          } ring-2 ring-slate-950/10`
                        : "border-slate-200 bg-white hover:border-slate-400"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{option.icon}</span>

                      <span className="font-black text-slate-950">
                        {option.label}
                      </span>
                    </div>

                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className={`mt-6 rounded-2xl border p-4 ${selectedMetadata.borderClass} ${selectedMetadata.softClass}`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {selectedMetadata.icon}
              </span>

              <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Paso seleccionado
                </p>

                <p className="font-black text-slate-950">
                  {selectedMetadata.label}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-7 grid gap-5">
            <Field label="Nombre del paso" required>
              <input
                name="title"
                value={formValues.title}
                onChange={(event) =>
                  onChange("title", event.target.value)
                }
                required
                placeholder="Ej. Agregar azúcar"
                className={inputClassName}
              />
            </Field>

            <Field label="Instrucción para el operador">
              <textarea
                name="instruction"
                value={formValues.instruction}
                onChange={(event) =>
                  onChange("instruction", event.target.value)
                }
                rows={3}
                placeholder="Describe claramente qué debe hacer el operador."
                className={inputClassName}
              />
            </Field>

            {formValues.type === "INGREDIENT" && (
              <Field label="Ingrediente relacionado" required>
                <select
                  name="recipeIngredientId"
                  value={formValues.recipeIngredientId}
                  onChange={(event) =>
                    onChange(
                      "recipeIngredientId",
                      event.target.value
                    )
                  }
                  required
                  className={inputClassName}
                >
                  <option value="">
                    Selecciona un ingrediente
                  </option>

                  {ingredients.map((ingredient) => (
                    <option
                      key={ingredient.id}
                      value={ingredient.id}
                    >
                      {ingredient.rawMaterial?.name ??
                        ingredient.name}{" "}
                      — {formatNumber(ingredient.quantity)}{" "}
                      {ingredient.unit}
                    </option>
                  ))}
                </select>

                {ingredients.length === 0 && (
                  <p className="mt-2 text-sm font-semibold text-amber-700">
                    Primero agrega ingredientes a la receta.
                  </p>
                )}
              </Field>
            )}

            {showsDuration(formValues.type) && (
              <Field label="Duración estimada">
                <div className="relative">
                  <input
                    name="durationMinutes"
                    type="number"
                    min="0"
                    step="1"
                    value={formValues.durationMinutes}
                    onChange={(event) =>
                      onChange(
                        "durationMinutes",
                        event.target.value
                      )
                    }
                    placeholder="10"
                    className={`${inputClassName} pr-24`}
                  />

                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-bold text-slate-500">
                    minutos
                  </span>
                </div>
              </Field>
            )}

            {formValues.type === "MEASUREMENT" && (
              <MeasurementFields
                formValues={formValues}
                onChange={onChange}
              />
            )}

            <div className="grid gap-5 lg:grid-cols-2">
              <Field label="Acciones del paso">
                <textarea
                  name="actions"
                  value={formValues.actions}
                  onChange={(event) =>
                    onChange("actions", event.target.value)
                  }
                  rows={5}
                  placeholder={
                    "Escribe una acción por línea.\nEncender agitador\nAgregar lentamente"
                  }
                  className={inputClassName}
                />

                <p className="mt-2 text-xs text-slate-500">
                  Cada línea se convertirá en una acción separada.
                </p>
              </Field>

              <Field label="Verificaciones">
                <textarea
                  name="checks"
                  value={formValues.checks}
                  onChange={(event) =>
                    onChange("checks", event.target.value)
                  }
                  rows={5}
                  placeholder={
                    "Escribe una verificación por línea.\nSin grumos\nRecipiente limpio"
                  }
                  className={inputClassName}
                />

                <p className="mt-2 text-xs text-slate-500">
                  El operador deberá confirmar estas verificaciones.
                </p>
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ToggleField
                name="required"
                checked={formValues.required}
                onChange={(checked) =>
                  onChange("required", checked)
                }
                title="Paso obligatorio"
                description="No podrá omitirse durante la producción."
              />

              <ToggleField
                name="active"
                checked={formValues.active}
                onChange={(checked) =>
                  onChange("active", checked)
                }
                title="Paso activo"
                description="Se incluirá en los próximos lotes."
              />
            </div>
          </div>

          {state.error && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {state.error}
            </div>
          )}

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="min-h-12 rounded-xl border border-slate-300 px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={
                isPending ||
                !formValues.title.trim() ||
                (formValues.type === "INGREDIENT" &&
                  !formValues.recipeIngredientId)
              }
              className="min-h-12 rounded-xl bg-slate-950 px-6 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending
                ? "Guardando..."
                : isEditing
                ? "Guardar cambios"
                : "Agregar paso"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MeasurementFields({
  formValues,
  onChange,
}: {
  formValues: StepFormValues;
  onChange: <K extends keyof StepFormValues>(
    field: K,
    value: StepFormValues[K]
  ) => void;
}) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5">
      <h3 className="font-black text-slate-950">
        Configuración de la medición
      </h3>

      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <Field label="¿Qué se medirá?" required>
          <input
            name="measurementLabel"
            value={formValues.measurementLabel}
            onChange={(event) =>
              onChange("measurementLabel", event.target.value)
            }
            required
            list="measurement-options"
            placeholder="Ej. Alcohol"
            className={inputClassName}
          />

          <datalist id="measurement-options">
            <option value="Alcohol" />
            <option value="pH" />
            <option value="Brix" />
            <option value="Temperatura" />
            <option value="Densidad" />
            <option value="Color" />
          </datalist>
        </Field>

        <Field label="Unidad">
          <input
            name="measurementUnit"
            value={formValues.measurementUnit}
            onChange={(event) =>
              onChange("measurementUnit", event.target.value)
            }
            placeholder="Ej. %, °GL, pH, °C"
            className={inputClassName}
          />
        </Field>

        <Field label="Valor mínimo">
          <input
            name="minimumValue"
            type="number"
            step="any"
            value={formValues.minimumValue}
            onChange={(event) =>
              onChange("minimumValue", event.target.value)
            }
            placeholder="15.8"
            className={inputClassName}
          />
        </Field>

        <Field label="Valor máximo">
          <input
            name="maximumValue"
            type="number"
            step="any"
            value={formValues.maximumValue}
            onChange={(event) =>
              onChange("maximumValue", event.target.value)
            }
            placeholder="16.2"
            className={inputClassName}
          />
        </Field>
      </div>
    </div>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-slate-800">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </span>

      {children}
    </label>
  );
}

function ToggleField({
  name,
  checked,
  onChange,
  title,
  description,
}: {
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 rounded border-slate-300"
      />

      <span>
        <span className="block text-sm font-black text-slate-900">
          {title}
        </span>

        <span className="mt-1 block text-xs leading-5 text-slate-500">
          {description}
        </span>
      </span>
    </label>
  );
}

function getDefaultTitle(type: StepType): string {
  switch (type) {
    case "PREPARATION":
      return "Preparar proceso";

    case "INGREDIENT":
      return "Agregar ingrediente";

    case "MIXING":
      return "Mezclar";

    case "WAIT":
      return "Esperar";

    case "MEASUREMENT":
      return "Realizar medición";

    case "QUALITY_CHECK":
      return "Control de calidad";

    case "FINISH":
      return "Finalizar proceso";
  }
}
function showsDuration(type: StepType): boolean {
  return (
    type === "PREPARATION" ||
    type === "MIXING" ||
    type === "WAIT" ||
    type === "QUALITY_CHECK"
  );
}
function getStepMetadata(type: StepType) {
  switch (type) {
    case "PREPARATION":
      return {
        icon: "🛠️",
        label: "Preparación",
        barClass: "bg-slate-500",
        borderClass: "border-slate-300",
        badgeClass: "bg-slate-200 text-slate-800",
        labelClass: "bg-slate-200 text-slate-800",
        softClass: "bg-slate-100",
      };

    case "INGREDIENT":
      return {
        icon: "🧂",
        label: "Ingrediente",
        barClass: "bg-blue-500",
        borderClass: "border-blue-200",
        badgeClass: "bg-blue-100 text-blue-800",
        labelClass: "bg-blue-100 text-blue-800",
        softClass: "bg-blue-50",
      };

    case "MIXING":
      return {
        icon: "🌀",
        label: "Mezcla",
        barClass: "bg-violet-500",
        borderClass: "border-violet-200",
        badgeClass: "bg-violet-100 text-violet-800",
        labelClass: "bg-violet-100 text-violet-800",
        softClass: "bg-violet-50",
      };

    case "WAIT":
      return {
        icon: "⏱️",
        label: "Espera",
        barClass: "bg-amber-500",
        borderClass: "border-amber-200",
        badgeClass: "bg-amber-100 text-amber-800",
        labelClass: "bg-amber-100 text-amber-800",
        softClass: "bg-amber-50",
      };

    case "MEASUREMENT":
      return {
        icon: "🧪",
        label: "Medición",
        barClass: "bg-emerald-500",
        borderClass: "border-emerald-200",
        badgeClass: "bg-emerald-100 text-emerald-800",
        labelClass: "bg-emerald-100 text-emerald-800",
        softClass: "bg-emerald-50",
      };

    case "QUALITY_CHECK":
      return {
        icon: "✅",
        label: "Control de calidad",
        barClass: "bg-teal-500",
        borderClass: "border-teal-200",
        badgeClass: "bg-teal-100 text-teal-800",
        labelClass: "bg-teal-100 text-teal-800",
        softClass: "bg-teal-50",
      };

    case "FINISH":
      return {
        icon: "🏁",
        label: "Finalización",
        barClass: "bg-red-500",
        borderClass: "border-red-200",
        badgeClass: "bg-red-100 text-red-800",
        labelClass: "bg-red-100 text-red-800",
        softClass: "bg-red-50",
      };
  }
}

function formatMeasurementRange(step: RecipeStep) {
  const unit = step.measurementUnit
    ? ` ${step.measurementUnit}`
    : "";

  if (
    step.minimumValue !== null &&
    step.maximumValue !== null
  ) {
    return `${formatNumber(step.minimumValue)} a ${formatNumber(
      step.maximumValue
    )}${unit}`;
  }

  if (step.minimumValue !== null) {
    return `Mínimo ${formatNumber(step.minimumValue)}${unit}`;
  }

  if (step.maximumValue !== null) {
    return `Máximo ${formatNumber(step.maximumValue)}${unit}`;
  }

  return null;
}

function formatDuration(minutes: number) {
  if (minutes < 60) {
    return `${formatNumber(minutes)} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${remainingMinutes} min`;
}

function formatNumber(value: number | string) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return String(value);
  }

  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 3,
  }).format(number);
}

const inputClassName =
  "min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10";