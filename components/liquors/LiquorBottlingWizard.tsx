"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createLiquorBottlingAction } from "@/app/actions/liquorBottling";
import { finishLiquorBatchWithRemainderAction } from "@/app/actions/finishLiquorBatch";
import { CheckIcon, BottleIcon } from "@/components/ui/icons";

type Props = {
  batchId: string;
  availableLiters: number;
};

type BottlingSuccess = {
  bottlingId: string;
  bottlingCode: string;
  producedBottles: number;
  rejectedBottles: number;
  litersUsed: number;
  lossLiters: number;
  remainingLiters: number;
};

const bottleSizes = [
  { value: 250, label: "250 ml" },
  { value: 500, label: "500 ml" },
  { value: 750, label: "750 ml" },
  { value: 1000, label: "1 litro" },
  { value: 2000, label: "2 litros" },
];

export default function LiquorBottlingWizard({
  batchId,
  availableLiters,
}: Props) {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [bottleSizeMl, setBottleSizeMl] = useState<number | null>(null);
  const [filledBottles, setFilledBottles] = useState("");
  const [rejectedBottles, setRejectedBottles] = useState("0");
  const [notes, setNotes] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<BottlingSuccess | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isFinishing, startFinishingTransition] = useTransition();

  const bottleLiters = bottleSizeMl ? bottleSizeMl / 1000 : 0;

  const possibleBottles = useMemo(() => {
    if (!bottleSizeMl || bottleLiters <= 0) {
      return 0;
    }

    return Math.floor((availableLiters + 0.000001) / bottleLiters);
  }, [availableLiters, bottleLiters, bottleSizeMl]);

  const filled = parsePositiveInteger(filledBottles);
  const rejected = parsePositiveInteger(rejectedBottles);
  const acceptedBottles = Math.max(filled - rejected, 0);

  const litersUsed = roundLiters(filled * bottleLiters);
  const rejectedLiters = roundLiters(rejected * bottleLiters);
  const remainingLiters = roundLiters(
    Math.max(availableLiters - litersUsed, 0)
  );

  const selectedSize = bottleSizes.find(
    (size) => size.value === bottleSizeMl
  );

  const exceedsAvailableLiters = litersUsed > availableLiters + 0.0001;
  const exceedsPossibleBottles = filled > possibleBottles;
  const rejectedExceedsFilled = rejected > filled;

  const canContinueToConfirmation =
    filled > 0 &&
    acceptedBottles > 0 &&
    !exceedsAvailableLiters &&
    !exceedsPossibleBottles &&
    !rejectedExceedsFilled;

  function selectBottleSize(size: number) {
    const maximumBottles = Math.floor(
      (availableLiters + 0.000001) / (size / 1000)
    );

    setBottleSizeMl(size);
    setFilledBottles(maximumBottles.toString());
    setRejectedBottles("0");
    setError(null);
  }

  function returnToSizes() {
    setStep(1);
    setBottleSizeMl(null);
    setFilledBottles("");
    setRejectedBottles("0");
    setNotes("");
    setError(null);
  }

  function goToConfirmation() {
    if (!canContinueToConfirmation) {
      return;
    }

    setError(null);
    setStep(3);
  }
function finishBatchWithRemainder() {
  if (isFinishing) {
    return;
  }

  const confirmed = window.confirm(
    `Se finalizará el lote con ${formatNumber(
      availableLiters,
      3
    )} L de remanente sin embotellar. ¿Deseas continuar?`
  );

  if (!confirmed) {
    return;
  }

  setError(null);

  startFinishingTransition(async () => {
    const result =
      await finishLiquorBatchWithRemainderAction({
        batchId,
        notes:
          notes.trim() ||
          "Remanente final sin embotellar.",
      });

    if (!result.success) {
      setError(result.error);
      return;
    }

    router.push(`/liquors/batches/${batchId}`);
    router.refresh();
  });
}
  function generateBottles() {
    if (
      !bottleSizeMl ||
      !canContinueToConfirmation ||
      isPending
    ) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await createLiquorBottlingAction({
        batchId,
        bottleSizeMl,
        filledBottles: filled,
        rejectedBottles: rejected,
        notes,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setSuccess({
        bottlingId: result.bottlingId,
        bottlingCode: result.bottlingCode,
        producedBottles: result.producedBottles,
        rejectedBottles: result.rejectedBottles,
        litersUsed: result.litersUsed,
        lossLiters: result.lossLiters,
        remainingLiters: result.remainingLiters,
      });

      router.refresh();
    });
  }

  if (success) {
    return (
      <section className="mt-6 overflow-hidden rounded-3xl border border-tertiary-fixed-dim/30 bg-surface-container">
        <div className="bg-gradient-to-br from-tertiary-fixed-dim/20 via-tertiary-fixed-dim/10 to-surface-container p-6 sm:p-10">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-tertiary-fixed-dim/30 bg-tertiary-fixed-dim/15">
              <CheckIcon className="h-9 w-9 text-tertiary-fixed-dim" />
            </div>

            <p className="mt-6 text-sm font-black uppercase tracking-[0.3em] text-tertiary-fixed-dim">
              Embotellado terminado
            </p>

            <h2 className="mt-3 text-4xl font-black text-on-surface sm:text-5xl">
              Botellas generadas correctamente
            </h2>

            <p className="mt-4 font-mono text-sm font-bold text-tertiary-fixed-dim sm:text-base">
              {success.bottlingCode}
            </p>

            <p className="mx-auto mt-4 max-w-2xl text-on-surface-variant">
              MAESTRO creó el registro de embotellado, las botellas
              individuales y un código QR único para cada botella.
            </p>
          </div>

          <div className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SuccessCard
              title="Botellas creadas"
              value={formatNumber(success.producedBottles, 0)}
            />

            <SuccessCard
              title="QR generados"
              value={formatNumber(success.producedBottles, 0)}
            />

            <SuccessCard
              title="Rechazadas"
              value={formatNumber(success.rejectedBottles, 0)}
            />

            <SuccessCard
              title="Litros restantes"
              value={`${formatNumber(success.remainingLiters, 3)} L`}
            />
          </div>

          <div className="mx-auto mt-8 max-w-4xl rounded-3xl border border-outline-variant/80 bg-background/50 p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <ResultRow
                label="Litros utilizados"
                value={`${formatNumber(success.litersUsed, 3)} L`}
              />

              <ResultRow
                label="Merma registrada"
                value={`${formatNumber(success.lossLiters, 3)} L`}
              />
            </div>
          </div>

          <div className="mx-auto mt-8 flex max-w-4xl flex-col gap-3 sm:flex-row">
            <Link
              href={`/liquors/batches/${batchId}`}
              className="flex-1 rounded-2xl border border-outline-variant px-5 py-4 text-center font-black text-on-surface transition hover:bg-surface-container-high"
            >
              Volver al lote
            </Link>

            {success.remainingLiters > 0.0001 && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 rounded-2xl bg-primary px-5 py-4 font-black text-on-surface transition hover:opacity-90"
              >
                Embotellar volumen restante →
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-outline-variant bg-surface-container">
      <div className="border-b border-outline-variant p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-sm font-black uppercase tracking-[0.3em] text-secondary">
              Paso {step} de 3
            </p>

            <h2 className="mt-3 text-3xl font-black text-on-surface">
              {step === 1 && "Selecciona la presentación"}
              {step === 2 && "Registra el resultado"}
              {step === 3 && "Confirma el embotellado"}
            </h2>
          </div>

          <div className="rounded-2xl border border-secondary/20 bg-secondary/10 px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-secondary/70">
              Litros disponibles
            </p>

            <p className="mt-1 text-3xl font-black text-on-surface">
              {formatNumber(availableLiters, 3)} L
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2">
          {[1, 2, 3].map((number) => (
            <div
              key={number}
              className={`h-2 rounded-full ${
                number <= step ? "bg-secondary" : "bg-surface-container-high"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="p-6 sm:p-8">
        {error && (
          <div className="mb-6 rounded-2xl border border-error/30 bg-error/10 p-5">
            <p className="text-sm font-black uppercase tracking-wider text-error">
              No se pudo generar el embotellado
            </p>

            <p className="mt-2 text-sm font-semibold text-error">
              {error}
            </p>
          </div>
        )}

        {step === 1 && (
          <>
            <p className="text-on-surface-variant">
              Elige el tamaño de botella que utilizarás en esta corrida.
            </p>

            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {bottleSizes.map((size) => {
                const litersPerBottle = size.value / 1000;
                const bottles = Math.floor(
                  (availableLiters + 0.000001) / litersPerBottle
                );
                const remaining = roundLiters(
                  Math.max(
                    availableLiters - bottles * litersPerBottle,
                    0
                  )
                );
                const selected = bottleSizeMl === size.value;

                return (
                  <button
                    key={size.value}
                    type="button"
                    onClick={() => selectBottleSize(size.value)}
                    className={`rounded-3xl border p-5 text-left transition ${
                      selected
                        ? "border-secondary bg-secondary/15"
                        : "border-outline-variant bg-surface-dim/40 hover:border-secondary/50 hover:opacity-90/10"
                    }`}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/10">
                      <BottleIcon className="h-6 w-6 text-secondary" />
                    </div>

                    <p className="mt-5 text-2xl font-black text-on-surface">
                      {size.label}
                    </p>

                    <div className="mt-5 space-y-3 border-t border-outline-variant pt-4">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-outline">
                          Botellas posibles
                        </p>

                        <p className="mt-1 text-xl font-black text-secondary">
                          {formatNumber(bottles, 0)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-wider text-outline">
                          Sobrante
                        </p>

                        <p className="mt-1 font-bold text-on-surface-variant">
                          {formatNumber(remaining, 3)} L
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={!bottleSizeMl}
              onClick={() => {
                setError(null);
                setStep(2);
              }}
              className="mt-8 w-full rounded-2xl bg-primary py-4 text-lg font-black text-on-surface transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-outline"
            >
              Continuar →
            </button>
          </>
        )}

        {step === 2 && bottleSizeMl && (
          <>
            <div className="rounded-2xl border border-secondary/20 bg-secondary/10 p-5">
              <p className="font-mono text-xs font-black uppercase tracking-[0.2em] text-secondary">
                Presentación seleccionada
              </p>

              <p className="mt-2 flex items-center gap-2 text-3xl font-black text-on-surface">
                <BottleIcon className="h-6 w-6 text-secondary" />
                {selectedSize?.label}
              </p>

              <p className="mt-2 text-sm text-secondary/70">
                Capacidad máxima estimada: {possibleBottles} botellas
              </p>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-on-surface-variant">
                  Botellas llenadas
                </span>

                <input
                  type="number"
                  min="0"
                  max={possibleBottles}
                  step="1"
                  value={filledBottles}
                  onChange={(event) => {
                    setFilledBottles(event.target.value);
                    setError(null);
                  }}
                  className="mt-2 w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-on-surface-variant">
                  Botellas rechazadas
                </span>

                <input
                  type="number"
                  min="0"
                  max={filled}
                  step="1"
                  value={rejectedBottles}
                  onChange={(event) => {
                    setRejectedBottles(event.target.value);
                    setError(null);
                  }}
                  className="mt-2 w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                />
              </label>
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-semibold text-on-surface-variant">
                Observaciones
              </span>

              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                placeholder="Describe incidencias, mermas o detalles del embotellado..."
                className="resize-none mt-2 w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
              />
            </label>

            {(exceedsAvailableLiters ||
              exceedsPossibleBottles ||
              rejectedExceedsFilled ||
              (filled > 0 && acceptedBottles <= 0)) && (
              <div className="mt-5 rounded-2xl border border-error/30 bg-error/10 p-4 text-sm font-semibold text-error">
                {exceedsAvailableLiters &&
                  "Los litros requeridos superan el volumen disponible."}

                {!exceedsAvailableLiters &&
                  exceedsPossibleBottles &&
                  "La cantidad supera las botellas posibles para este lote."}

                {!exceedsAvailableLiters &&
                  !exceedsPossibleBottles &&
                  rejectedExceedsFilled &&
                  "Las botellas rechazadas no pueden superar las llenadas."}

                {!exceedsAvailableLiters &&
                  !exceedsPossibleBottles &&
                  !rejectedExceedsFilled &&
                  filled > 0 &&
                  acceptedBottles <= 0 &&
                  "Debe quedar al menos una botella disponible."}
              </div>
            )}

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                title="Botellas disponibles"
                value={acceptedBottles.toString()}
              />

              <SummaryCard
                title="Litros utilizados"
                value={`${formatNumber(litersUsed, 3)} L`}
              />

              <SummaryCard
                title="Merma por rechazo"
                value={`${formatNumber(rejectedLiters, 3)} L`}
              />

              <SummaryCard
                title="Litros restantes"
                value={`${formatNumber(remainingLiters, 3)} L`}
              />
            </div>
            {possibleBottles === 0 && availableLiters > 0.0001 && (
  <div className="mt-6 rounded-3xl border border-secondary/30 bg-secondary/10 p-6">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="font-mono text-sm font-black uppercase tracking-[0.25em] text-secondary">
          Remanente final
        </p>

        <h3 className="mt-3 text-2xl font-black text-on-surface">
          No alcanza para llenar una botella de{" "}
          {selectedSize?.label}
        </h3>

        <p className="mt-3 max-w-2xl text-secondary/70">
          Quedan {formatNumber(availableLiters, 3)} L. Puedes
          cambiar a una presentación más pequeña o finalizar el
          lote registrando este volumen como remanente.
        </p>
      </div>

      <button
        type="button"
        disabled={isFinishing}
        onClick={finishBatchWithRemainder}
        className="flex shrink-0 items-center gap-2 rounded-2xl bg-primary px-6 py-4 font-black text-on-primary transition duration-150 ease-out hover:scale-[1.02] hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-surface-container-highest disabled:text-on-surface-variant disabled:hover:scale-100"
      >
        {isFinishing ? (
          "Finalizando lote..."
        ) : (
          <>
            <CheckIcon className="h-4 w-4" />
            Finalizar con remanente
          </>
        )}
      </button>
    </div>
  </div>
)}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={returnToSizes}
                className="flex-1 rounded-2xl border border-outline-variant py-4 font-black text-on-surface-variant transition hover:bg-surface-container-high"
              >
                ← Cambiar presentación
              </button>

              <button
                type="button"
                disabled={!canContinueToConfirmation}
                onClick={goToConfirmation}
                className="flex-1 rounded-2xl bg-primary py-4 text-lg font-black text-on-surface transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-outline"
              >
                Revisar embotellado →
              </button>
            </div>
          </>
        )}

        {step === 3 && bottleSizeMl && (
          <>
            <div className="rounded-3xl border border-tertiary-fixed-dim/25 bg-tertiary-fixed-dim/10 p-6">
              <p className="font-mono text-sm font-black uppercase tracking-[0.25em] text-tertiary-fixed-dim">
                Resumen final
              </p>

              <h3 className="mt-3 text-3xl font-black text-on-surface">
                Confirma los datos antes de generar las botellas
              </h3>

              <p className="mt-3 text-tertiary-fixed-dim/70">
                Esta acción guardará el embotellado y creará una identidad
                individual con QR para cada botella disponible.
              </p>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SummaryCard
                title="Presentación"
                value={selectedSize?.label ?? "—"}
              />

              <SummaryCard
                title="Botellas llenadas"
                value={filled.toString()}
              />

              <SummaryCard
                title="Botellas rechazadas"
                value={rejected.toString()}
              />

              <SummaryCard
                title="Botellas finales"
                value={acceptedBottles.toString()}
              />

              <SummaryCard
                title="Litros utilizados"
                value={`${formatNumber(litersUsed, 3)} L`}
              />

              <SummaryCard
                title="Litros restantes"
                value={`${formatNumber(remainingLiters, 3)} L`}
              />
            </div>

            {notes.trim() && (
              <div className="mt-5 rounded-2xl border border-outline-variant bg-surface-dim/40 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-outline">
                  Observaciones
                </p>

                <p className="mt-2 whitespace-pre-wrap text-on-surface-variant">
                  {notes}
                </p>
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setError(null);
                  setStep(2);
                }}
                className="flex-1 rounded-2xl border border-outline-variant py-4 font-black text-on-surface-variant transition hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
              >
                ← Corregir datos
              </button>

              <button
                type="button"
                disabled={isPending || !canContinueToConfirmation}
                onClick={generateBottles}
                className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-tertiary-fixed-dim py-4 text-lg font-black text-on-surface transition duration-150 ease-out hover:scale-[1.01] hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-surface-container-highest disabled:text-on-surface-variant disabled:hover:scale-100"
              >
                {isPending ? (
                  "Generando botellas..."
                ) : (
                  <>
                    <BottleIcon className="h-5 w-5" />
                    Confirmar y generar {acceptedBottles} botellas
                  </>
                )}
              </button>
            </div>

            <p className="mt-4 text-center text-xs text-outline">
              No cierres esta pantalla mientras MAESTRO genera las botellas.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-dim/40 p-5">
      <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-outline">
        {title}
      </p>

      <p className="mt-3 text-2xl font-black text-on-surface">{value}</p>
    </div>
  );
}

function SuccessCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-tertiary-fixed-dim/20 bg-tertiary-fixed-dim/10 p-5 text-center">
      <p className="text-xs font-bold uppercase tracking-wider text-tertiary-fixed-dim/70">
        {title}
      </p>

      <p className="mt-3 text-3xl font-black text-on-surface">{value}</p>
    </div>
  );
}

function ResultRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-on-surface-variant">{label}</span>
      <span className="font-black text-on-surface">{value}</span>
    </div>
  );
}

function parsePositiveInteger(value: string) {
  const parsed = Number.parseInt(value || "0", 10);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(parsed, 0);
}

function roundLiters(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function formatNumber(
  value: number | null | undefined,
  maximumFractionDigits = 2
) {
  if (value === null || value === undefined) {
    return "—";
  }

  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits,
  }).format(value);
}