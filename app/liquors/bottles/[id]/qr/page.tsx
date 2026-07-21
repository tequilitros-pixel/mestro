import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function LiquorBottleQrPage({ params }: Props) {
  const { id } = await params;

  const bottle = await prisma.liquorBottle.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      code: true,
      qrToken: true,
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
              finalAlcohol: true,
              initialAlcohol: true,
              expirationDate: true,

              product: {
                select: {
                  name: true,
                  icon: true,
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

  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/q/${bottle.qrToken}`;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(
    publicUrl
  )}`;

  return (
    <section className="mx-auto max-w-5xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={`/liquors/bottles/${bottle.id}`}
          className="text-sm font-bold text-slate-400 transition hover:text-white"
        >
          ← Volver a la botella
        </Link>

        <Link
          href="/liquors/inventory"
          className="text-sm font-bold text-purple-300 transition hover:text-purple-200"
        >
          Ver inventario
        </Link>
      </div>

      <section className="mt-6 overflow-hidden rounded-3xl border border-purple-500/25 bg-slate-900">
        <div className="bg-gradient-to-br from-purple-500/20 via-fuchsia-500/10 to-slate-900 p-6 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div className="rounded-3xl bg-white p-6">
              <img
                src={qrImageUrl}
                alt={`Código QR de ${bottle.code}`}
                className="mx-auto aspect-square w-full max-w-[420px]"
              />
            </div>

            <div>
              <p className="text-sm font-black uppercase tracking-[0.3em] text-purple-300">
                Identidad digital
              </p>

              <h1 className="mt-3 text-4xl font-black text-white sm:text-5xl">
                {product.icon ?? "🍾"} {bottle.code}
              </h1>

              <p className="mt-3 text-2xl font-black text-purple-200">
                {product.name}
              </p>

              <div className="mt-7 grid gap-4 sm:grid-cols-2">
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
                      ? `${formatNumber(alcohol, 2)}%`
                      : "—"
                  }
                />

                <InfoCard
                  label="Lote"
                  value={batch.code}
                />

                <InfoCard
                  label="Estado"
                  value={formatStatus(bottle.status)}
                />

                <InfoCard
                  label="Embotellada"
                  value={formatDate(bottle.bottledAt)}
                />

                <InfoCard
                  label="Caducidad"
                  value={formatDate(expirationDate)}
                />
              </div>

              <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/40 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                  Enlace del QR
                </p>

                <p className="mt-3 break-all font-mono text-sm text-slate-300">
                  {publicUrl}
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
               <a
  href={qrImageUrl}
  target="_blank"
  rel="noreferrer"
  className="flex-1 rounded-2xl bg-purple-600 px-5 py-4 text-center font-black text-white transition hover:bg-purple-500"
>
  Ver QR completo
</a>
        

                <Link
                  href={`/liquors/bottles/${bottle.id}/label`}
                  className="flex-1 rounded-2xl border border-slate-700 px-5 py-4 text-center font-black text-slate-200 transition hover:bg-slate-800"
                >
                  🏷 Ver etiqueta
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </section>
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

function formatBottleSize(sizeMl: number) {
  if (sizeMl >= 1000) {
    const liters = sizeMl / 1000;

    return `${formatNumber(liters, 2)} ${
      liters === 1 ? "litro" : "litros"
    }`;
  }

  return `${formatNumber(sizeMl, 0)} ml`;
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
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