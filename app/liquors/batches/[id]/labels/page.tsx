import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BottleIcon, ChevronRightIcon, TagIcon } from "@/components/ui/icons";
import AppIcon from "@/components/ui/AppIcon";

export default async function BottlingLabelsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const batch = await prisma.liquorBatch.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      product: { select: { name: true } },
      bottlings: {
        orderBy: { bottledAt: "desc" },
        select: {
          id: true,
          code: true,
          bottleSizeMl: true,
          _count: { select: { bottles: true } },
        },
      },
    },
  });

  if (!batch) notFound();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href={`/liquors/batches/${batch.id}`}
        className="text-sm font-semibold text-on-surface-variant transition hover:text-on-surface"
      >
        ← Regresar al lote
      </Link>

      <header className="mt-6">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-on-surface-variant">
          Lote {batch.code}
        </p>
        <h1 className="mt-3 flex items-center gap-3 text-3xl font-black text-on-surface sm:text-4xl">
          <AppIcon icon={TagIcon} variant="purple" size="lg" />
          Etiquetas de {batch.product.name}
        </h1>
        <p className="mt-3 text-on-surface-variant">
          Selecciona el embotellado cuyas etiquetas deseas preparar.
        </p>
      </header>

      <section className="mt-8 grid gap-3">
        {batch.bottlings.length === 0 ? (
          <div className="rounded-xl border border-outline-variant bg-surface-container p-6 text-on-surface-variant">
            Este lote todavía no tiene embotellados disponibles.
          </div>
        ) : (
          batch.bottlings.map((bottling) => (
            <Link
              key={bottling.id}
              href={`/liquors/batches/${batch.id}/labels/${bottling.id}`}
              className="flex min-h-14 items-center gap-3 rounded-xl border border-outline-variant bg-surface-container p-4 transition hover:border-primary/30 hover:bg-surface-container-high"
            >
              <AppIcon icon={BottleIcon} variant="cyan" size="md" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-on-surface">{bottling.code}</p>
                <p className="mt-0.5 text-sm text-on-surface-variant">
                  {formatBottleSize(bottling.bottleSizeMl)} · {bottling._count.bottles} botellas
                </p>
              </div>
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-on-surface-variant" />
            </Link>
          ))
        )}
      </section>
    </main>
  );
}

function formatBottleSize(sizeMl: number) {
  return sizeMl >= 1000
    ? `${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(sizeMl / 1000)} L`
    : `${sizeMl} ml`;
}
