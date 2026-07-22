import Link from "next/link";
import { prisma } from "@/lib/prisma";

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
          <p className="text-sm font-black uppercase tracking-[0.2em] text-purple-300">
            Elaboración de licores
          </p>

          <h1 className="mt-2 text-3xl font-black text-white">
            Lotes
          </h1>

          <p className="mt-2 text-slate-400">
            Consulta y continúa los lotes registrados.
          </p>
        </div>

        <Link
          href="/liquors"
          className="rounded-2xl bg-purple-600 px-5 py-3 text-center font-black text-white transition hover:bg-purple-500"
        >
          + Crear lote
        </Link>
      </header>

      {batches.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-dashed border-slate-700 bg-slate-900/50 p-10 text-center">
          <div className="text-5xl">🏷️</div>

          <h2 className="mt-5 text-2xl font-black text-white">
            No hay lotes registrados
          </h2>

          <p className="mt-3 text-slate-400">
            Cuando crees un lote aparecerá en esta sección.
          </p>

          <Link
            href="/liquors"
            className="mt-6 inline-flex rounded-2xl bg-purple-600 px-5 py-3 font-black text-white transition hover:bg-purple-500"
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
              className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 transition hover:border-purple-500/40 hover:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="text-4xl">
                  {batch.product.icon ?? "🍹"}
                </span>

                <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs font-black text-purple-300">
                  {formatStatus(batch.status)}
                </span>
              </div>

              <h2 className="mt-5 text-xl font-black text-white">
                {batch.product.name}
              </h2>

              <p className="mt-2 font-mono text-sm font-bold text-purple-300">
                {batch.code}
              </p>

              <div className="mt-5 border-t border-slate-800 pt-4">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Receta
                </p>

                <p className="mt-2 text-sm font-semibold text-slate-300">
                  {batch.recipe.name}
                </p>
              </div>

              <p className="mt-5 font-black text-white">
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