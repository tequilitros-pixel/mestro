"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { completeLiquorBatchStepAction } from "@/app/actions/liquorBatchAssistant";
import LiquorPauseModal from "@/components/liquors/LiquorPauseModal";

type BatchStep = {
  id: string;
  position: number;
  type: string;
  status: string;

  title: string;
  instruction: string | null;

  actions: string[];
  checks: string[];

  plannedQuantity: number | null;
  actualQuantity: number | null;
  unit: string | null;
};

type Props = {
  batchId: string;
  steps: BatchStep[];
};

export default function LiquorBatchAssistant({
  batchId,
  steps,
}: Props) {
    const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const completedCount = steps.filter(
    (step) => step.status === "COMPLETADO"
  ).length;

  const totalCount = steps.length;

  const currentStep = steps.find(
    (step) => step.status !== "COMPLETADO"
  );

  const progress =
    totalCount > 0
      ? Math.round((completedCount / totalCount) * 100)
      : 0;

  if (!currentStep) {
    return (
      <section className="rounded-3xl border border-green-500/30 bg-green-500/10 p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
          Elaboración completada
        </p>

        <h2 className="mt-3 text-3xl font-black text-white">
          Todos los pasos fueron realizados
        </h2>

        <p className="mt-3 text-slate-300">
          El lote está listo para continuar con el embotellado.
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
          className="h-full rounded-full bg-purple-500 transition-all duration-500"
          style={{
            width: `${progress}%`,
          }}
        />
      </div>

      <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-950/60 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          {formatStepType(currentStep.type)}
        </p>

        <h3 className="mt-3 text-3xl font-black text-white">
          {currentStep.title}
        </h3>

        {currentStep.plannedQuantity !== null &&
          currentStep.unit && (
            <div className="mt-6 rounded-2xl border border-purple-500/20 bg-purple-500/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-purple-300/70">
                Cantidad requerida
              </p>

              <p className="mt-2 text-4xl font-black text-purple-200">
                {formatNumber(currentStep.plannedQuantity)}{" "}
                {currentStep.unit}
              </p>
            </div>
          )}

        {currentStep.instruction && (
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Objetivo del paso
            </p>

            <p className="mt-3 leading-7 text-slate-300">
              {currentStep.instruction}
            </p>
          </div>
        )}

        <StepForm
          key={currentStep.id}
          batchId={batchId}
          step={currentStep}
        />
        <button
  type="button"
  onClick={() => setPauseModalOpen(true)}
  className="mt-4 w-full rounded-2xl border border-amber-500 bg-amber-500/10 py-4 text-lg font-bold text-amber-300 transition hover:bg-amber-500/20"
>
  ⏸ Pausar elaboración
</button>

<LiquorPauseModal
  batchId={batchId}
  open={pauseModalOpen}
  onClose={() => setPauseModalOpen(false)}
/>
      </div>
    </section>
  );
}

function StepForm({
  batchId,
  step,
}: {
  batchId: string;
  step: BatchStep;
}) {
  const [actualQuantity, setActualQuantity] = useState(
    step.plannedQuantity !== null
      ? String(step.actualQuantity ?? step.plannedQuantity)
      : ""
  );

  const [completedChecks, setCompletedChecks] =
    useState<number[]>([]);

  const allChecksCompleted = step.checks.every(
    (_, index) => completedChecks.includes(index)
  );

  function toggleCheck(index: number) {
    setCompletedChecks((current) =>
      current.includes(index)
        ? current.filter((item) => item !== index)
        : [...current, index]
    );
  }

  return (
    <form
      action={completeLiquorBatchStepAction}
      className="mt-8 space-y-7"
    >
      <input
        type="hidden"
        name="batchId"
        value={batchId}
      />

      <input
        type="hidden"
        name="stepId"
        value={step.id}
      />

      {step.actions.length > 0 && (
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-purple-300">
            Procedimiento
          </p>

          <ol className="mt-4 space-y-3">
            {step.actions.map((action, index) => (
              <li
                key={`${step.id}-action-${index}`}
                className="flex gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-500/15 text-sm font-black text-purple-300">
                  {index + 1}
                </span>

                <p className="pt-1 leading-6 text-slate-200">
                  {action}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {step.plannedQuantity !== null && step.unit && (
        <div>
          <label
            htmlFor={`actualQuantity-${step.id}`}
            className="text-sm font-semibold text-slate-300"
          >
            Cantidad real utilizada
          </label>

          <div className="mt-2 flex items-center gap-3">
            <input
              id={`actualQuantity-${step.id}`}
              name="actualQuantity"
              type="number"
              min="0"
              step="0.01"
              value={actualQuantity}
              onChange={(event) =>
                setActualQuantity(event.target.value)
              }
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 p-4 text-2xl font-bold text-white outline-none transition focus:border-purple-400"
            />

            <span className="shrink-0 text-lg font-bold text-slate-400">
              {step.unit}
            </span>
          </div>
        </div>
      )}

      {step.checks.length > 0 && (
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-green-300">
            Verificar antes de continuar
          </p>

          <div className="mt-4 space-y-3">
            {step.checks.map((check, index) => {
              const checked =
                completedChecks.includes(index);

              return (
                <label
                  key={`${step.id}-check-${index}`}
                  className={`flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition ${
                    checked
                      ? "border-green-500/30 bg-green-500/10"
                      : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="completedCheckIndexes"
                    value={index}
                    checked={checked}
                    onChange={() => toggleCheck(index)}
                    className="mt-1 h-5 w-5 accent-green-500"
                  />

                  <span
                    className={
                      checked
                        ? "text-green-100"
                        : "text-slate-300"
                    }
                  >
                    {check}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <SubmitButton
        disabled={
          !allChecksCompleted ||
          (step.plannedQuantity !== null &&
            (!actualQuantity ||
              Number(actualQuantity) < 0))
        }
      />
    
    </form>
  );
}

function SubmitButton({
  disabled,
}: {
  disabled: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="w-full rounded-2xl bg-purple-500 py-4 text-lg font-bold text-white transition hover:bg-purple-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
    >
      {pending
        ? "Guardando paso..."
        : "✓ Finalizar paso"}
    </button>
  );
}

function formatStepType(type: string) {
  const labels: Record<string, string> = {
    PREPARATION: "Preparación",
    INGREDIENT: "Ingrediente",
    MIXING: "Mezclado",
    WAIT: "Reposo",
    MEASUREMENT: "Medición",
    QUALITY_CHECK: "Control de calidad",
    FINISH: "Finalización",
  };

  return labels[type] ?? "Paso de elaboración";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 2,
  }).format(value);
}