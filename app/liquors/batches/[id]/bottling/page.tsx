import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LiquorBottlingWizard from "@/components/liquors/LiquorBottlingWizard";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function LiquorBottlingPage({ params }: Props) {
  const { id } = await params;

  const batch = await prisma.liquorBatch.findUnique({
    where: {
      id,
    },
    include: {
      product: true,
      recipe: true,
      createdBy: true,
      bottlings: {
        select: {
          litersUsed: true,
          producedBottles: true,
          rejectedBottles: true,
        },
      },
    },
  });

  if (!batch) {
    notFound();
  }

  const batchLiters = batch.actualLiters ?? batch.plannedLiters;

  const alreadyUsedLiters = batch.bottlings.reduce(
    (sum, bottling) => sum + (bottling.litersUsed ?? 0),
    0
  );

  const availableLiters = Math.max(batchLiters - alreadyUsedLiters, 0);

  const alreadyProducedBottles = batch.bottlings.reduce(
    (sum, bottling) => sum + bottling.producedBottles,
    0
  );

  const alreadyRejectedBottles = batch.bottlings.reduce(
    (sum, bottling) => sum + bottling.rejectedBottles,
    0
  );

  const canBottle =
    batch.status === "LISTO_PARA_EMBOTELLAR" ||
    batch.status === "EMBOTELLANDO";

  return (
    <section className="mx-auto max-w-6xl">
      <Link
        href={`/liquors/batches/${batch.id}`}
        className="text-sm font-semibold text-purple-300 transition hover:text-purple-200"
      >
        ← Regresar al lote
      </Link>

      <header className="mt-6 overflow-hidden rounded-3xl border border-purple-500/20 bg-slate-900">
        <div className="bg-gradient-to-r from-purple-500/20 via-fuchsia-500/10 to-slate-900 p-6 sm:p-8">
          <p className="text-sm font-black uppercase tracking-[0.35em] text-purple-300">
            Embotellado
          </p>

          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-black text-white sm:text-5xl">
                {batch.product.icon ?? "🍾"} {batch.product.name}
              </h1>

              <p className="mt-3 font-mono text-lg font-bold text-purple-300">
                {batch.code}
              </p>

              <p className="mt-3 text-slate-400">
                Registra el resultado del embotellado y genera las botellas
                individuales del lote.
              </p>
            </div>

            <div className="rounded-2xl border border-purple-400/25 bg-purple-500/10 px-6 py-5">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-300/70">
                Litros disponibles
              </p>

              <p className="mt-2 text-4xl font-black text-white">
                {formatNumber(availableLiters)} L
              </p>
            </div>
          </div>
        </div>
      </header>

      {!canBottle ? (
        <section className="mt-6 rounded-3xl border border-amber-500/30 bg-amber-500/10 p-6 sm:p-8">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-amber-300">
            Embotellado no disponible
          </p>

          <h2 className="mt-3 text-2xl font-black text-white">
            Este lote todavía no está liberado para embotellar
          </h2>

          <p className="mt-3 text-amber-100/80">
            El lote debe encontrarse en estado “Listo para embotellar” o
            “Embotellando”.
          </p>
        </section>
      ) : availableLiters <= 0 ? (
        <section className="mt-6 rounded-3xl border border-green-500/30 bg-green-500/10 p-6 sm:p-8">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-green-300">
            Lote completamente embotellado
          </p>

          <h2 className="mt-3 text-2xl font-black text-white">
            No quedan litros disponibles
          </h2>

          <p className="mt-3 text-green-100/80">
            Todo el volumen registrado de este lote ya fue utilizado en
            embotellados anteriores.
          </p>
        </section>
      ) : (
        <LiquorBottlingWizard
          batchId={batch.id}
          availableLiters={availableLiters}
        />
      )}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          title="Volumen del lote"
          value={`${formatNumber(batchLiters)} L`}
          detail="Volumen final registrado"
        />

        <Kpi
          title="Litros ya usados"
          value={`${formatNumber(alreadyUsedLiters)} L`}
          detail="Embotellados anteriores"
        />

        <Kpi
          title="Botellas producidas"
          value={formatNumber(alreadyProducedBottles, 0)}
          detail="Total acumulado"
        />

        <Kpi
          title="Botellas rechazadas"
          value={formatNumber(alreadyRejectedBottles, 0)}
          detail="Merma acumulada"
        />
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
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </div>
  );
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