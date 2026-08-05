"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { completeLiquorBatchStepAction } from "@/app/actions/liquorBatchAssistant";
import LiquorPauseModal from "@/components/liquors/LiquorPauseModal";
import LiquorFinishModal from "@/components/liquors/LiquorFinishModal";
import { CheckIcon, PauseIcon } from "@/components/ui/icons";

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
  plannedLiters: number;
  targetAlcohol: number | null;
}; 

export default function LiquorBatchAssistant({
  batchId,
  steps,
  plannedLiters,
  targetAlcohol,
}: Props) {
    const [pauseModalOpen, setPauseModalOpen] = useState(false);
    const [finishModalOpen, setFinishModalOpen] = useState(false);
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
      <section className="rounded-3xl border border-tertiary-fixed-dim/30 bg-tertiary-fixed-dim/10 p-8 text-center">
        <p className="font-mono text-sm font-semibold uppercase tracking-[0.3em] text-tertiary-fixed-dim">
          Elaboración completada
        </p>


        <h2 className="mt-3 text-3xl font-black text-on-surface">
          Todos los pasos fueron realizados
        </h2>

        <p className="mt-3 text-on-surface-variant">
          El lote está listo para continuar con el embotellado.
        </p>
        <button
  type="button"
  onClick={() => setFinishModalOpen(true)}
  className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-tertiary-fixed-dim py-4 text-xl font-black text-on-surface transition duration-150 ease-out hover:scale-[1.02] hover:opacity-90 active:scale-[0.98]"
>
  <CheckIcon className="h-5 w-5" />
  Finalizar lote
</button>
<LiquorFinishModal
  batchId={batchId}
  open={finishModalOpen}
  plannedLiters={plannedLiters}
  targetAlcohol={targetAlcohol}
  onClose={() => setFinishModalOpen(false)}
/>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-secondary/30 bg-surface-container p-6 sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-sm font-semibold uppercase tracking-[0.3em] text-secondary">
            Asistente de elaboración
          </p>

          <h2 className="mt-2 text-2xl font-black text-on-surface">
            Paso {completedCount + 1} de {totalCount}
          </h2>
        </div>

        <p className="text-2xl font-black text-secondary">
          {progress}%
        </p>
      </div>

      <div className="mt-5 h-3 overflow-hidden rounded-full bg-surface-container-high">
        <div
          className="h-full rounded-full bg-secondary transition-all duration-500"
          style={{
            width: `${progress}%`,
          }}
        />
      </div>

      <div className="mt-8 rounded-3xl border border-outline-variant bg-background/60 p-6 sm:p-8">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.25em] text-outline">
          {formatStepType(currentStep.type)}
        </p>

        <h3 className="mt-3 text-3xl font-black text-on-surface">
          {currentStep.title}
        </h3>

        {currentStep.plannedQuantity !== null &&
          currentStep.unit && (
            <div className="mt-6 rounded-2xl border border-secondary/20 bg-secondary/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-secondary/70">
                Cantidad requerida
              </p>

              <p className="mt-2 text-4xl font-black text-secondary">
                {formatNumber(currentStep.plannedQuantity)}{" "}
                {currentStep.unit}
              </p>
            </div>
          )}

        {currentStep.instruction && (
          <div className="mt-6 rounded-2xl border border-outline-variant bg-surface-container/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-outline">
              Objetivo del paso
            </p>

            <p className="mt-3 leading-7 text-on-surface-variant">
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
  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-secondary bg-secondary/10 py-4 text-lg font-bold text-secondary transition duration-150 ease-out hover:scale-[1.01] hover:bg-secondary/20 active:scale-[0.99]"
>
  <PauseIcon className="h-5 w-5" />
  Pausar elaboración
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
          <p className="font-mono text-sm font-black uppercase tracking-[0.2em] text-secondary">
            Procedimiento
          </p>

          <ol className="mt-4 space-y-3">
            {step.actions.map((action, index) => (
              <li
                key={`${step.id}-action-${index}`}
                className="flex gap-4 rounded-2xl border border-outline-variant bg-surface-container/60 p-4"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-sm font-black text-secondary">
                  {index + 1}
                </span>

                <p className="pt-1 leading-6 text-on-surface">
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
            className="text-sm font-semibold text-on-surface-variant"
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
              className="w-full rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            />

            <span className="shrink-0 text-lg font-bold text-on-surface-variant">
              {step.unit}
            </span>
          </div>
        </div>
      )}

      {step.checks.length > 0 && (
        <div>
          <p className="font-mono text-sm font-black uppercase tracking-[0.2em] text-tertiary-fixed-dim">
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
                      ? "border-tertiary-fixed-dim/30 bg-tertiary-fixed-dim/10"
                      : "border-outline-variant bg-surface-container/60 hover:border-outline-variant"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="completedCheckIndexes"
                    value={index}
                    checked={checked}
                    onChange={() => toggleCheck(index)}
                    className="mt-1 h-5 w-5 accent-tertiary-fixed-dim"
                  />

                  <span
                    className={
                      checked
                        ? "text-tertiary-fixed-dim"
                        : "text-on-surface-variant"
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
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary py-4 text-lg font-bold text-on-surface transition duration-150 ease-out hover:scale-[1.01] hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-surface-container-highest disabled:text-on-surface-variant disabled:hover:scale-100"
    >
      {pending ? (
        "Guardando paso..."
      ) : (
        <>
          <CheckIcon className="h-4 w-4" />
          Finalizar paso
        </>
      )}
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