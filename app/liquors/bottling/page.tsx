import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { BottleIcon } from "@/components/ui/icons";

export default async function LiquorBottlingPage() {
  const batches = await prisma.liquorBatch.findMany({
    where: {
      status: {
        in: [
          "LISTO_PARA_EMBOTELLAR",
          "EMBOTELLANDO",
          "TERMINADO",
        ],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      product: true,
      recipe: true,
      bottlings: {
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          code: true,
          status: true,
          bottleSizeMl: true,
          plannedBottles: true,
          producedBottles: true,
          rejectedBottles: true,
          startedAt: true,
          finishedAt: true,
        },
      },
    },
  });

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <header>
        <p className="font-mono text-sm font-black uppercase tracking-[0.2em] text-on-surface-variant">
          Elaboración de licores
        </p>

        <h1 className="mt-2 text-3xl font-black text-on-surface">
          Embotellado
        </h1>

        <p className="mt-2 max-w-3xl text-on-surface-variant">
          Selecciona un lote listo para iniciar o continuar su proceso de
          embotellado.
        </p>
      </header>

      {batches.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-dashed border-outline-variant bg-surface-container/50 p-10 text-center">
          <BottleIcon className="mx-auto h-10 w-10 text-on-surface-variant" />

          <h2 className="mt-5 text-2xl font-black text-on-surface">
            No hay lotes disponibles para embotellar
          </h2>

          <p className="mx-auto mt-3 max-w-xl text-on-surface-variant">
            Los lotes aparecerán aquí cuando estén listos para
            embotellado.
          </p>

          <Link
            href="/liquors/production"
            className="mt-6 inline-flex rounded-2xl bg-primary px-5 py-3 font-black text-on-surface transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
          >
            Ver producción
          </Link>
        </section>
      ) : (
        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {batches.map((batch) => {
            const latestBottling = batch.bottlings[0];

            return (
              <article
                key={batch.id}
                className="rounded-3xl border border-outline-variant bg-surface-container/70 p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-outline-variant bg-surface-container-high text-3xl">
                    {batch.product.icon ?? "🍾"}
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
                  {batch.product.name}
                </h2>

                <p className="mt-2 font-mono text-sm font-bold text-on-surface-variant">
                  {batch.code}
                </p>

                <div className="mt-5 grid gap-3">
                  <InfoRow
                    label="Receta"
                    value={batch.recipe.name}
                  />

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
                    value={String(batch.bottlings.length)}
                  />
                </div>

                {latestBottling ? (
                  <section className="mt-5 rounded-2xl border border-outline-variant bg-surface-dim/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-xs font-black uppercase tracking-[0.18em] text-outline">
                        Último embotellado
                      </p>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-black ${getBottlingStatusStyle(
                          latestBottling.status
                        )}`}
                      >
                        {formatStatus(latestBottling.status)}
                      </span>
                    </div>

                    <p className="mt-3 font-mono text-sm font-bold text-on-surface">
                      {latestBottling.code}
                    </p>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-outline">Presentación</p>
                        <p className="mt-1 font-black text-on-surface">
                          {formatBottleSize(
                            latestBottling.bottleSizeMl
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-outline">Producidas</p>
                        <p className="mt-1 font-black text-on-surface">
                          {latestBottling.producedBottles}
                        </p>
                      </div>

                      <div>
                        <p className="text-outline">Planeadas</p>
                        <p className="mt-1 font-black text-on-surface">
                          {latestBottling.plannedBottles ?? "—"}
                        </p>
                      </div>

                      <div>
                        <p className="text-outline">Rechazadas</p>
                        <p className="mt-1 font-black text-on-surface">
                          {latestBottling.rejectedBottles}
                        </p>
                      </div>
                    </div>
                  </section>
                ) : (
                  <section className="mt-5 rounded-2xl border border-dashed border-outline-variant bg-background/30 p-4">
                    <p className="text-sm text-outline">
                      Este lote todavía no tiene un embotellado
                      registrado.
                    </p>
                  </section>
                )}

                <Link
                  href={`/liquors/batches/${batch.id}/bottling`}
                  className="mt-6 flex justify-center rounded-2xl bg-primary px-5 py-3 font-black text-on-surface transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
                >
                  {getActionLabel(batch.status, latestBottling?.status)}
                </Link>

                <Link
                  href={`/liquors/batches/${batch.id}`}
                  className="mt-3 flex justify-center rounded-2xl border border-outline-variant px-5 py-3 font-black text-on-surface-variant transition hover:border-outline-variant hover:text-on-surface"
                >
                  Ver lote
                </Link>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-outline-variant pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-outline">{label}</span>

      <span className="text-right text-sm font-black text-on-surface">
        {value}
      </span>
    </div>
  );
}

function getActionLabel(
  batchStatus: string,
  bottlingStatus?: string
) {
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

    return `${formatNumber(liters)} ${
      liters === 1 ? "litro" : "litros"
    }`;
  }

  return `${sizeMl} ml`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 2,
  }).format(value);
}