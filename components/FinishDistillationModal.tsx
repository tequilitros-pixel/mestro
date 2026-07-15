"use client";

import { useState } from "react";

type Props = {
  onConfirm: (formData: FormData) => void;
};

export default function FinishDistillationModal({
  onConfirm,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl bg-green-500 px-6 py-3 font-bold text-black hover:bg-green-400"
      >
        Finalizar destilación
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-slate-900 p-8">

            <h2 className="text-3xl font-bold text-white">
              Acta de cierre de destilación
            </h2>

            <p className="mt-2 text-slate-400">
              Una vez cerrada la destilación no podrán agregarse más registros.
            </p>

            <form action={onConfirm} className="mt-8 space-y-4">

              <input
                name="finalLiters"
                type="number"
                step="0.01"
                placeholder="Litros finales"
                required
                className="w-full rounded-xl bg-slate-800 p-3"
              />

              <input
                name="finalAlcohol"
                type="number"
                step="0.01"
                placeholder="Alcohol final corregido (%)"
                required
                className="w-full rounded-xl bg-slate-800 p-3"
              />

              <textarea
                name="finalNotes"
                rows={4}
                placeholder="Observaciones finales"
                className="w-full rounded-xl bg-slate-800 p-3"
              />

              <div className="flex gap-4">

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl bg-slate-700 py-3 font-bold"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-green-500 py-3 font-bold text-black"
                >
                  Cerrar proceso
                </button>

              </div>

            </form>

          </div>
        </div>
      )}
    </>
  );
}