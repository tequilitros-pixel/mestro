import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LiquorLabelPrintCenter from "@/components/liquors/LiquorLabelPrintCenter";
import { TagIcon } from "@/components/ui/icons";

type Props = {
  params: Promise<{
    id: string;
    bottlingId: string;
  }>;
};

export default async function LiquorLabelPrintCenterPage({
  params,
}: Props) {
  const { id, bottlingId } = await params;

  const bottling = await prisma.liquorBottling.findFirst({
    where: {
      id: bottlingId,
      batchId: id,
    },
    select: {
      id: true,
      code: true,
      bottleSizeMl: true,
      producedBottles: true,
      rejectedBottles: true,
      bottledAt: true,

      batch: {
        select: {
          id: true,
          code: true,

          product: {
            select: {
              name: true,
              icon: true,
            },
          },
        },
      },

      bottles: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
        },
      },
    },
  });

  if (!bottling) {
    notFound();
  }

  // Esta pantalla cuelga de un lote (la consulta filtra por `batchId`),
  // así que los embotellados de granel nunca llegan aquí.
  const batch = bottling.batch;

  if (!batch) {
    notFound();
  }

  const totalBottles = bottling.bottles.length;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Link
        href={`/liquors/batches/${id}/labels`}
        className="text-sm font-semibold text-on-surface-variant transition hover:text-on-surface"
      >
        ← Regresar a los embotellados
      </Link>

      <header className="mt-6 overflow-hidden rounded-3xl border border-outline-variant bg-surface-container">
        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-sm font-black uppercase tracking-[0.35em] text-on-surface-variant">
                Centro de impresión
              </p>

              <h1 className="mt-3 flex items-center gap-3 text-4xl font-black text-on-surface sm:text-5xl">
                <TagIcon className="h-8 w-8 shrink-0 sm:h-10 sm:w-10" />
                Preparar etiquetas
              </h1>

              <p className="mt-4 text-xl font-bold text-on-surface-variant">
                {batch.product.icon ?? "🍹"}{" "}
                {batch.product.name}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <InfoBadge
                  label="Lote"
                  value={batch.code}
                />

                <InfoBadge
                  label="Presentación"
                  value={formatBottleSize(
                    bottling.bottleSizeMl
                  )}
                />

                <InfoBadge
                  label="Embotellado"
                  value={bottling.code}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-primary/25 bg-primary/[0.06] px-6 py-5">
              <p className="font-mono text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">
                Botellas disponibles
              </p>

              <p className="mt-2 text-4xl font-black text-on-surface">
                {formatNumber(totalBottles)}
              </p>

              <p className="mt-2 text-sm text-on-surface-variant">
                Máximo de etiquetas
              </p>
            </div>
          </div>
        </div>
      </header>

      <LiquorLabelPrintCenter
        batchId={batch.id}
        bottlingId={bottling.id}
        totalBottles={totalBottles}
      />
    </main>
  );
}

function InfoBadge({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-dim/40 px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-outline">
        {label}
      </p>

      <p className="mt-1 font-bold text-on-surface">{value}</p>
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

  return `${formatNumber(sizeMl)} ml`;
}

function formatNumber(
  value: number,
  maximumFractionDigits = 0
) {
  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits,
  }).format(value);
}
