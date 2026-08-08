"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SearchIcon } from "@/components/ui/icons";

export type BottlingCard = {
  id: string;
  code: string;
  status: string;
  productName: string;
  productIcon: string | null;
  recipeName: string;
  actualLiters: number | null;
  bottlingsCount: number;
  latest: {
    code: string;
    status: string;
    bottleSizeMl: number;
    plannedBottles: number | null;
    producedBottles: number;
    rejectedBottles: number;
  } | null;
};

const STATUS_FILTERS = [
  { key: "TODOS", label: "Todos" },
  { key: "LISTO_PARA_EMBOTELLAR", label: "Listos" },
  { key: "EMBOTELLANDO", label: "Embotellando" },
  { key: "TERMINADO", label: "Terminados" },
] as const;

export default function BottlingList({
  batches,
}: {
  batches: BottlingCard[];
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("TODOS");

  /*
   * Antes esto era una sola lista larga con todos los lotes. Con
   * varios lotes en curso, encontrar uno concreto obligaba a
   * recorrer la página entera; el buscador ataca código de lote,
   * producto y receta, que es como la gente los nombra en planta.
   */
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return batches.filter((batch) => {
      if (status !== "TODOS" && batch.status !== status) {
        return false;
      }

      if (!term) {
        return true;
      }

      return (
        batch.code.toLowerCase().includes(term) ||
        batch.productName.toLowerCase().includes(term) ||
        batch.recipeName.toLowerCase().includes(term) ||
        (batch.latest?.code.toLowerCase().includes(term) ?? false)
      );
    });
  }, [batches, search, status]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();

    for (const batch of batches) {
      map.set(batch.status, (map.get(batch.status) ?? 0) + 1);
    }

    return map;
  }, [batches]);

  return (
    <>
      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative flex w-full items-center lg:max-w-sm">
          <SearchIcon className="pointer-events-none absolute left-4 h-4 w-4 text-outline" />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por lote, producto o receta..."
            className="w-full rounded-2xl border border-outline-variant bg-surface-container py-3 pl-11 pr-4 text-sm text-on-surface outline-none transition focus:border-primary"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => {
            const count =
              filter.key === "TODOS"
                ? batches.length
                : (counts.get(filter.key) ?? 0);

            const isActive = status === filter.key;

            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setStatus(filter.key)}
                className={`rounded-full border px-4 py-2 text-sm font-bold transition duration-150 ease-out ${
                  isActive
                    ? "border-transparent bg-on-surface text-surface"
                    : "border-outline-variant bg-surface-container text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {filter.label}
                <span className="ml-2 opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-8 rounded-3xl border border-dashed border-outline-variant bg-surface-container/50 p-8 text-center text-on-surface-variant">
          Ningún lote coincide con la búsqueda.
        </p>
      ) : (
        <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((batch) => (
            <article
              key={batch.id}
              className="rounded-3xl border border-outline-variant bg-surface-container/70 p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-outline-variant bg-surface-container-high text-3xl">
                  {batch.productIcon ?? "🍾"}
                </div>

                <span
                  className={`rounded-full border px-3 py-1 text-xs font-black ${getBatchStatusStyle(
                    batch.status
                  )}`}
                >
                  {formatStatus(batch.status)}
                </span>
              </div>

              <h2 className="mt-5 text-xl font-black text-on-surface">
                {batch.productName}
              </h2>

              <p className="mt-2 font-mono text-sm font-bold text-on-surface-variant">
                {batch.code}
              </p>

              <div className="mt-5 grid gap-3">
                <InfoRow label="Receta" value={batch.recipeName} />

                <InfoRow
                  label="Litros finales"
                  value={
                    batch.actualLiters !== null
                      ? `${formatNumber(batch.actualLiters)} L`
                      : "No registrados"
                  }
                />

                <InfoRow
                  label="Embotellados"
                  value={String(batch.bottlingsCount)}
                />
              </div>

              {batch.latest ? (
                <section className="mt-5 rounded-2xl border border-outline-variant bg-surface-dim/40 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-xs font-black uppercase tracking-[0.18em] text-outline">
                      Último embotellado
                    </p>

                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-black ${getBottlingStatusStyle(
                        batch.latest.status
                      )}`}
                    >
                      {formatStatus(batch.latest.status)}
                    </span>
                  </div>

                  <p className="mt-3 font-mono text-sm font-bold text-on-surface">
                    {batch.latest.code}
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-outline">Presentación</p>
                      <p className="mt-1 font-black text-on-surface">
                        {formatBottleSize(batch.latest.bottleSizeMl)}
                      </p>
                    </div>

                    <div>
                      <p className="text-outline">Producidas</p>
                      <p className="mt-1 font-black text-on-surface">
                        {batch.latest.producedBottles}
                      </p>
                    </div>

                    <div>
                      <p className="text-outline">Planeadas</p>
                      <p className="mt-1 font-black text-on-surface">
                        {batch.latest.plannedBottles ?? "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-outline">Rechazadas</p>
                      <p className="mt-1 font-black text-on-surface">
                        {batch.latest.rejectedBottles}
                      </p>
                    </div>
                  </div>
                </section>
              ) : (
                <section className="mt-5 rounded-2xl border border-dashed border-outline-variant bg-background/30 p-4">
                  <p className="text-sm text-outline">
                    Este lote todavía no tiene un embotellado registrado.
                  </p>
                </section>
              )}

              <Link
                href={`/liquors/batches/${batch.id}/bottling`}
                className="mt-6 flex justify-center rounded-2xl bg-primary px-5 py-3 font-black text-on-surface transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
              >
                {getActionLabel(batch.status, batch.latest?.status)}
              </Link>

              <Link
                href={`/liquors/batches/${batch.id}`}
                className="mt-3 flex justify-center rounded-2xl border border-outline-variant px-5 py-3 font-black text-on-surface-variant transition hover:border-outline-variant hover:text-on-surface"
              >
                Ver lote
              </Link>
            </article>
          ))}
        </section>
      )}
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-outline-variant pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-outline">{label}</span>

      <span className="text-right text-sm font-black text-on-surface">
        {value}
      </span>
    </div>
  );
}

function getActionLabel(batchStatus: string, bottlingStatus?: string) {
  if (bottlingStatus === "ACTIVO") {
    return "Continuar embotellado";
  }

  if (bottlingStatus === "TERMINADO") {
    return "Ver embotellado";
  }

  if (batchStatus === "EMBOTELLANDO") {
    return "Continuar embotellado";
  }

  return "Iniciar embotellado";
}

function getBatchStatusStyle(status: string) {
  switch (status) {
    case "LISTO_PARA_EMBOTELLAR":
      return "border-tertiary-fixed-dim/30 bg-tertiary-fixed-dim/10 text-tertiary-fixed-dim";

    case "EMBOTELLANDO":
      return "border-secondary/30 bg-secondary/10 text-secondary";

    case "TERMINADO":
      return "border-on-surface-variant/30 bg-on-surface-variant/10 text-on-surface-variant";

    default:
      return "border-outline-variant bg-surface-container-high text-on-surface-variant";
  }
}

function getBottlingStatusStyle(status: string) {
  switch (status) {
    case "PLANEADO":
      return "border-outline-variant bg-surface-container-high text-on-surface-variant";

    case "ACTIVO":
      return "border-secondary/30 bg-secondary/10 text-secondary";

    case "TERMINADO":
      return "border-tertiary-fixed-dim/30 bg-tertiary-fixed-dim/10 text-tertiary-fixed-dim";

    case "CANCELADO":
      return "border-error/30 bg-error/10 text-error";

    default:
      return "border-outline-variant bg-surface-container-high text-on-surface-variant";
  }
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatBottleSize(sizeMl: number) {
  if (sizeMl >= 1000) {
    const liters = sizeMl / 1000;

    return `${formatNumber(liters)} ${liters === 1 ? "litro" : "litros"}`;
  }

  return `${sizeMl} ml`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 2,
  }).format(value);
}
