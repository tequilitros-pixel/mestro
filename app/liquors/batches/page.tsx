import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TagIcon } from "@/components/ui/icons";

export default async function LiquorBatchesPage() {
  const batches = await prisma.liquorBatch.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      product: true,
      recipe: true,
    },
  });

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-sm font-black uppercase tracking-[0.2em] text-on-surface-variant">
            Elaboración de licores
          </p>

          <h1 className="mt-2 text-3xl font-black text-on-surface">
            Lotes
          </h1>

          <p className="mt-2 text-on-surface-variant">
            Consulta y continúa los lotes registrados.
          </p>
        </div>

        <Link
          href="/liquors"
          className="rounded-2xl bg-primary px-5 py-3 text-center font-black text-on-surface transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
        >
          + Crear lote
        </Link>
      </header>

      {batches.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-dashed border-outline-variant bg-surface-container/50 p-10 text-center">
          <TagIcon className="mx-auto h-10 w-10 text-on-surface-variant" />

          <h2 className="mt-5 text-2xl font-black text-on-surface">
            No hay lotes registrados
          </h2>

          <p className="mt-3 text-on-surface-variant">
            Cuando crees un lote aparecerá en esta sección.
          </p>

          <Link
            href="/liquors"
            className="mt-6 inline-flex rounded-2xl bg-primary px-5 py-3 font-black text-on-surface transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
          >
            Ir al inicio de licores
          </Link>
        </section>
      ) : (
        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {batches.map((batch) => (
            <Link
              key={batch.id}
              href={`/liquors/batches/${batch.id}`}
              className="rounded-3xl border border-outline-variant bg-surface-container/70 p-6 transition hover:border-primary/25 hover:bg-surface-container"
            >
              <div className="flex items-start justify-between gap-4">
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

              <p className="mt-2 font-mono text-sm font-bold text-on-surface-variant">
                {batch.code}
              </p>

              <div className="mt-5 border-t border-outline-variant pt-4">
                <p className="text-xs font-black uppercase tracking-wider text-outline">
                  Receta
                </p>

                <p className="mt-2 text-sm font-semibold text-on-surface-variant">
                  {batch.recipe.name}
                </p>
              </div>

              <p className="mt-5 font-black text-on-surface">
                Ver lote →
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