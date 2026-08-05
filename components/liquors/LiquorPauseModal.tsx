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
      <div className="w-full max-w-lg rounded-3xl border border-outline-variant bg-surface-container p-6 shadow-2xl sm:p-8">
        <h2 className="text-3xl font-black text-on-surface">
          ⏸ Pausar elaboración
        </h2>

        <p className="mt-2 text-on-surface-variant">
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
                    ? "border-secondary bg-secondary/10"
                    : "border-outline-variant hover:border-outline-variant"
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  value={option}
                  checked={reason === option}
                  onChange={() => setReason(option)}
                  className="h-5 w-5 accent-secondary"
                  required
                />

                <span className="text-on-surface">{option}</span>
              </label>
            ))}
          </div>

          <div>
            <label
              htmlFor="pauseNotes"
              className="text-sm font-semibold text-on-surface-variant"
            >
              Observaciones
            </label>

            <textarea
              id="pauseNotes"
              name="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Describe brevemente qué ocurrió..."
              className="resize-none mt-2 h-28 w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-secondary"
            />
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-2xl border border-outline-variant py-4 font-bold text-on-surface transition hover:bg-surface-container-high"
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
      className="flex-1 rounded-2xl bg-primary py-4 font-black text-on-primary transition hover:bg-primary disabled:cursor-not-allowed disabled:bg-surface-container-highest disabled:text-on-surface-variant"
    >
      {pending ? "Pausando..." : "⏸ Confirmar pausa"}
    </button>
  );
}