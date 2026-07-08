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
    <main className="min-h-screen bg-slate-950 p-10 text-white">
      <div className="mx-auto max-w-6xl">
       

        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-amber-400">
              MAESTRO
            </p>

            <h1 className="mt-3 text-4xl font-bold">Molienda</h1>

            <p className="mt-2 text-slate-400">
              Procesos de molienda registrados.
            </p>
          </div>

          <Link
            href="/milling/new"
            className="rounded-xl bg-amber-400 px-5 py-3 font-bold text-black"
          >
            Nueva molienda
          </Link>
        </div>

        <section className="space-y-4">
          {millings.length === 0 ? (
            <div className="rounded-2xl bg-slate-900 p-8 text-slate-400">
              Aún no hay moliendas registradas.
            </div>
          ) : (
            millings.map((milling) => (
              <Link
                key={milling.id}
                href={`/milling/${milling.id}`}
                className="block rounded-2xl bg-slate-900 p-6 transition hover:bg-slate-800"
              >
                <h2 className="text-2xl font-bold">
                  {milling.lot.code}
                </h2>

                <p className="mt-2 text-slate-400">
                  {milling.equipment.name} •{" "}
                  {milling.cookedKg.toLocaleString()} kg
                </p>

                <p className="mt-2 text-amber-400 font-semibold">
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