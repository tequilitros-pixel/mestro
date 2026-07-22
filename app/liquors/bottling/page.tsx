import Link from "next/link";
import { prisma } from "@/lib/prisma";

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
        <p className="text-sm font-black uppercase tracking-[0.2em] text-purple-300">
          Elaboración de licores
        </p>

        <h1 className="mt-2 text-3xl font-black text-white">
          Embotellado
        </h1>

        <p className="mt-2 max-w-3xl text-slate-400">
          Selecciona un lote listo para iniciar o continuar su proceso de
          embotellado.
        </p>
      </header>

      {batches.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-dashed border-slate-700 bg-slate-900/50 p-10 text-center">
          <div className="text-5xl">🍾</div>

          <h2 className="mt-5 text-2xl font-black text-white">
            No hay lotes disponibles para embotellar
          </h2>

          <p className="mx-auto mt-3 max-w-xl text-slate-400">
            Los lotes aparecerán aquí cuando estén listos para
            embotellado.
          </p>

          <Link
            href="/liquors/production"
            className="mt-6 inline-flex rounded-2xl border border-purple-500/30 bg-purple-500/10 px-5 py-3 font-black text-purple-300 transition hover:bg-purple-500/15"
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
                className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-500/20 bg-purple-500/10 text-3xl">
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

                <h2 className="mt-5 text-xl font-black text-white">
                  {batch.product.name}
                </h2>

                <p className="mt-2 font-mono text-sm font-bold text-purple-300">
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
                  <section className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
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

                    <p className="mt-3 font-mono text-sm font-bold text-white">
                      {latestBottling.code}
                    </p>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-slate-500">Presentación</p>
                        <p className="mt-1 font-black text-white">
                          {formatBottleSize(
                            latestBottling.bottleSizeMl
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-slate-500">Producidas</p>
                        <p className="mt-1 font-black text-white">
                          {latestBottling.producedBottles}
                        </p>
                      </div>

                      <div>
                        <p className="text-slate-500">Planeadas</p>
                        <p className="mt-1 font-black text-white">
                          {latestBottling.plannedBottles ?? "—"}
                        </p>
                      </div>

                      <div>
                        <p className="text-slate-500">Rechazadas</p>
                        <p className="mt-1 font-black text-white">
                          {latestBottling.rejectedBottles}
                        </p>
                      </div>
                    </div>
                  </section>
                ) : (
                  <section className="mt-5 rounded-2xl border border-dashed border-slate-700 bg-slate-950/30 p-4">
                    <p className="text-sm text-slate-500">
                      Este lote todavía no tiene un embotellado
                      registrado.
                    </p>
                  </section>
                )}

                <Link
                  href={`/liquors/batches/${batch.id}/bottling`}
                  className="mt-6 flex justify-center rounded-2xl bg-purple-600 px-5 py-3 font-black text-white transition hover:bg-purple-500"
                >
                  {getActionLabel(batch.status, latestBottling?.status)}
                </Link>

                <Link
                  href={`/liquors/batches/${batch.id}`}
                  className="mt-3 flex justify-center rounded-2xl border border-slate-700 px-5 py-3 font-black text-slate-300 transition hover:border-slate-600 hover:text-white"
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
    <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-slate-500">{label}</span>

      <span className="text-right text-sm font-black text-white">
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
      return "border-green-500/30 bg-green-500/10 text-green-300";

    case "EMBOTELLANDO":
      return "border-purple-500/30 bg-purple-500/10 text-purple-300";

    case "TERMINADO":
      return "border-blue-500/30 bg-blue-500/10 text-blue-300";

    default:
      return "border-slate-700 bg-slate-800 text-slate-300";
  }
}

function getBottlingStatusStyle(status: string) {
  switch (status) {
    case "PLANEADO":
      return "border-slate-600 bg-slate-800 text-slate-300";

    case "ACTIVO":
      return "border-purple-500/30 bg-purple-500/10 text-purple-300";

    case "TERMINADO":
      return "border-green-500/30 bg-green-500/10 text-green-300";

    case "CANCELADO":
      return "border-red-500/30 bg-red-500/10 text-red-300";

    default:
      return "border-slate-700 bg-slate-800 text-slate-300";
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