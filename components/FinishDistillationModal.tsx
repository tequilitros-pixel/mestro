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
        className="w-full rounded-xl bg-tertiary-fixed-dim px-6 py-3 font-bold text-on-primary hover:opacity-90"
      >
        Finalizar destilación
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-dim/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-surface-container p-8">

            <h2 className="text-3xl font-bold text-on-surface">
              Acta de cierre de destilación
            </h2>

            <p className="mt-2 text-on-surface-variant">
              Una vez cerrada la destilación no podrán agregarse más registros.
            </p>

            <form action={onConfirm} className="mt-8 space-y-4">

              {/*
                Estos campos son obligatorios: sin etiqueta visible y sin
                aviso de error, el botón de cerrar parecía no responder.
              */}
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-on-surface-variant">
                  Litros finales
                  <span className="ml-1 text-error" aria-hidden="true">
                    *
                  </span>
                </span>

                <input
                  name="finalLiters"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ej. 180.5"
                  required
                  className="peer w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary user-invalid:border-error"
                />

                <span className="mt-1 hidden text-xs font-semibold text-error peer-user-invalid:block">
                  Este dato es obligatorio para cerrar.
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-on-surface-variant">
                  Alcohol final corregido (%)
                  <span className="ml-1 text-error" aria-hidden="true">
                    *
                  </span>
                </span>

                <input
                  name="finalAlcohol"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="Ej. 55"
                  required
                  className="peer w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary user-invalid:border-error"
                />

                <span className="mt-1 hidden text-xs font-semibold text-error peer-user-invalid:block">
                  Este dato es obligatorio para cerrar.
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-on-surface-variant">
                  Observaciones finales
                </span>

                <textarea
                  name="finalNotes"
                  rows={4}
                  placeholder="Detalles del corte, aroma, incidencias."
                  className="w-full resize-none rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
                />
              </label>

              <div className="flex gap-4">

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl bg-surface-container-highest py-3 font-bold"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-tertiary-fixed-dim py-3 font-bold text-on-primary"
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