import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BottleLabel from "@/components/liquors/BottleLabel";
import PrintLabelsButton from "@/components/liquors/PrintLabelsButton";
import { TagIcon } from "@/components/ui/icons";

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

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 print:m-0 print:max-w-none print:p-0">
      <Link
        href={`/liquors/batches/${id}/labels/${bottlingId}`}
        className="no-print text-sm font-semibold text-on-surface-variant transition hover:text-on-surface"
      >
        ← Modificar selección
      </Link>

      <header className="no-print mt-6 rounded-3xl border border-outline-variant bg-surface-container p-6 sm:p-8">
        <p className="text-sm font-black uppercase tracking-[0.3em] text-on-surface-variant">
          Vista previa
        </p>

        <h1 className="mt-3 flex items-center gap-3 text-4xl font-black text-on-surface">
          <TagIcon className="h-8 w-8 shrink-0" />
          Etiquetas seleccionadas
        </h1>

        <p className="mt-4 text-xl font-bold text-on-surface-variant">
          {bottling.batch.product.icon ?? "🍹"}{" "}
          {bottling.batch.product.name}
        </p>

        <p className="mt-2 font-mono text-sm font-bold text-on-surface-variant">
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

      <section className="mt-6 rounded-3xl border border-outline-variant bg-surface-container p-6 sm:p-8 print:m-0 print:border-0 print:bg-white print:p-0">
        <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-on-surface-variant">
              Botellas seleccionadas
            </p>

            <h2 className="mt-2 text-2xl font-black text-on-surface">
              Revisa antes de imprimir
            </h2>
          </div>

          <p className="text-sm text-on-surface-variant">
            {selectedBottles.length} etiquetas
          </p>
        </div>

        <div className="print-label-root mt-6 flex flex-wrap justify-center gap-4 print:mt-0 print:block">
          {selectedBottles.map((bottle) => {
            const manufacturedAt =
              bottle.manufacturedAt ??
              bottle.bottledAt ??
              bottling.bottledAt;

            const expirationDate =
              bottle.expirationDate ??
              bottling.expirationDate;

            return (
              <BottleLabel
                key={bottle.id}
                bottle={{
                  productName: bottling.batch.product.name,
                  productIcon: bottling.batch.product.icon,
                  bottleSizeMl: bottling.bottleSizeMl,
                  bottleCode: bottle.code,
                  batchCode: bottling.batch.code,
                  serialNumber: bottle.serialNumber,
                  totalBottles,
                  alcohol,
                  qrToken: bottle.qrToken,
                  authenticityCode: bottle.authenticityCode,
                  manufacturedAt,
                  expirationDate,
                }}
              />
            );
          })}
        </div>

        <div className="no-print mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/liquors/batches/${id}/labels/${bottlingId}`}
            className="flex-1 rounded-2xl border border-outline-variant px-6 py-4 text-center font-black text-on-surface transition hover:bg-surface-container-high"
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
    <div className="rounded-2xl border border-primary/25 bg-primary/[0.06] p-5">
      <p className="text-xs font-black uppercase tracking-wider text-on-surface-variant">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black text-on-surface">
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

function formatNumber(
  value: number,
  maximumFractionDigits = 2
) {
  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits,
  }).format(value);
}