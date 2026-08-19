"use client";

import { useState } from "react";
import { XIcon, CheckIcon, AlertIcon } from "@/components/ui/icons";

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
        className="w-full rounded-xl bg-tertiary-fixed-dim px-6 py-4 text-lg font-bold text-on-primary transition hover:opacity-90"
      >
        Finalizar molienda
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-dim/80 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-outline-variant bg-background shadow-xl">
            <header className="border-b border-outline-variant p-4 sm:p-5">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-outline">
                    MAESTRO
                  </p>

                  <h2 className="mt-3 text-2xl font-bold text-on-surface sm:text-3xl">
                    Acta de Cierre de Molienda
                  </h2>

                  <p className="mt-2 text-sm text-on-surface-variant">
                    Confirma los resultados oficiales antes de cerrar el proceso.
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
                <SummaryCard title="Equipo" value={equipmentName} />
                <SummaryCard
                  title="Agave cocido"
                  value={`${formatNumber(cookedKg, 0)} kg`}
                />
              </section>

              <section className="rounded-2xl border border-outline-variant bg-surface-container p-5">
                <h3 className="font-bold text-on-surface">
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

              <section className="rounded-2xl border border-outline-variant bg-surface-container p-5">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-outline">
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
                <section className="rounded-2xl border border-outline-variant bg-surface-container p-5">
                  <h3 className="text-lg font-bold text-on-surface">
                    Resultados oficiales del cierre
                  </h3>

                  <p className="mt-1 text-sm text-on-surface-variant">
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
                    <span className="mb-2 block text-sm font-semibold text-on-surface-variant">
                      Observaciones finales
                    </span>

                    <textarea
                      name="finalNotes"
                      rows={4}
                      placeholder="Describe rendimiento, humedad del bagazo, comportamiento de la prensa o cualquier detalle importante."
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
                    descargas ni eventos de molienda.
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
