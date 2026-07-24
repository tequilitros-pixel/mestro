import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BottleQrCode from "@/components/liquors/BottleQrCode";
import PrintLabelsButton from "@/components/liquors/PrintLabelsButton";

type Props = {
  params: Promise<{
    id: string;
    bottlingId: string;
  }>;

  searchParams: Promise<{
    mode?: string;
    start?: string;
    end?: string;
  }>;
};

export default async function LiquorLabelsPreviewPage({
  params,
  searchParams,
}: Props) {
  const { id, bottlingId } = await params;
  const query = await searchParams;

  const start = Number(query.start);
  const end = Number(query.end);

  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 1 ||
    end < start
  ) {
    redirect(`/liquors/batches/${id}/labels/${bottlingId}`);
  }

  const bottling = await prisma.liquorBottling.findFirst({
    where: {
      id: bottlingId,
      batchId: id,
    },

    select: {
      id: true,
      code: true,
      bottleSizeMl: true,
      bottledAt: true,
      expirationDate: true,

      batch: {
        select: {
          id: true,
          code: true,
          initialAlcohol: true,

          product: {
            select: {
              name: true,
              icon: true,
            },
          },

          recipe: {
            select: {
              targetAlcohol: true,
            },
          },
        },
      },

      bottles: {
        orderBy: {
          serialNumber: "asc",
        },

        select: {
          id: true,
          code: true,
          serialNumber: true,
          qrToken: true,
          authenticityCode: true,
          manufacturedAt: true,
          bottledAt: true,
          expirationDate: true,
        },
      },
    },
  });

  if (!bottling) {
    notFound();
  }

  const totalBottles = bottling.bottles.length;

  if (end > totalBottles) {
    redirect(`/liquors/batches/${id}/labels/${bottlingId}`);
  }

  const selectedBottles = bottling.bottles.slice(start - 1, end);

  const alcohol =
    bottling.batch.initialAlcohol ??
    bottling.batch.recipe.targetAlcohol ??
    null;

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 print:max-w-none print:p-0">
      <Link
        href={`/liquors/batches/${id}/labels/${bottlingId}`}
        className="no-print text-sm font-semibold text-purple-300 transition hover:text-purple-200"
      >
        ← Modificar selección
      </Link>

      <header className="no-print mt-6 rounded-3xl border border-purple-500/20 bg-slate-900 p-6 sm:p-8">
        <p className="text-sm font-black uppercase tracking-[0.3em] text-purple-300">
          Vista previa
        </p>

        <h1 className="mt-3 text-4xl font-black text-white">
          🏷️ Etiquetas seleccionadas
        </h1>

        <p className="mt-4 text-xl font-bold text-purple-200">
          {bottling.batch.product.icon ?? "🍹"}{" "}
          {bottling.batch.product.name}
        </p>

        <p className="mt-2 font-mono text-sm font-bold text-slate-400">
          Lote {bottling.batch.code}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Cantidad"
            value={String(selectedBottles.length)}
          />

          <SummaryCard
            label="Rango"
            value={`${start} a ${end}`}
          />

          <SummaryCard
            label="Presentación"
            value={formatBottleSize(bottling.bottleSizeMl)}
          />

          <SummaryCard
            label="Alcohol"
            value={
              alcohol !== null
                ? `${formatNumber(alcohol)}%`
                : "No registrado"
            }
          />
        </div>
      </header>

      <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8 print:m-0 print:border-0 print:bg-white print:p-0">
        <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-purple-400">
              Botellas seleccionadas
            </p>

            <h2 className="mt-2 text-2xl font-black text-white">
              Revisa antes de imprimir
            </h2>
          </div>

          <p className="text-sm text-slate-500">
            {selectedBottles.length} etiquetas
          </p>
        </div>

        <div className="label-sheet mt-6 grid gap-4 sm:grid-cols-2 print:mt-0 print:grid-cols-2 print:gap-0">
          {selectedBottles.map((bottle) => {
            const manufacturedAt =
              bottle.manufacturedAt ??
              bottle.bottledAt ??
              bottling.bottledAt;

            const expirationDate =
              bottle.expirationDate ??
              bottling.expirationDate;

       const qrUrl = `${baseUrl}/q/${encodeURIComponent(
  bottle.qrToken
)}`;

            return (
              <article
                key={bottle.id}
                className="label-card break-inside-avoid border border-slate-300 bg-white p-6 text-black print:border-black"
                style={{
                  boxSizing: "border-box",
                  minHeight: "120mm",
                }}
              >
                <header className="text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em]">
                    Casa Destiladora del Norte
                  </p>

                  <h3 className="mt-3 text-2xl font-black leading-tight">
                    {bottling.batch.product.name}
                  </h3>

                  <p className="mt-2 text-sm font-bold">
                    {formatBottleSize(bottling.bottleSizeMl)}
                  </p>

                  {alcohol !== null && (
                    <p className="mt-1 text-sm font-black">
                      {formatNumber(alcohol)}% Alc. Vol.
                    </p>
                  )}
                </header>

                <section className="mt-5 border-y border-black py-4">
                  <LabelRow
                    label="Lote"
                    value={bottling.batch.code}
                    mono
                  />

                  <LabelRow
                    label="Botella"
                    value={`${bottle.serialNumber} de ${totalBottles}`}
                  />

                  <LabelRow
                    label="Código"
                    value={bottle.code}
                    mono
                  />

                  <LabelRow
                    label="Elaboración"
                    value={
                      manufacturedAt
                        ? formatDate(manufacturedAt)
                        : "Sin fecha"
                    }
                  />

                  <LabelRow
                    label="Caducidad"
                    value={
                      expirationDate
                        ? formatDate(expirationDate)
                        : "Sin fecha"
                    }
                  />
                </section>

                <section className="mt-5 flex items-center justify-between gap-5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-black uppercase tracking-wider">
                      Código de autenticidad
                    </p>

                    <p className="mt-2 break-all font-mono text-xs font-black">
                      {bottle.authenticityCode ?? bottle.code}
                    </p>

                    <p className="mt-4 text-[9px] font-semibold leading-4">
                      Escanea el código QR para consultar la identidad
                      de esta botella.
                    </p>
                  </div>

                  <div className="shrink-0 bg-white">
                    <BottleQrCode
                      value={qrUrl}
                      size={92}
                    />
                  </div>
                </section>

                <footer className="mt-6 border-t border-black pt-3 text-center">
                  <p className="text-[8px] font-black uppercase tracking-[0.14em]">
                    Producto identificado individualmente por MAESTRO
                  </p>
                </footer>
              </article>
            );
          })}
        </div>

        <div className="no-print mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/liquors/batches/${id}/labels/${bottlingId}`}
            className="flex-1 rounded-2xl border border-slate-700 px-6 py-4 text-center font-black text-slate-200 transition hover:bg-slate-800"
          >
            Regresar
          </Link>

          <PrintLabelsButton />
        </div>
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-purple-500/20 bg-purple-500/10 p-5">
      <p className="text-xs font-black uppercase tracking-wider text-purple-300/70">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black text-white">
        {value}
      </p>
    </div>
  );
}

function LabelRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="mt-2 flex items-start justify-between gap-4 first:mt-0">
      <span className="shrink-0 text-[10px] font-black uppercase">
        {label}
      </span>

      <span
        className={`min-w-0 break-all text-right text-xs font-black ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </span>
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

function formatNumber(
  value: number,
  maximumFractionDigits = 2
) {
  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits,
  }).format(value);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeZone: "America/Mexico_City",
  }).format(date);
}