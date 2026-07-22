import Link from "next/link";
import { prisma } from "@/lib/prisma";

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
        <p className="text-sm font-black uppercase tracking-[0.2em] text-purple-300">
          Elaboración de licores
        </p>

        <h1 className="mt-2 text-3xl font-black text-white">
          Producción
        </h1>

        <p className="mt-2 text-slate-400">
          Continúa los lotes que se encuentran en elaboración.
        </p>
      </div>

      {batches.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-dashed border-slate-700 bg-slate-900/50 p-10 text-center">
          <div className="text-5xl">🍹</div>

          <h2 className="mt-5 text-2xl font-black text-white">
            No hay producciones activas
          </h2>

          <p className="mt-3 text-slate-400">
            Inicia un lote nuevo para comenzar la elaboración.
          </p>

          <Link
            href="/liquors/batches/new"
            className="mt-6 inline-flex rounded-2xl bg-purple-600 px-5 py-3 font-black text-white transition hover:bg-purple-500"
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
              className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 transition hover:border-purple-500/40"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="text-4xl">
                  {batch.product.icon ?? "🍹"}
                </span>

                <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-xs font-black text-yellow-300">
                  {formatStatus(batch.status)}
                </span>
              </div>

              <h2 className="mt-5 text-xl font-black text-white">
                {batch.product.name}
              </h2>

              <p className="mt-2 font-mono text-sm text-purple-300">
                {batch.code}
              </p>

              <p className="mt-5 font-black text-white">
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