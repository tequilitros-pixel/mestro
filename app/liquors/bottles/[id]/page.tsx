import Link from "next/link";
import { notFound } from "next/navigation";
import { LiquorBottleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function LiquorBottleDetailPage({
  params,
}: Props) {
  const { id } = await params;

  const bottle = await prisma.liquorBottle.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      code: true,
      serialNumber: true,
      qrToken: true,
      status: true,
      bottledAt: true,
      expirationDate: true,
      currentLocation: true,
      reservedAt: true,
      soldAt: true,
      removedAt: true,
      notes: true,
      createdAt: true,
      updatedAt: true,

      bottling: {
        select: {
          id: true,
          code: true,
          bottleSizeMl: true,
          bottledAt: true,
          producedBottles: true,
          rejectedBottles: true,

          batch: {
            select: {
              id: true,
              code: true,
              productionDate: true,
              expirationDate: true,
              plannedLiters: true,
              actualLiters: true,
              initialAlcohol: true,
              finalAlcohol: true,
              finalNotes: true,

              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  prefix: true,
                  icon: true,
                  description: true,
                  defaultAlcohol: true,
                },
              },

              recipe: {
                select: {
                  id: true,
                  name: true,
                  version: true,
                  targetAlcohol: true,
                },
              },
            },
          },
        },
      },

      movements: {
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          type: true,
          fromLocation: true,
          toLocation: true,
          notes: true,
          createdAt: true,
        },
      },
    },
  });

  if (!bottle) {
    notFound();
  }

  const batch = bottle.bottling.batch;
  const product = batch.product;
  const recipe = batch.recipe;

  const alcohol =
    batch.finalAlcohol ??
    batch.initialAlcohol ??
    recipe.targetAlcohol ??
    product.defaultAlcohol;

  const expirationDate =
    bottle.expirationDate ?? batch.expirationDate;

  const statusStyle = getStatusStyle(bottle.status);

  return (
    <section className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={`/liquors/inventory/${product.slug}?size=${bottle.bottling.bottleSizeMl}`}
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 transition hover:text-white"
        >
          ← Volver a las botellas
        </Link>

        <Link
          href="/liquors/inventory"
          className="text-sm font-bold text-purple-300 transition hover:text-purple-200"
        >
          Ver inventario general
        </Link>
      </div>

      <header className="mt-6 overflow-hidden rounded-3xl border border-purple-500/20 bg-slate-900">
        <div className="bg-gradient-to-br from-purple-500/20 via-fuchsia-500/10 to-slate-900 p-6 sm:p-8">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-5">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl border border-purple-400/20 bg-purple-500/10 text-5xl">
                {product.icon ?? "🍾"}
              </div>

              <div>
                <p className="text-sm font-black uppercase tracking-[0.32em] text-purple-300">
                  Botella individual
                </p>

                <h1 className="mt-3 break-all text-4xl font-black text-white sm:text-5xl">
                  {bottle.code}
                </h1>

                <p className="mt-3 text-xl font-bold text-purple-200">
                  {product.name}
                </p>

                <p className="mt-2 text-sm text-slate-400">
                  Serie #{formatSerialNumber(bottle.serialNumber)}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 lg:items-end">
              <span
                className={`rounded-full border px-4 py-2 text-sm font-black ${statusStyle}`}
              >
                {getStatusLabel(bottle.status)}
              </span>

              <p className="text-sm text-slate-500">
                Registro actualizado el {formatDateTime(bottle.updatedAt)}
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          title="Presentación"
          value={formatBottleSize(bottle.bottling.bottleSizeMl)}
          detail="Contenido nominal"
        />

        <Kpi
          title="Alcohol"
          value={
            alcohol !== null && alcohol !== undefined
              ? `${formatNumber(alcohol, 2)}%`
              : "—"
          }
          detail="Graduación alcohólica"
        />

        <Kpi
          title="Lote"
          value={batch.code}
          detail="Lote de producción"
        />

        <Kpi
          title="Ubicación"
          value={bottle.currentLocation ?? "Almacén principal"}
          detail="Ubicación actual"
        />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <article className="rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-purple-400">
            Trazabilidad
          </p>

          <h2 className="mt-3 text-3xl font-black text-white">
            Información de la botella
          </h2>

          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <DetailCard
              label="Producto"
              value={product.name}
            />

            <DetailCard
              label="Receta"
              value={`${recipe.name} · Versión ${recipe.version}`}
            />

            <DetailCard
              label="Código de lote"
              value={batch.code}
            />

            <DetailCard
              label="Código de embotellado"
              value={bottle.bottling.code}
            />

            <DetailCard
              label="Fecha de elaboración"
              value={formatDate(batch.productionDate)}
            />

            <DetailCard
              label="Fecha de embotellado"
              value={formatDate(bottle.bottledAt)}
            />

            <DetailCard
              label="Fecha de caducidad"
              value={formatDate(expirationDate)}
            />

            <DetailCard
              label="Estado"
              value={getStatusLabel(bottle.status)}
            />
          </div>

          <div className="mt-7 rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
              Notas de la botella
            </p>

            <p className="mt-3 whitespace-pre-wrap text-slate-300">
              {bottle.notes?.trim() || "Sin observaciones registradas."}
            </p>
          </div>
        </article>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-purple-500/25 bg-purple-500/10 p-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-purple-400/20 bg-purple-500/10 text-4xl">
              ▦
            </div>

            <p className="mt-5 text-sm font-black uppercase tracking-[0.25em] text-purple-300">
              Código QR
            </p>

            <h2 className="mt-3 text-2xl font-black text-white">
              Identidad digital
            </h2>

            <p className="mt-3 text-sm leading-6 text-purple-100/70">
              Abre el QR único de esta botella para consultar su
              trazabilidad o prepararlo para impresión.
            </p>

            <Link
              href={`/liquors/bottles/${bottle.id}/qr`}
              className="mt-6 block rounded-2xl bg-purple-600 px-5 py-4 text-center font-black text-white transition hover:bg-purple-500"
            >
              Ver código QR →
            </Link>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-slate-500">
              Etiqueta
            </p>

            <h2 className="mt-3 text-2xl font-black text-white">
              Preparar impresión
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              La etiqueta incluirá producto, lote, código corto,
              presentación, alcohol, caducidad y QR.
            </p>

            <Link
              href={`/liquors/bottles/${bottle.id}/label`}
              className="mt-6 block rounded-2xl border border-slate-700 px-5 py-4 text-center font-black text-slate-200 transition hover:border-purple-500 hover:bg-slate-800"
            >
              🏷 Ver etiqueta
            </Link>
          </section>
        </aside>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-purple-400">
              Historial
            </p>

            <h2 className="mt-2 text-3xl font-black text-white">
              Movimientos de la botella
            </h2>
          </div>

          <p className="text-sm text-slate-500">
            {bottle.movements.length} registros
          </p>
        </div>

        {bottle.movements.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-700 bg-slate-950/30 p-8 text-center">
            <p className="text-lg font-black text-white">
              Sin movimientos registrados
            </p>

            <p className="mt-2 text-sm text-slate-400">
              La botella permanece en su ubicación inicial.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {bottle.movements.map((movement) => (
              <article
                key={movement.id}
                className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-black text-white">
                      {formatMovementType(movement.type)}
                    </p>

                    {(movement.fromLocation ||
                      movement.toLocation) && (
                      <p className="mt-2 text-sm text-slate-400">
                        {movement.fromLocation ?? "Sin origen"}
                        {" → "}
                        {movement.toLocation ?? "Sin destino"}
                      </p>
                    )}

                    {movement.notes && (
                      <p className="mt-3 text-sm leading-6 text-slate-400">
                        {movement.notes}
                      </p>
                    )}
                  </div>

                  <p className="shrink-0 text-xs text-slate-500">
                    {formatDateTime(movement.createdAt)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function Kpi({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{title}</p>

      <p className="mt-2 break-words text-2xl font-black text-white">
        {value}
      </p>

      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function DetailCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>

      <p className="mt-3 break-words font-black text-white">
        {value}
      </p>
    </div>
  );
}

function getStatusLabel(status: LiquorBottleStatus) {
  switch (status) {
    case LiquorBottleStatus.DISPONIBLE:
      return "Disponible";

    case LiquorBottleStatus.RESERVADA:
      return "Reservada";

    case LiquorBottleStatus.VENDIDA:
      return "Vendida";

    case LiquorBottleStatus.MERMA:
      return "Merma";

    case LiquorBottleStatus.RETIRADA:
      return "Retirada";

    default:
      return status;
  }
}

function getStatusStyle(status: LiquorBottleStatus) {
  switch (status) {
    case LiquorBottleStatus.DISPONIBLE:
      return "border-green-500/30 bg-green-500/10 text-green-300";

    case LiquorBottleStatus.RESERVADA:
      return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";

    case LiquorBottleStatus.VENDIDA:
      return "border-blue-500/30 bg-blue-500/10 text-blue-300";

    case LiquorBottleStatus.MERMA:
      return "border-orange-500/30 bg-orange-500/10 text-orange-300";

    case LiquorBottleStatus.RETIRADA:
      return "border-red-500/30 bg-red-500/10 text-red-300";

    default:
      return "border-slate-600 bg-slate-800 text-slate-300";
  }
}

function formatMovementType(type: string) {
  return type
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatSerialNumber(value: number) {
  return value.toString().padStart(6, "0");
}

function formatBottleSize(sizeMl: number) {
  if (sizeMl >= 1000) {
    const liters = sizeMl / 1000;

    return `${formatNumber(liters, 2)} ${
      liters === 1 ? "litro" : "litros"
    }`;
  }

  return `${formatNumber(sizeMl, 0)} ml`;
}

function formatDate(value: Date | null) {
  if (!value) {
    return "No registrada";
  }

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Mexico_City",
  }).format(value);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(value);
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