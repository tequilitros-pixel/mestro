import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { resolveBottleOrigin } from "@/lib/liquors/bottleOrigin";
import { QrIcon } from "@/components/ui/icons";

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

              // Las botellas de granel (tequila blanco del proceso) no
              // tienen lote: su origen es la materia prima.
              rawMaterial: true,
            },
          },
        },
      })
    : [];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="text-center">
        <p className="font-mono text-sm font-black uppercase tracking-[0.2em] text-on-surface-variant">
          Trazabilidad
        </p>

        <h1 className="mt-2 text-3xl font-black text-on-surface">
          Buscar código QR
        </h1>

        <p className="mt-2 text-on-surface-variant">
          Escribe el código de una botella o de un lote.
        </p>
      </div>

      <form className="mx-auto mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row">
        <input
          type="search"
          name="search"
          defaultValue={query}
          placeholder="Ejemplo: BOT-000001 o LZ-21-07-2026-013"
          className="min-w-0 flex-1 rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
        />

        <button
          type="submit"
          className="rounded-2xl bg-primary px-6 py-4 font-black text-on-surface transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
        >
          Buscar
        </button>
      </form>

      {!query ? (
        <section className="mt-8 rounded-3xl border border-dashed border-outline-variant bg-surface-container/50 p-10 text-center">
          <QrIcon className="mx-auto h-12 w-12 text-on-surface-variant" />

          <h2 className="mt-5 text-xl font-black text-on-surface">
            Consulta una botella
          </h2>

          <p className="mt-3 text-on-surface-variant">
            Los resultados aparecerán aquí.
          </p>
        </section>
      ) : bottles.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-error/20 bg-error/5 p-8 text-center">
          <h2 className="text-xl font-black text-on-surface">
            No encontramos resultados
          </h2>

          <p className="mt-2 text-on-surface-variant">
            Revisa el código e intenta nuevamente.
          </p>
        </section>
      ) : (
        <section className="mt-8 space-y-3">
          {bottles.map((bottle) => {
            const origin = resolveBottleOrigin(bottle.bottling);

            return (
              <article
                key={bottle.id}
                className="flex flex-col gap-4 rounded-2xl border border-outline-variant bg-surface-container/70 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-black text-on-surface">
                    {origin.productIcon ?? "🍾"}{" "}
                    {origin.productName}
                  </p>

                  <p className="mt-1 font-mono text-sm text-on-surface-variant">
                    {bottle.code}
                  </p>

                  <p className="mt-2 text-sm text-outline">
                    {origin.fromBulk ? origin.sourceLabel : "Lote"}:{" "}
                    {origin.sourceCode}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Link
                    href={`/liquors/bottles/${bottle.id}`}
                    className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-black text-on-surface transition duration-150 ease-out hover:scale-[1.04] hover:border-primary/25 active:scale-[0.97]"
                  >
                    Ver botella
                  </Link>

                  <Link
                    href={`/liquors/bottles/${bottle.id}/qr`}
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-black text-on-surface transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
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