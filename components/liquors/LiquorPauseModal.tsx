"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { pauseLiquorBatchAction } from "@/app/actions/liquorBatchPause";

type Props = {
  batchId: string;
  open: boolean;
  onClose: () => void;
};

const PAUSE_REASONS = [
  "Falta momentánea de ingrediente",
  "Limpieza del recipiente",
  "Ajuste del proceso",
  "Esperando autorización",
  "Otro",
];

export default function LiquorPauseModal({
  batchId,
  open,
  onClose,
}: Props) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl sm:p-8">
        <h2 className="text-3xl font-black text-white">
          ⏸ Pausar elaboración
        </h2>

        <p className="mt-2 text-slate-400">
          La pausa debe ser temporal. El lote continuará en el mismo paso.
        </p>

        <form
          action={pauseLiquorBatchAction}
          className="mt-8 space-y-6"
        >
          <input type="hidden" name="batchId" value={batchId} />

          <div className="space-y-3">
            {PAUSE_REASONS.map((option) => (
              <label
                key={option}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition ${
                  reason === option
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-slate-700 hover:border-slate-600"
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  value={option}
                  checked={reason === option}
                  onChange={() => setReason(option)}
                  className="h-5 w-5 accent-amber-500"
                  required
                />

                <span className="text-slate-200">{option}</span>
              </label>
            ))}
          </div>

          <div>
            <label
              htmlFor="pauseNotes"
              className="text-sm font-semibold text-slate-300"
            >
              Observaciones
            </label>

            <textarea
              id="pauseNotes"
              name="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Describe brevemente qué ocurrió..."
              className="mt-2 h-28 w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 p-4 text-white outline-none transition focus:border-amber-500"
            />
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-2xl border border-slate-700 py-4 font-bold text-white transition hover:bg-slate-800"
            >
              Cancelar
            </button>

            <PauseSubmitButton disabled={!reason} />
          </div>
        </form>
      </div>
    </div>
  );
}

function PauseSubmitButton({
  disabled,
}: {
  disabled: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="flex-1 rounded-2xl bg-amber-500 py-4 font-black text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
    >
      {pending ? "Pausando..." : "⏸ Confirmar pausa"}
    </button>
  );
}