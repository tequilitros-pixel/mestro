import { notFound } from "next/navigation";
import { LiquorBottleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Props = {
  params: Promise<{
    token: string;
  }>;
};

export default async function PublicBottleTracePage({
  params,
}: Props) {
  const { token } = await params;

  const bottle = await prisma.liquorBottle.findUnique({
    where: {
      qrToken: token,
    },
    select: {
      code: true,
      serialNumber: true,
      status: true,
      bottledAt: true,
      expirationDate: true,
      currentLocation: true,

      bottling: {
        select: {
          bottleSizeMl: true,

          batch: {
            select: {
              code: true,
              productionDate: true,
              expirationDate: true,
              finalAlcohol: true,
              initialAlcohol: true,

              product: {
                select: {
                  name: true,
                  icon: true,
                  description: true,
                  defaultAlcohol: true,
                },
              },

              recipe: {
                select: {
                  targetAlcohol: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!bottle) {
    notFound();
  }

  const batch = bottle.bottling.batch;
  const product = batch.product;

  const alcohol =
    batch.finalAlcohol ??
    batch.initialAlcohol ??
    batch.recipe.targetAlcohol ??
    product.defaultAlcohol;

  const expirationDate =
    bottle.expirationDate ?? batch.expirationDate;

  const statusStyle = getPublicStatusStyle(bottle.status);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6">
      <section className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-purple-500/25 bg-slate-900 shadow-2xl shadow-purple-950/30">
        <header className="bg-gradient-to-br from-purple-500/20 via-fuchsia-500/10 to-slate-900 p-6 text-center sm:p-10">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-purple-400/20 bg-purple-500/10 text-5xl">
            {product.icon ?? "🍾"}
          </div>

          <p className="mt-6 text-sm font-black uppercase tracking-[0.3em] text-purple-300">
            Casa Destiladora del Norte
          </p>

          <h1 className="mt-3 text-4xl font-black sm:text-5xl">
            {product.name}
          </h1>

          <p className="mt-3 font-mono text-xl font-black text-purple-200">
            {bottle.code}
          </p>

          <div className="mt-5">
            <span
              className={`inline-flex rounded-full border px-4 py-2 text-sm font-black ${statusStyle}`}
            >
              {getPublicStatusLabel(bottle.status)}
            </span>
          </div>
        </header>

        <div className="p-6 sm:p-8">
          <section className="rounded-3xl border border-green-500/25 bg-green-500/10 p-6 text-center">
            <div className="text-4xl">✓</div>

            <p className="mt-3 text-sm font-black uppercase tracking-[0.25em] text-green-300">
              Producto identificado
            </p>

            <p className="mt-3 text-slate-300">
              Este código corresponde a una botella registrada en MAESTRO.
            </p>
          </section>

          <section className="mt-6 grid gap-4 sm:grid-cols-2">
            <InfoCard
              label="Presentación"
              value={formatBottleSize(
                bottle.bottling.bottleSizeMl
              )}
            />

            <InfoCard
              label="Alcohol"
              value={
                alcohol !== null && alcohol !== undefined
                  ? `${formatNumber(alcohol, 2)}% Alc. Vol.`
                  : "No registrado"
              }
            />

            <InfoCard
              label="Lote"
              value={batch.code}
            />

            <InfoCard
              label="Serie"
              value={`#${formatSerialNumber(
                bottle.serialNumber
              )}`}
            />

            <InfoCard
              label="Elaboración"
              value={formatDate(batch.productionDate)}
            />

            <InfoCard
              label="Embotellado"
              value={formatDate(bottle.bottledAt)}
            />

            <InfoCard
              label="Caducidad"
              value={formatDate(expirationDate)}
            />

            <InfoCard
              label="Ubicación"
              value={
                bottle.currentLocation ?? "Almacén principal"
              }
            />
          </section>

          {product.description ? (
            <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                Producto
              </p>

              <p className="mt-3 leading-7 text-slate-300">
                {product.description}
              </p>
            </section>
          ) : null}

          <footer className="mt-8 border-t border-slate-800 pt-6 text-center">
            <p className="font-black text-white">
              Casa Destiladora del Norte
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Trazabilidad digital administrada por MAESTRO
            </p>
          </footer>
        </div>
      </section>
    </main>
  );
}

function InfoCard({
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

      <p className="mt-3 break-words text-lg font-black text-white">
        {value}
      </p>
    </div>
  );
}

function getPublicStatusLabel(status: LiquorBottleStatus) {
  switch (status) {
    case LiquorBottleStatus.DISPONIBLE:
      return "Producto vigente";

    case LiquorBottleStatus.RESERVADA:
      return "Producto reservado";

    case LiquorBottleStatus.VENDIDA:
      return "Producto vendido";

    case LiquorBottleStatus.MERMA:
      return "Producto fuera de circulación";

    case LiquorBottleStatus.RETIRADA:
      return "Producto retirado";

    default:
      return status;
  }
}

function getPublicStatusStyle(status: LiquorBottleStatus) {
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