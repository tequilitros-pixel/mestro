"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { finishLiquorBatchAction } from "@/app/actions/liquorBatchFinish";

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 sm:p-6">
      <div className="flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-green-500/30 bg-slate-900 shadow-2xl">
        <header className="shrink-0 border-b border-slate-800 px-6 py-5 sm:px-8">
          <h2 className="text-3xl font-black text-white">
            ✅ Finalizar lote
          </h2>

          <p className="mt-2 text-slate-400">
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
                className="text-sm font-semibold text-slate-300"
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
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 p-4 text-2xl font-bold text-white outline-none transition focus:border-green-500"
                />

                <span className="shrink-0 text-lg font-bold text-slate-400">
                  L
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="finalAlcohol"
                className="text-sm font-semibold text-slate-300"
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
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 p-4 text-2xl font-bold text-white outline-none transition focus:border-green-500"
                />

                <span className="shrink-0 text-lg font-bold text-slate-400">
                  %
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="finalNotes"
                className="text-sm font-semibold text-slate-300"
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
                className="mt-2 h-28 w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 p-4 text-white outline-none transition focus:border-green-500"
              />
            </div>

            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-green-300">
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

          <footer className="shrink-0 border-t border-slate-800 bg-slate-900 px-6 py-5 sm:px-8">
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-2xl border border-slate-700 py-4 font-bold text-white transition hover:bg-slate-800"
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
          ? "border-green-500/30 bg-green-500/10"
          : "border-slate-700 hover:border-slate-600"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(event.target.checked)
        }
        className="mt-1 h-5 w-5 shrink-0 accent-green-500"
      />

      <span
        className={
          checked
            ? "text-green-100"
            : "text-slate-300"
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
      className="flex-1 rounded-2xl bg-green-600 py-4 font-black text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
    >
      {pending
        ? "Finalizando lote..."
        : "✅ Finalizar lote"}
    </button>
  );
}