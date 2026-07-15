"use client";

import { useState } from "react";

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
        className="w-full rounded-xl bg-green-500 px-6 py-3 font-bold text-black transition hover:bg-green-400"
      >
        Finalizar fermentación
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-700 bg-slate-950 shadow-2xl">
            <header className="border-b border-slate-800 p-6 sm:p-8">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-400">
                    MAESTRO
                  </p>

                  <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
                    Acta de Cierre de Fermentación
                  </h2>

                  <p className="mt-2 text-sm text-slate-400">
                    Confirma los resultados oficiales antes de cerrar el
                    proceso.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl bg-slate-800 px-4 py-2 text-slate-300 transition hover:bg-slate-700"
                  aria-label="Cerrar"
                >
                  ✕
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

              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <h3 className="font-bold text-white">
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

              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">
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
                <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <h3 className="text-lg font-bold text-white">
                    Resultados oficiales del cierre
                  </h3>

                  <p className="mt-1 text-sm text-slate-400">
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
                    <span className="mb-2 block text-sm font-medium text-slate-300">
                      Observaciones finales
                    </span>

                    <textarea
                      name="finalNotes"
                      rows={4}
                      placeholder="Describe el estado final, aroma, apariencia, comportamiento o cualquier detalle importante."
                      className="w-full resize-none rounded-xl border border-slate-700 bg-slate-800 p-3 text-white outline-none transition placeholder:text-slate-500 focus:border-amber-400"
                    />
                  </label>
                </section>

                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                  <p className="font-bold text-red-300">
                    Este cierre es definitivo
                  </p>

                  <p className="mt-1 text-sm text-red-200/70">
                    Después de confirmar ya no podrán registrarse nuevas
                    lecturas en esta fermentación.
                  </p>
                </div>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="rounded-xl border border-slate-700 px-6 py-3 font-bold text-slate-300 transition hover:bg-slate-800"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="rounded-xl bg-green-500 px-6 py-3 font-bold text-black transition hover:bg-green-400"
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
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-lg font-bold text-white">{value}</p>
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
    <div className="rounded-xl bg-slate-950 p-3">
      <p className="text-xs text-slate-500">{title}</p>
      <p className="mt-1 font-bold text-white">{value}</p>
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
        valid ? "bg-green-500/10" : "bg-amber-400/10"
      }`}
    >
      <span
        className={`mt-0.5 font-bold ${
          valid ? "text-green-400" : "text-amber-400"
        }`}
      >
        {valid ? "✓" : "⚠"}
      </span>

      <p
        className={`text-sm ${
          valid ? "text-green-200" : "text-amber-100"
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
      <span className="mb-2 block text-sm font-medium text-slate-300">
        {label}
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
          className={`w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white outline-none transition focus:border-amber-400 ${
            suffix ? "pr-12" : ""
          }`}
        />

        {suffix && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">
            {suffix}
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