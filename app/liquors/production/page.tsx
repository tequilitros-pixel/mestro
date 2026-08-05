import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MartiniIcon } from "@/components/ui/icons";

export default async function LiquorProductionPage() {
  const batches = await prisma.liquorBatch.findMany({
    where: {
      status: {
        notIn: ["TERMINADO"],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      product: true,
    },
  });

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <div>
        <p className="font-mono text-sm font-black uppercase tracking-[0.2em] text-on-surface-variant">
          Elaboración de licores
        </p>

        <h1 className="mt-2 text-3xl font-black text-on-surface">
          Producción
        </h1>

        <p className="mt-2 text-on-surface-variant">
          Continúa los lotes que se encuentran en elaboración.
        </p>
      </div>

      {batches.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-dashed border-outline-variant bg-surface-container/50 p-10 text-center">
          <MartiniIcon className="mx-auto h-12 w-12 text-on-surface-variant" />

          <h2 className="mt-5 text-2xl font-black text-on-surface">
            No hay producciones activas
          </h2>

          <p className="mt-3 text-on-surface-variant">
            Inicia un lote nuevo para comenzar la elaboración.
          </p>

          <Link
            href="/liquors"
            className="mt-6 inline-flex rounded-2xl bg-primary px-5 py-3 font-black text-on-surface transition duration-150 ease-out hover:opacity-90 hover:scale-[1.04] active:scale-[0.97]"
          >
            Iniciar nuevo lote
          </Link>
        </section>
      ) : (
        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {batches.map((batch) => (
            <Link
              key={batch.id}
              href={`/liquors/batches/${batch.id}`}
              className="rounded-3xl border border-outline-variant bg-surface-container/70 p-6 transition hover:border-primary/25"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="text-4xl">
                  {batch.product.icon ?? "🍹"}
                </span>

                <span className="rounded-full border border-outline-variant bg-surface-container-high px-3 py-1 text-xs font-black text-on-surface-variant">
                  {formatStatus(batch.status)}
                </span>
              </div>

              <h2 className="mt-5 text-xl font-black text-on-surface">
                {batch.product.name}
              </h2>

              <p className="mt-2 font-mono text-sm text-on-surface-variant">
                {batch.code}
              </p>

              <p className="mt-5 font-black text-on-surface">
                Continuar producción →
              </p>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}