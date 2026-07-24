import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LiquorLabelPrintCenter from "@/components/liquors/LiquorLabelPrintCenter";

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

  const totalBottles = bottling.bottles.length;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Link
        href={`/liquors/batches/${id}/labels`}
        className="text-sm font-semibold text-purple-300 transition hover:text-purple-200"
      >
        ← Regresar a los embotellados
      </Link>

      <header className="mt-6 overflow-hidden rounded-3xl border border-purple-500/20 bg-slate-900">
        <div className="bg-gradient-to-br from-purple-500/20 via-fuchsia-500/10 to-slate-900 p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.35em] text-purple-300">
                Centro de impresión
              </p>

              <h1 className="mt-3 text-4xl font-black text-white sm:text-5xl">
                🏷️ Preparar etiquetas
              </h1>

              <p className="mt-4 text-xl font-bold text-purple-200">
                {bottling.batch.product.icon ?? "🍹"}{" "}
                {bottling.batch.product.name}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <InfoBadge
                  label="Lote"
                  value={bottling.batch.code}
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

            <div className="rounded-2xl border border-purple-400/25 bg-purple-500/10 px-6 py-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-purple-300/70">
                Botellas disponibles
              </p>

              <p className="mt-2 text-4xl font-black text-white">
                {formatNumber(totalBottles)}
              </p>

              <p className="mt-2 text-sm text-purple-100/60">
                Máximo de etiquetas
              </p>
            </div>
          </div>
        </div>
      </header>

      <LiquorLabelPrintCenter
        batchId={bottling.batch.id}
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
    <div className="rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p className="mt-1 font-bold text-slate-200">{value}</p>
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