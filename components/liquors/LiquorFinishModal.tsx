"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { finishLiquorBatchAction } from "@/app/actions/liquorBatchFinish";
import { CheckIcon } from "@/components/ui/icons";

type Props = {
  batchId: string;
  open: boolean;
  plannedLiters: number;
  targetAlcohol: number | null;
  onClose: () => void;
};

export default function LiquorFinishModal({
  batchId,
  open,
  plannedLiters,
  targetAlcohol,
  onClose,
}: Props) {
  const [finalLiters, setFinalLiters] = useState(
    String(plannedLiters)
  );

  const [finalAlcohol, setFinalAlcohol] = useState(
    targetAlcohol !== null ? String(targetAlcohol) : ""
  );

  const [notes, setNotes] = useState("");

  const [checks, setChecks] = useState({
    inspected: false,
    homogeneous: false,
    identified: false,
    ready: false,
  });

  if (!open) {
    return null;
  }

  const allChecksCompleted = Object.values(checks).every(Boolean);

  const validFinalLiters =
    finalLiters.trim() !== "" &&
    Number.isFinite(Number(finalLiters)) &&
    Number(finalLiters) > 0;

  const validFinalAlcohol =
    finalAlcohol.trim() !== "" &&
    Number.isFinite(Number(finalAlcohol)) &&
    Number(finalAlcohol) >= 0 &&
    Number(finalAlcohol) <= 100;

  const canSubmit =
    allChecksCompleted &&
    validFinalLiters &&
    validFinalAlcohol;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-surface-dim/80 p-3 sm:p-6">
      <div className="flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-tertiary-fixed-dim/30 bg-surface-container shadow-2xl">
        <header className="shrink-0 border-b border-outline-variant px-6 py-5 sm:px-8">
          <h2 className="flex items-center gap-2 text-3xl font-black text-on-surface">
            <CheckIcon className="h-7 w-7 text-tertiary-fixed-dim" />
            Finalizar lote
          </h2>

          <p className="mt-2 text-on-surface-variant">
            Registra los resultados finales antes de liberar el lote
            para embotellado.
          </p>
        </header>

        <form
          action={finishLiquorBatchAction}
          className="flex min-h-0 flex-1 flex-col"
        >
          <input
            type="hidden"
            name="batchId"
            value={batchId}
          />

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6 sm:px-8">
            <div>
              <label
                htmlFor="finalLiters"
                className="text-sm font-semibold text-on-surface-variant"
              >
                Litros finales obtenidos
              </label>

              <div className="mt-2 flex items-center gap-3">
                <input
                  id="finalLiters"
                  name="actualLiters"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={finalLiters}
                  onChange={(event) =>
                    setFinalLiters(event.target.value)
                  }
                  className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-tertiary-fixed-dim"
                />

                <span className="shrink-0 text-lg font-bold text-on-surface-variant">
                  L
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="finalAlcohol"
                className="text-sm font-semibold text-on-surface-variant"
              >
                Alcohol final medido
              </label>

              <div className="mt-2 flex items-center gap-3">
                <input
                  id="finalAlcohol"
                  name="finalAlcohol"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                  value={finalAlcohol}
                  onChange={(event) =>
                    setFinalAlcohol(event.target.value)
                  }
                  className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-tertiary-fixed-dim"
                />

                <span className="shrink-0 text-lg font-bold text-on-surface-variant">
                  %
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="finalNotes"
                className="text-sm font-semibold text-on-surface-variant"
              >
                Observaciones finales
              </label>

              <textarea
                id="finalNotes"
                name="notes"
                value={notes}
                onChange={(event) =>
                  setNotes(event.target.value)
                }
                placeholder="Registra cualquier observación importante..."
                className="resize-none mt-2 h-28 w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-tertiary-fixed-dim"
              />
            </div>

            <div>
              <p className="font-mono text-sm font-black uppercase tracking-[0.2em] text-tertiary-fixed-dim">
                Verificación final
              </p>

              <div className="mt-4 space-y-3">
                <CheckOption
                  label="El lote fue inspeccionado visualmente."
                  checked={checks.inspected}
                  onChange={(checked) =>
                    setChecks((current) => ({
                      ...current,
                      inspected: checked,
                    }))
                  }
                />

                <CheckOption
                  label="El producto está homogéneo."
                  checked={checks.homogeneous}
                  onChange={(checked) =>
                    setChecks((current) => ({
                      ...current,
                      homogeneous: checked,
                    }))
                  }
                />

                <CheckOption
                  label="El tanque está identificado correctamente."
                  checked={checks.identified}
                  onChange={(checked) =>
                    setChecks((current) => ({
                      ...current,
                      identified: checked,
                    }))
                  }
                />

                <CheckOption
                  label="El lote está listo para embotellado."
                  checked={checks.ready}
                  onChange={(checked) =>
                    setChecks((current) => ({
                      ...current,
                      ready: checked,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <footer className="shrink-0 border-t border-outline-variant bg-surface-container px-6 py-5 sm:px-8">
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-2xl border border-outline-variant py-4 font-bold text-on-surface transition hover:bg-surface-container-high"
              >
                Cancelar
              </button>

              <FinishSubmitButton disabled={!canSubmit} />
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}

function CheckOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition ${
        checked
          ? "border-tertiary-fixed-dim/30 bg-tertiary-fixed-dim/10"
          : "border-outline-variant hover:border-outline-variant"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(event.target.checked)
        }
        className="mt-1 h-5 w-5 shrink-0 accent-tertiary-fixed-dim"
      />

      <span
        className={
          checked
            ? "text-tertiary-fixed-dim"
            : "text-on-surface-variant"
        }
      >
        {label}
      </span>
    </label>
  );
}

function FinishSubmitButton({
  disabled,
}: {
  disabled: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-tertiary-fixed-dim py-4 font-black text-on-surface transition duration-150 ease-out hover:scale-[1.02] hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-surface-container-highest disabled:text-on-surface-variant disabled:hover:scale-100"
    >
      {pending ? (
        "Finalizando lote..."
      ) : (
        <>
          <CheckIcon className="h-4 w-4" />
          Finalizar lote
        </>
      )}
    </button>
  );
}