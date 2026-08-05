import Link from "next/link";
import { prisma } from "@/lib/prisma";


export default async function MillingPage() {
  const millings = await prisma.milling.findMany({
    include: {
      lot: true,
      equipment: true,
    },
    orderBy: {
      startedAt: "desc",
    },
  });

  return (
    <main className="min-h-screen bg-background p-10 text-on-surface">
      <div className="mx-auto max-w-6xl">
       

        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="font-mono text-sm uppercase tracking-[0.4em] text-on-surface-variant">
              MAESTRO
            </p>

            <h1 className="mt-3 text-4xl font-bold">Molienda</h1>

            <p className="mt-2 text-on-surface-variant">
              Procesos de molienda registrados.
            </p>
          </div>

          <Link
            href="/milling/new"
            className="rounded-xl bg-primary px-5 py-3 font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
          >
            Nueva molienda
          </Link>
        </div>

        <section className="space-y-4">
          {millings.length === 0 ? (
            <div className="rounded-2xl bg-surface-container p-8 text-on-surface-variant">
              Aún no hay moliendas registradas.
            </div>
          ) : (
            millings.map((milling) => (
              <Link
                key={milling.id}
                href={`/milling/${milling.id}`}
                className="block rounded-2xl bg-surface-container p-6 transition hover:bg-surface-container-high"
              >
                <h2 className="text-2xl font-bold">
                  {milling.lot.code}
                </h2>

                <p className="mt-2 text-on-surface-variant">
                  {milling.equipment.name} •{" "}
                  {milling.cookedKg.toLocaleString()} kg
                </p>

                <p className="mt-2 text-on-surface-variant font-semibold">
                  {milling.status}
                </p>
              </Link>
            ))
          )}
        </section>
      </div>
    </main>
  );
}