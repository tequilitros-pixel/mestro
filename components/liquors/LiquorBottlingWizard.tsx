"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createLiquorBottlingAction } from "@/app/actions/liquorBottling";
import { finishLiquorBatchWithRemainderAction } from "@/app/actions/finishLiquorBatch";

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
      <section className="mt-6 overflow-hidden rounded-3xl border border-green-500/30 bg-slate-900">
        <div className="bg-gradient-to-br from-green-500/20 via-emerald-500/10 to-slate-900 p-6 sm:p-10">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-green-400/30 bg-green-500/15 text-4xl">
              ✅
            </div>

            <p className="mt-6 text-sm font-black uppercase tracking-[0.3em] text-green-300">
              Embotellado terminado
            </p>

            <h2 className="mt-3 text-4xl font-black text-white sm:text-5xl">
              Botellas generadas correctamente
            </h2>

            <p className="mt-4 font-mono text-sm font-bold text-green-300 sm:text-base">
              {success.bottlingCode}
            </p>

            <p className="mx-auto mt-4 max-w-2xl text-slate-300">
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

          <div className="mx-auto mt-8 max-w-4xl rounded-3xl border border-slate-700/80 bg-slate-950/50 p-6">
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
              className="flex-1 rounded-2xl border border-slate-700 px-5 py-4 text-center font-black text-slate-200 transition hover:bg-slate-800"
            >
              Volver al lote
            </Link>

            {success.remainingLiters > 0.0001 && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 rounded-2xl bg-purple-600 px-5 py-4 font-black text-white transition hover:bg-purple-500"
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
    <section className="mt-6 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">
      <div className="border-b border-slate-800 p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-purple-400">
              Paso {step} de 3
            </p>

            <h2 className="mt-3 text-3xl font-black text-white">
              {step === 1 && "Selecciona la presentación"}
              {step === 2 && "Registra el resultado"}
              {step === 3 && "Confirma el embotellado"}
            </h2>
          </div>

          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/10 px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-purple-300/70">
              Litros disponibles
            </p>

            <p className="mt-1 text-3xl font-black text-white">
              {formatNumber(availableLiters, 3)} L
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2">
          {[1, 2, 3].map((number) => (
            <div
              key={number}
              className={`h-2 rounded-full ${
                number <= step ? "bg-purple-500" : "bg-slate-800"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="p-6 sm:p-8">
        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
            <p className="text-sm font-black uppercase tracking-wider text-red-300">
              No se pudo generar el embotellado
            </p>

            <p className="mt-2 text-sm font-semibold text-red-100">
              {error}
            </p>
          </div>
        )}

        {step === 1 && (
          <>
            <p className="text-slate-400">
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
                        ? "border-purple-400 bg-purple-500/15"
                        : "border-slate-800 bg-slate-950/40 hover:border-purple-500/50 hover:bg-purple-500/10"
                    }`}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-2xl">
                      🍾
                    </div>

                    <p className="mt-5 text-2xl font-black text-white">
                      {size.label}
                    </p>

                    <div className="mt-5 space-y-3 border-t border-slate-800 pt-4">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-slate-500">
                          Botellas posibles
                        </p>

                        <p className="mt-1 text-xl font-black text-purple-300">
                          {formatNumber(bottles, 0)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-wider text-slate-500">
                          Sobrante
                        </p>

                        <p className="mt-1 font-bold text-slate-300">
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
              className="mt-8 w-full rounded-2xl bg-purple-600 py-4 text-lg font-black text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
            >
              Continuar →
            </button>
          </>
        )}

        {step === 2 && bottleSizeMl && (
          <>
            <div className="rounded-2xl border border-purple-500/20 bg-purple-500/10 p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-purple-300">
                Presentación seleccionada
              </p>

              <p className="mt-2 text-3xl font-black text-white">
                🍾 {selectedSize?.label}
              </p>

              <p className="mt-2 text-sm text-purple-100/70">
                Capacidad máxima estimada: {possibleBottles} botellas
              </p>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-bold text-slate-300">
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
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-2xl font-black text-white outline-none transition focus:border-purple-500"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-300">
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
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-2xl font-black text-white outline-none transition focus:border-purple-500"
                />
              </label>
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-bold text-slate-300">
                Observaciones
              </span>

              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                placeholder="Describe incidencias, mermas o detalles del embotellado..."
                className="mt-2 w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-white outline-none transition placeholder:text-slate-600 focus:border-purple-500"
              />
            </label>

            {(exceedsAvailableLiters ||
              exceedsPossibleBottles ||
              rejectedExceedsFilled ||
              (filled > 0 && acceptedBottles <= 0)) && (
              <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-semibold text-red-200">
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
  <div className="mt-6 rounded-3xl border border-amber-500/30 bg-amber-500/10 p-6">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-sm font-black uppercase tracking-[0.25em] text-amber-300">
          Remanente final
        </p>

        <h3 className="mt-3 text-2xl font-black text-white">
          No alcanza para llenar una botella de{" "}
          {selectedSize?.label}
        </h3>

        <p className="mt-3 max-w-2xl text-amber-100/70">
          Quedan {formatNumber(availableLiters, 3)} L. Puedes
          cambiar a una presentación más pequeña o finalizar el
          lote registrando este volumen como remanente.
        </p>
      </div>

      <button
        type="button"
        disabled={isFinishing}
        onClick={finishBatchWithRemainder}
        className="shrink-0 rounded-2xl bg-amber-500 px-6 py-4 font-black text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
      >
        {isFinishing
          ? "⏳ Finalizando lote..."
          : "✓ Finalizar con remanente"}
      </button>
    </div>
  </div>
)}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={returnToSizes}
                className="flex-1 rounded-2xl border border-slate-700 py-4 font-black text-slate-300 transition hover:bg-slate-800"
              >
                ← Cambiar presentación
              </button>

              <button
                type="button"
                disabled={!canContinueToConfirmation}
                onClick={goToConfirmation}
                className="flex-1 rounded-2xl bg-purple-600 py-4 text-lg font-black text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
              >
                Revisar embotellado →
              </button>
            </div>
          </>
        )}

        {step === 3 && bottleSizeMl && (
          <>
            <div className="rounded-3xl border border-green-500/25 bg-green-500/10 p-6">
              <p className="text-sm font-black uppercase tracking-[0.25em] text-green-300">
                Resumen final
              </p>

              <h3 className="mt-3 text-3xl font-black text-white">
                Confirma los datos antes de generar las botellas
              </h3>

              <p className="mt-3 text-green-100/70">
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
              <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Observaciones
                </p>

                <p className="mt-2 whitespace-pre-wrap text-slate-300">
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
                className="flex-1 rounded-2xl border border-slate-700 py-4 font-black text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ← Corregir datos
              </button>

              <button
                type="button"
                disabled={isPending || !canContinueToConfirmation}
                onClick={generateBottles}
                className="flex-[2] rounded-2xl bg-green-600 py-4 text-lg font-black text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {isPending
                  ? "⏳ Generando botellas..."
                  : `🍾 Confirmar y generar ${acceptedBottles} botellas`}
              </button>
            </div>

            <p className="mt-4 text-center text-xs text-slate-500">
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
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>

      <p className="mt-3 text-2xl font-black text-white">{value}</p>
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
    <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-5 text-center">
      <p className="text-xs font-bold uppercase tracking-wider text-green-300/70">
        {title}
      </p>

      <p className="mt-3 text-3xl font-black text-white">{value}</p>
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
      <span className="text-sm text-slate-400">{label}</span>
      <span className="font-black text-white">{value}</span>
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