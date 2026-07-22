import Link from "next/link";
import { prisma } from "@/lib/prisma";

type SearchParams = Promise<{
  search?: string;
}>;

export default async function LiquorQrPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { search = "" } = await searchParams;
  const query = search.trim();

  const bottles = query
    ? await prisma.liquorBottle.findMany({
        where: {
          OR: [
            {
              code: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              bottling: {
                batch: {
                  code: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
              },
            },
          ],
        },
        take: 20,
        orderBy: {
          bottledAt: "desc",
        },
        include: {
          bottling: {
            include: {
              batch: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
      })
    : [];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="text-center">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-purple-300">
          Trazabilidad
        </p>

        <h1 className="mt-2 text-3xl font-black text-white">
          Buscar código QR
        </h1>

        <p className="mt-2 text-slate-400">
          Escribe el código de una botella o de un lote.
        </p>
      </div>

      <form className="mx-auto mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row">
        <input
          type="search"
          name="search"
          defaultValue={query}
          placeholder="Ejemplo: BOT-000001 o LZ-21-07-2026-013"
          className="min-w-0 flex-1 rounded-2xl border border-slate-700 bg-slate-900 px-5 py-4 text-white outline-none placeholder:text-slate-600 focus:border-purple-500"
        />

        <button
          type="submit"
          className="rounded-2xl bg-purple-600 px-6 py-4 font-black text-white transition hover:bg-purple-500"
        >
          Buscar
        </button>
      </form>

      {!query ? (
        <section className="mt-8 rounded-3xl border border-dashed border-slate-700 bg-slate-900/50 p-10 text-center">
          <div className="text-6xl">▣</div>

          <h2 className="mt-5 text-xl font-black text-white">
            Consulta una botella
          </h2>

          <p className="mt-3 text-slate-400">
            Los resultados aparecerán aquí.
          </p>
        </section>
      ) : bottles.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <h2 className="text-xl font-black text-white">
            No encontramos resultados
          </h2>

          <p className="mt-2 text-slate-400">
            Revisa el código e intenta nuevamente.
          </p>
        </section>
      ) : (
        <section className="mt-8 space-y-3">
          {bottles.map((bottle) => {
            const batch = bottle.bottling.batch;

            return (
              <article
                key={bottle.id}
                className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-black text-white">
                    {batch.product.icon ?? "🍾"}{" "}
                    {batch.product.name}
                  </p>

                  <p className="mt-1 font-mono text-sm text-purple-300">
                    {bottle.code}
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    Lote: {batch.code}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Link
                    href={`/liquors/bottles/${bottle.id}`}
                    className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-black text-white"
                  >
                    Ver botella
                  </Link>

                  <Link
                    href={`/liquors/bottles/${bottle.id}/qr`}
                    className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-black text-white"
                  >
                    Ver QR
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}