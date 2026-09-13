"use client";

import { useState } from "react";
import { XIcon, CheckIcon, AlertIcon } from "@/components/ui/icons";

type Props = {
  lotCode: string;
  equipmentName: string;
  initialAgaveKg: number;
  currentAgaveKg: number;
  sweetHoneyLiters: number;
  sweetHoneyBrix: number | null;
  bitterHoneyLiters: number;
  eventsCount: number;
  action: (formData: FormData) => Promise<void>;
};

export default function FinishCookingModal({
  lotCode,
  equipmentName,
  initialAgaveKg,
  currentAgaveKg,
  sweetHoneyLiters,
  sweetHoneyBrix,
  bitterHoneyLiters,
  eventsCount,
  action,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const hasEvents = eventsCount > 0;
  const hasSweetHoney = sweetHoneyLiters > 0;
  const hasSweetHoneyBrix = sweetHoneyBrix !== null;
  const validAgave = currentAgaveKg > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full rounded-xl bg-tertiary-fixed-dim px-6 py-4 text-lg font-bold text-on-primary transition hover:opacity-90"
      >
        Finalizar cocción
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-dim/80 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-outline-variant bg-background shadow-xl">
            <header className="border-b border-outline-variant p-4 sm:p-5">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.3em] text-outline">
                    MAESTRO
                  </p>

                  <h2 className="mt-3 text-2xl font-bold text-on-surface sm:text-3xl">
                    Acta de Cierre de Cocción
                  </h2>

                  <p className="mt-2 text-sm text-on-surface-variant">
                    Confirma los resultados oficiales antes de cerrar el horno.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl bg-surface-container-high px-4 py-2 text-on-surface-variant transition duration-150 ease-out hover:scale-[1.04] hover:bg-surface-container-highest active:scale-[0.97]"
                  aria-label="Cerrar"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="space-y-4 p-4 sm:p-5">
              <section className="grid gap-4 sm:grid-cols-3">
                <SummaryCard title="Lote" value={lotCode} />
                <SummaryCard title="Horno" value={equipmentName} />
                <SummaryCard
                  title="Carga inicial"
                  value={`${formatNumber(initialAgaveKg, 0)} kg`}
                />
              </section>

              <section className="rounded-2xl border border-outline-variant bg-surface-container p-5">
                <h3 className="font-bold text-on-surface">
                  Resumen actual del cocimiento
                </h3>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Mini title="Eventos" value={eventsCount} />

                  <Mini
                    title="Mieles amargas"
                    value={`${formatNumber(bitterHoneyLiters)} L`}
                  />

                  <Mini
                    title="Mieles dulces"
                    value={`${formatNumber(sweetHoneyLiters)} L`}
                  />

                  <Mini
                    title="°Brix miel dulce"
                    value={
                      sweetHoneyBrix !== null
                        ? formatNumber(sweetHoneyBrix)
                        : "Sin registro"
                    }
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-outline-variant bg-surface-container p-5">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-outline">
                  Revisión de MAESTRO
                </p>

                <div className="mt-4 space-y-3">
                  <ValidationItem
                    valid={hasEvents}
                    success="La bitácora tiene eventos registrados."
                    warning="No existen eventos registrados en la cocción."
                  />

                  <ValidationItem
                    valid={hasSweetHoney}
                    success="Se registró extracción de mieles dulces."
                    warning="No existe volumen registrado de mieles dulces."
                  />

                  <ValidationItem
                    valid={hasSweetHoneyBrix}
                    success="Existe una medición de °Brix de mieles dulces."
                    warning="No existe una lectura de °Brix de mieles dulces."
                  />

                  <ValidationItem
                    valid={validAgave}
                    success="La cantidad final de agave es válida."
                    warning="La cantidad final de agave debe ser mayor que cero."
                  />
                </div>
              </section>

              <form action={action} className="space-y-5">
                <section className="rounded-2xl border border-outline-variant bg-surface-container p-5">
                  <h3 className="text-lg font-bold text-on-surface">
                    Resultados oficiales del cierre
                  </h3>

                  <p className="mt-1 text-sm text-on-surface-variant">
                    Estos valores quedarán guardados en el expediente del lote.
                  </p>

                  <div className="mt-5 grid gap-4 sm:grid-cols-3">
                    <Field
                      name="finalAgaveKg"
                      label="Agave cocido final"
                      defaultValue={currentAgaveKg}
                      step="0.01"
                      min="0"
                      suffix="kg"
                      required
                    />

                    <Field
                      name="finalSweetHoneyLiters"
                      label="Mieles dulces finales"
                      defaultValue={sweetHoneyLiters}
                      step="0.01"
                      min="0"
                      suffix="L"
                      required
                    />

                    <Field
                      name="finalSweetHoneyBrix"
                      label="°Brix miel dulce"
                      defaultValue={sweetHoneyBrix ?? ""}
                      step="0.01"
                      min="0"
                      required
                    />
                  </div>

                  <label className="mt-5 block">
                    <span className="mb-2 block text-sm font-semibold text-on-surface-variant">
                      Observaciones finales
                    </span>

                    <textarea
                      name="finalNotes"
                      rows={4}
                      placeholder="Describe el estado final del agave, caramelización, aroma, textura o cualquier detalle importante."
                      className="w-full resize-none rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
                    />
                  </label>
                </section>

                <div className="rounded-2xl border border-error/20 bg-error/10 p-4">
                  <p className="font-bold text-error">
                    Este cierre es definitivo
                  </p>

                  <p className="mt-1 text-sm text-error/70">
                    Después de confirmar ya no podrán registrarse temperaturas,
                    extracciones ni nuevos eventos de cocción.
                  </p>
                </div>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="rounded-xl border border-outline-variant px-6 py-3 font-bold text-on-surface-variant transition hover:bg-surface-container-high"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="rounded-xl bg-tertiary-fixed-dim px-6 py-3 font-bold text-on-primary transition hover:opacity-90"
                  >
                    Confirmar y cerrar cocción
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container p-4">
      <p className="text-xs uppercase tracking-wider text-outline">
        {title}
      </p>

      <p className="mt-2 text-lg font-bold text-on-surface">{value}</p>
    </div>
  );
}

function Mini({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl bg-background p-3">
      <p className="text-xs text-outline">{title}</p>
      <p className="mt-1 font-bold text-on-surface">{value}</p>
    </div>
  );
}

function ValidationItem({
  valid,
  success,
  warning,
}: {
  valid: boolean;
  success: string;
  warning: string;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl p-3 ${
        valid ? "bg-tertiary-fixed-dim/10" : "bg-secondary/10"
      }`}
    >
      <span
        className={`mt-0.5 shrink-0 ${
          valid ? "text-tertiary-fixed-dim" : "text-secondary"
        }`}
      >
        {valid ? (
          <CheckIcon className="h-4 w-4" />
        ) : (
          <AlertIcon className="h-4 w-4" />
        )}
      </span>

      <p
        className={`text-sm ${
          valid ? "text-tertiary-fixed-dim" : "text-secondary"
        }`}
      >
        {valid ? success : warning}
      </p>
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  step,
  min,
  suffix,
  required = false,
}: {
  name: string;
  label: string;
  defaultValue: string | number;
  step: string;
  min?: string;
  suffix?: string;
  required?: boolean;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-semibold text-on-surface-variant">
        {label}
        {required && (
          <span className="ml-1 text-error" aria-hidden="true">
            *
          </span>
        )}
      </span>

      <div className="relative">
        {/*
          `peer` + `user-invalid` marcan el campo en rojo y muestran el
          aviso SOLO después de que el usuario intenta enviar, no al
          abrir el formulario. Antes, un campo obligatorio vacío hacía
          que el botón de cerrar no respondiera sin ninguna explicación
          visible.
        */}
        <input
          name={name}
          type="number"
          inputMode="decimal"
          defaultValue={defaultValue}
          step={step}
          min={min}
          required={required}
          className={`peer w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary user-invalid:border-error ${
            suffix ? "pr-14" : ""
          }`}
        />

        {suffix && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-outline">
            {suffix}
          </span>
        )}

        {required && (
          <span className="mt-1 hidden text-xs font-semibold text-error peer-user-invalid:block">
            Este dato es obligatorio para cerrar.
          </span>
        )}
      </div>
    </label>
  );
}

function formatNumber(
  value: number,
  maximumFractionDigits = 2
) {
  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits,
  }).format(value);
}
