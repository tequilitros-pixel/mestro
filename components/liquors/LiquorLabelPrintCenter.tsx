"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type PrintMode = "ALL" | "QUANTITY" | "RANGE";

type Props = {
  batchId: string;
  bottlingId: string;
  totalBottles: number;
};

export default function LiquorLabelPrintCenter({
  batchId,
  bottlingId,
  totalBottles,
}: Props) {
  const router = useRouter();

  const [mode, setMode] = useState<PrintMode>("QUANTITY");
  const [quantity, setQuantity] = useState(
    Math.min(totalBottles, 10)
  );
  const [fromBottle, setFromBottle] = useState(1);
  const [toBottle, setToBottle] = useState(
    Math.min(totalBottles, 10)
  );
  const [error, setError] = useState("");

  function continueToPreview() {
    setError("");

    if (totalBottles <= 0) {
      setError("Este embotellado no tiene botellas disponibles.");
      return;
    }

    let start = 1;
    let end = totalBottles;

    if (mode === "QUANTITY") {
      if (!Number.isInteger(quantity) || quantity < 1) {
        setError("La cantidad debe ser mayor a cero.");
        return;
      }

      if (quantity > totalBottles) {
        setError(
          `Solo existen ${totalBottles} botellas disponibles.`
        );
        return;
      }

      start = 1;
      end = quantity;
    }

    if (mode === "RANGE") {
      if (
        !Number.isInteger(fromBottle) ||
        !Number.isInteger(toBottle)
      ) {
        setError("El rango debe contener números enteros.");
        return;
      }

      if (fromBottle < 1) {
        setError("El rango debe comenzar en la botella 1 o mayor.");
        return;
      }

      if (toBottle > totalBottles) {
        setError(
          `El rango no puede superar las ${totalBottles} botellas.`
        );
        return;
      }

      if (fromBottle > toBottle) {
        setError(
          "La botella inicial no puede ser mayor que la final."
        );
        return;
      }

      start = fromBottle;
      end = toBottle;
    }

    const params = new URLSearchParams({
      mode,
      start: String(start),
      end: String(end),
    });

    router.push(
      `/liquors/batches/${batchId}/labels/${bottlingId}/preview?${params.toString()}`
    );
  }

  const selectedQuantity =
    mode === "ALL"
      ? totalBottles
      : mode === "QUANTITY"
        ? quantity
        : Math.max(0, toBottle - fromBottle + 1);

  return (
    <section className="mt-8">
      <div className="grid gap-4 lg:grid-cols-3">
        <ModeCard
          active={mode === "ALL"}
          icon="🏷️"
          title="Todas"
          description={`Preparar las ${totalBottles} etiquetas del embotellado.`}
          onClick={() => {
            setMode("ALL");
            setError("");
          }}
        />

        <ModeCard
          active={mode === "QUANTITY"}
          icon="🔢"
          title="Una cantidad"
          description="Escribe cuántas etiquetas deseas preparar."
          onClick={() => {
            setMode("QUANTITY");
            setError("");
          }}
        />

        <ModeCard
          active={mode === "RANGE"}
          icon="↔️"
          title="Un rango"
          description="Selecciona desde qué botella hasta cuál."
          onClick={() => {
            setMode("RANGE");
            setError("");
          }}
        />
      </div>

      <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
        {mode === "ALL" && (
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-purple-300">
              Imprimir todas
            </p>

            <h2 className="mt-3 text-3xl font-black text-white">
              {totalBottles} etiquetas
            </h2>

            <p className="mt-3 text-slate-400">
              Se preparará una etiqueta para cada botella registrada
              en este embotellado.
            </p>
          </div>
        )}

        {mode === "QUANTITY" && (
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-purple-300">
              Cantidad de etiquetas
            </p>

            <label className="mt-6 block">
              <span className="text-sm font-bold text-slate-300">
                ¿Cuántas deseas preparar?
              </span>

              <input
                type="number"
                min={1}
                max={totalBottles}
                value={quantity}
                onChange={(event) => {
                  setQuantity(Number(event.target.value));
                  setError("");
                }}
                className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950 px-5 py-4 text-2xl font-black text-white outline-none transition focus:border-purple-500"
              />
            </label>

            <p className="mt-3 text-sm text-slate-500">
              Máximo disponible: {totalBottles}
            </p>
          </div>
        )}

        {mode === "RANGE" && (
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-purple-300">
              Rango de botellas
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label>
                <span className="text-sm font-bold text-slate-300">
                  Desde
                </span>

                <input
                  type="number"
                  min={1}
                  max={totalBottles}
                  value={fromBottle}
                  onChange={(event) => {
                    setFromBottle(Number(event.target.value));
                    setError("");
                  }}
                  className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950 px-5 py-4 text-2xl font-black text-white outline-none transition focus:border-purple-500"
                />
              </label>

              <label>
                <span className="text-sm font-bold text-slate-300">
                  Hasta
                </span>

                <input
                  type="number"
                  min={1}
                  max={totalBottles}
                  value={toBottle}
                  onChange={(event) => {
                    setToBottle(Number(event.target.value));
                    setError("");
                  }}
                  className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950 px-5 py-4 text-2xl font-black text-white outline-none transition focus:border-purple-500"
                />
              </label>
            </div>

            <p className="mt-3 text-sm text-slate-500">
              Rango permitido: 1 a {totalBottles}
            </p>
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-purple-500/20 bg-purple-500/10 p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-purple-300/70">
            Selección actual
          </p>

          <p className="mt-2 text-3xl font-black text-white">
            {selectedQuantity} etiquetas
          </p>

          {mode === "RANGE" && (
            <p className="mt-2 text-sm font-semibold text-purple-200">
              Botellas {fromBottle} a {toBottle}
            </p>
          )}
        </div>

        {error && (
          <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-300">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={continueToPreview}
          disabled={totalBottles === 0}
          className="mt-6 w-full rounded-2xl bg-green-600 px-6 py-4 text-lg font-black text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          Continuar a vista previa →
        </button>
      </div>
    </section>
  );
}

function ModeCard({
  active,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border p-6 text-left transition ${
        active
          ? "border-purple-400 bg-purple-500/15 shadow-lg shadow-purple-950/20"
          : "border-slate-800 bg-slate-900 hover:border-slate-700"
      }`}
    >
      <span className="text-4xl">{icon}</span>

      <p className="mt-5 text-xl font-black text-white">{title}</p>

      <p className="mt-2 text-sm leading-6 text-slate-400">
        {description}
      </p>

      <div
        className={`mt-5 flex h-6 w-6 items-center justify-center rounded-full border ${
          active
            ? "border-purple-300 bg-purple-500 text-white"
            : "border-slate-600"
        }`}
      >
        {active && <span className="text-xs font-black">✓</span>}
      </div>
    </button>
  );
}