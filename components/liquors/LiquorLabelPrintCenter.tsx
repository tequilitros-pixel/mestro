"use client";

import { useRouter } from "next/navigation";
import { useState, ComponentType } from "react";
import {
  TagIcon,
  HashIcon,
  ArrowsRangeIcon,
  CheckIcon,
  type IconProps,
} from "@/components/ui/icons";

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
          icon={TagIcon}
          title="Todas"
          description={`Preparar las ${totalBottles} etiquetas del embotellado.`}
          onClick={() => {
            setMode("ALL");
            setError("");
          }}
        />

        <ModeCard
          active={mode === "QUANTITY"}
          icon={HashIcon}
          title="Una cantidad"
          description="Escribe cuántas etiquetas deseas preparar."
          onClick={() => {
            setMode("QUANTITY");
            setError("");
          }}
        />

        <ModeCard
          active={mode === "RANGE"}
          icon={ArrowsRangeIcon}
          title="Un rango"
          description="Selecciona desde qué botella hasta cuál."
          onClick={() => {
            setMode("RANGE");
            setError("");
          }}
        />
      </div>

      <div className="mt-6 rounded-3xl border border-outline-variant bg-surface-container p-6 sm:p-8">
        {mode === "ALL" && (
          <div>
            <p className="font-mono text-sm font-black uppercase tracking-[0.25em] text-outline">
              Imprimir todas
            </p>

            <h2 className="mt-3 text-3xl font-black text-on-surface">
              {totalBottles} etiquetas
            </h2>

            <p className="mt-3 text-on-surface-variant">
              Se preparará una etiqueta para cada botella registrada
              en este embotellado.
            </p>
          </div>
        )}

        {mode === "QUANTITY" && (
          <div>
            <p className="font-mono text-sm font-black uppercase tracking-[0.25em] text-outline">
              Cantidad de etiquetas
            </p>

            <label className="mt-6 block">
              <span className="text-sm font-semibold text-on-surface-variant">
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
                className="mt-3 w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
              />
            </label>

            <p className="mt-3 text-sm text-outline">
              Máximo disponible: {totalBottles}
            </p>
          </div>
        )}

        {mode === "RANGE" && (
          <div>
            <p className="font-mono text-sm font-black uppercase tracking-[0.25em] text-outline">
              Rango de botellas
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label>
                <span className="text-sm font-semibold text-on-surface-variant">
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
                  className="mt-3 w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                />
              </label>

              <label>
                <span className="text-sm font-semibold text-on-surface-variant">
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
                  className="mt-3 w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                />
              </label>
            </div>

            <p className="mt-3 text-sm text-outline">
              Rango permitido: 1 a {totalBottles}
            </p>
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/[0.06] p-5">
          <p className="font-mono text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">
            Selección actual
          </p>

          <p className="mt-2 text-3xl font-black text-primary">
            {selectedQuantity} etiquetas
          </p>

          {mode === "RANGE" && (
            <p className="mt-2 text-sm font-semibold text-on-surface-variant">
              Botellas {fromBottle} a {toBottle}
            </p>
          )}
        </div>

        {error && (
          <div className="mt-5 rounded-2xl border border-error/30 bg-error/10 p-4 text-sm font-bold text-error">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={continueToPreview}
          disabled={totalBottles === 0}
          className="mt-6 w-full rounded-2xl bg-tertiary-fixed-dim px-6 py-4 text-lg font-black text-on-surface transition duration-150 ease-out hover:scale-[1.02] hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-surface-container-highest disabled:text-on-surface-variant disabled:hover:scale-100"
        >
          Continuar a vista previa →
        </button>
      </div>
    </section>
  );
}

function ModeCard({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: ComponentType<IconProps>;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border p-6 text-left transition duration-150 ease-out hover:scale-[1.01] active:scale-[0.99] ${
        active
          ? "border-primary bg-primary/[0.06] shadow-lg shadow-primary/10"
          : "border-outline-variant bg-surface-container hover:border-outline"
      }`}
    >
      <Icon className="h-9 w-9 text-on-surface-variant" />

      <p className="mt-5 text-xl font-black text-on-surface">{title}</p>

      <p className="mt-2 text-sm leading-6 text-on-surface-variant">
        {description}
      </p>

      <div
        className={`mt-5 flex h-6 w-6 items-center justify-center rounded-full border ${
          active
            ? "border-primary bg-primary text-on-primary"
            : "border-outline-variant"
        }`}
      >
        {active && <CheckIcon className="h-3.5 w-3.5" />}
      </div>
    </button>
  );
}