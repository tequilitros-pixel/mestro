"use client";

import { useState } from "react";

type Props = {
  lotCode: string;
  equipmentName: string;
  cookedKg: number;
  totalLiters: number;
  averageBrix: number | null;
  averagePh: number | null;
  averageTemperature: number | null;
  currentBagasseKg: number | null;
  currentWaterLiters: number | null;
  currentPressPasses: number | null;
  dischargesCount: number;
  action: (formData: FormData) => Promise<void>;
};

export default function FinishMillingModal({
  lotCode,
  equipmentName,
  cookedKg,
  totalLiters,
  averageBrix,
  averagePh,
  averageTemperature,
  currentBagasseKg,
  currentWaterLiters,
  currentPressPasses,
  dischargesCount,
  action,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const hasDischarges = dischargesCount > 0;
  const hasRecoveredLiters = totalLiters > 0;
  const hasBrix = averageBrix !== null;
  const hasPh = averagePh !== null;
  const hasTemperature = averageTemperature !== null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full rounded-xl bg-green-500 px-6 py-4 text-lg font-bold text-black transition hover:bg-green-400"
      >
        Finalizar molienda
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
                    Acta de Cierre de Molienda
                  </h2>

                  <p className="mt-2 text-sm text-slate-400">
                    Confirma los resultados oficiales antes de cerrar el proceso.
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
                <SummaryCard title="Equipo" value={equipmentName} />
                <SummaryCard
                  title="Agave cocido"
                  value={`${formatNumber(cookedKg, 0)} kg`}
                />
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <h3 className="font-bold text-white">
                  Resumen actual de molienda
                </h3>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Mini title="Descargas" value={dischargesCount} />
                  <Mini
                    title="Mosto recuperado"
                    value={`${formatNumber(totalLiters)} L`}
                  />
                  <Mini
                    title="°Brix promedio"
                    value={
                      averageBrix !== null
                        ? formatNumber(averageBrix)
                        : "Sin registro"
                    }
                  />
                  <Mini
                    title="pH promedio"
                    value={
                      averagePh !== null
                        ? formatNumber(averagePh)
                        : "Sin registro"
                    }
                  />
                  <Mini
                    title="Temperatura promedio"
                    value={
                      averageTemperature !== null
                        ? `${formatNumber(averageTemperature)} °C`
                        : "Sin registro"
                    }
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">
                  Revisión de MAESTRO
                </p>

                <div className="mt-4 space-y-3">
                  <ValidationItem
                    valid={hasDischarges}
                    success="Existen descargas registradas."
                    warning="No existen descargas registradas."
                  />

                  <ValidationItem
                    valid={hasRecoveredLiters}
                    success="Existe volumen de mosto recuperado."
                    warning="No existe volumen de mosto recuperado."
                  />

                  <ValidationItem
                    valid={hasBrix}
                    success="Existe un promedio ponderado de °Brix."
                    warning="No existe una lectura válida de °Brix."
                  />

                  <ValidationItem
                    valid={hasPh}
                    success="Existe un promedio ponderado de pH."
                    warning="No existe una lectura válida de pH."
                  />

                  <ValidationItem
                    valid={hasTemperature}
                    success="Existe una temperatura promedio."
                    warning="No existe una lectura válida de temperatura."
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

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field
                      name="finalMashLiters"
                      label="Mosto recuperado final"
                      defaultValue={totalLiters}
                      step="0.01"
                      min="0"
                      suffix="L"
                      required
                    />

                    <Field
                      name="finalAverageBrix"
                      label="°Brix promedio final"
                      defaultValue={averageBrix ?? ""}
                      step="0.01"
                      min="0"
                      required
                    />

                    <Field
                      name="finalAveragePh"
                      label="pH promedio final"
                      defaultValue={averagePh ?? ""}
                      step="0.01"
                      min="0"
                      max="14"
                      required
                    />

                    <Field
                      name="finalAverageTemp"
                      label="Temperatura promedio"
                      defaultValue={averageTemperature ?? ""}
                      step="0.01"
                      min="0"
                      suffix="°C"
                      required
                    />

                    <Field
                      name="finalBagasseKg"
                      label="Bagazo final"
                      defaultValue={currentBagasseKg ?? ""}
                      step="0.01"
                      min="0"
                      suffix="kg"
                    />

                    <Field
                      name="finalWaterLiters"
                      label="Agua agregada"
                      defaultValue={currentWaterLiters ?? ""}
                      step="0.01"
                      min="0"
                      suffix="L"
                    />

                    <Field
                      name="finalPressPasses"
                      label="Pasadas de prensa"
                      defaultValue={currentPressPasses ?? ""}
                      step="1"
                      min="0"
                    />
                  </div>

                  <label className="mt-5 block">
                    <span className="mb-2 block text-sm font-medium text-slate-300">
                      Observaciones finales
                    </span>

                    <textarea
                      name="finalNotes"
                      rows={4}
                      placeholder="Describe rendimiento, humedad del bagazo, comportamiento de la prensa o cualquier detalle importante."
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
                    descargas ni eventos de molienda.
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
                    Confirmar y cerrar molienda
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
            suffix ? "pr-14" : ""
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