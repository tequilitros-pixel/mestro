"use client";

import { useState } from "react";
import { XIcon, CheckIcon, AlertIcon } from "@/components/ui/icons";

type Props = {
  lotCode: string;
  tank: string;
  mustLiters: number;

  currentBrix: number;
  currentPh: number;
  currentAlcohol: number | null;
  currentTemperature: number;

  readingsCount: number;

  action: (formData: FormData) => Promise<void>;
};

export default function FinishFermentationModal({
  lotCode,
  tank,
  mustLiters,
  currentBrix,
  currentPh,
  currentAlcohol,
  currentTemperature,
  readingsCount,
  action,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const brixReady = currentBrix <= 2.5;
  const phReady = currentPh >= 3.8 && currentPh <= 5;
  const temperatureReady =
    currentTemperature >= 25 && currentTemperature <= 35;
  const alcoholReady = currentAlcohol !== null;
  const hasReadings = readingsCount > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full rounded-xl bg-tertiary-fixed-dim px-6 py-3 font-bold text-on-primary transition hover:opacity-90"
      >
        Finalizar fermentación
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-dim/80 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-outline-variant bg-background shadow-2xl">
            <header className="border-b border-outline-variant p-6 sm:p-8">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-outline">
                    MAESTRO
                  </p>

                  <h2 className="mt-3 text-2xl font-bold text-on-surface sm:text-3xl">
                    Acta de Cierre de Fermentación
                  </h2>

                  <p className="mt-2 text-sm text-on-surface-variant">
                    Confirma los resultados oficiales antes de cerrar el
                    proceso.
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

            <div className="space-y-6 p-6 sm:p-8">
              <section className="grid gap-4 sm:grid-cols-3">
                <SummaryCard title="Lote" value={lotCode} />
                <SummaryCard title="Tina" value={tank} />
                <SummaryCard
                  title="Mosto"
                  value={`${formatNumber(mustLiters, 0)} L`}
                />
              </section>

              <section className="rounded-2xl border border-outline-variant bg-surface-container p-5">
                <h3 className="font-bold text-on-surface">
                  Resumen actual del proceso
                </h3>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Mini title="Lecturas" value={readingsCount} />
                  <Mini
                    title="°Brix"
                    value={formatNumber(currentBrix)}
                  />
                  <Mini title="pH" value={formatNumber(currentPh)} />
                  <Mini
                    title="Alcohol"
                    value={
                      currentAlcohol !== null
                        ? `${formatNumber(currentAlcohol)} %`
                        : "Sin registro"
                    }
                  />
                  <Mini
                    title="Temperatura"
                    value={`${formatNumber(currentTemperature)} °C`}
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-outline-variant bg-surface-container p-5">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-outline">
                  Revisión de MAESTRO
                </p>

                <div className="mt-4 space-y-3">
                  <ValidationItem
                    valid={hasReadings}
                    success="La bitácora tiene lecturas registradas."
                    warning="No existen lecturas posteriores al inicio."
                  />

                  <ValidationItem
                    valid={brixReady}
                    success="El °Brix se encuentra cerca o dentro de la meta."
                    warning={`El °Brix actual es ${formatNumber(
                      currentBrix
                    )}. La meta recomendada es 2.5 o menos.`}
                  />

                  <ValidationItem
                    valid={phReady}
                    success="El pH se encuentra dentro del rango operativo."
                    warning={`El pH actual es ${formatNumber(
                      currentPh
                    )} y se encuentra fuera del rango esperado.`}
                  />

                  <ValidationItem
                    valid={temperatureReady}
                    success="La temperatura se encuentra dentro del rango operativo."
                    warning={`La temperatura actual es ${formatNumber(
                      currentTemperature
                    )} °C y requiere revisión.`}
                  />

                  <ValidationItem
                    valid={alcoholReady}
                    success="Existe un registro previo de alcohol."
                    warning="Todavía no existe una lectura de alcohol."
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
                      name="finalBrix"
                      label="°Brix final"
                      defaultValue={currentBrix}
                      step="0.01"
                      min="0"
                      required
                    />

                    <Field
                      name="finalPh"
                      label="pH final"
                      defaultValue={currentPh}
                      step="0.01"
                      min="0"
                      max="14"
                      required
                    />

                    <Field
                      name="finalAlcohol"
                      label="Alcohol final"
                      defaultValue={currentAlcohol ?? ""}
                      step="0.01"
                      min="0"
                      suffix="%"
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
                      placeholder="Describe el estado final, aroma, apariencia, comportamiento o cualquier detalle importante."
                      className="w-full resize-none rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
                    />
                  </label>
                </section>

                <div className="rounded-2xl border border-error/20 bg-error/10 p-4">
                  <p className="font-bold text-error">
                    Este cierre es definitivo
                  </p>

                  <p className="mt-1 text-sm text-error/70">
                    Después de confirmar ya no podrán registrarse nuevas
                    lecturas en esta fermentación.
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
                    Confirmar y cerrar fermentación
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
  max,
  suffix,
  required = false,
}: {
  name: string;
  label: string;
  defaultValue: string | number;
  step: string;
  min?: string;
  max?: string;
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
        <input
          name={name}
          type="number"
          inputMode="decimal"
          defaultValue={defaultValue}
          step={step}
          min={min}
          max={max}
          required={required}
          className={`peer w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary user-invalid:border-error ${
            suffix ? "pr-12" : ""
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