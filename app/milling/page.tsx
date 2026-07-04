import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function MillingPage() {
  const millings = await prisma.milling.findMany({
    include: {
      lot: true,
      equipment: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <main className="min-h-screen bg-slate-950 p-10 text-white">
      <div className="mx-auto max-w-7xl">

        <div className="mb-10 flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-amber-400">
              MAESTRO
            </p>

            <h1 className="mt-2 text-4xl font-bold">
              Molienda
            </h1>
          </div>

          <Link
            href="/milling/new"
            className="rounded-xl bg-amber-400 px-6 py-3 font-bold text-black"
          >
            Nueva molienda
          </Link>
        </div>

        {millings.length === 0 ? (
          <div className="rounded-2xl bg-slate-900 p-10 text-center text-slate-400">
            No hay moliendas registradas.
          </div>
        ) : (
          <div className="grid gap-6">

            {millings.map((milling) => (
              <Link
                key={milling.id}
                href={`/milling/${milling.id}`}
                className="rounded-2xl bg-slate-900 p-6 transition hover:bg-slate-800"
              >
                <div className="flex items-center justify-between">

                  <div>
                    <h2 className="text-2xl font-bold">
                      {milling.lot.code}
                    </h2>

                    <p className="mt-2 text-slate-400">
                      Equipo: {milling.equipment.name}
                    </p>

                    <p className="text-slate-400">
                      Kg cocidos: {(milling.cookedKg ?? 0).toLocaleString()} kg
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-bold text-green-400">
                      {milling.status}
                    </p>
                  </div>

                </div>
              </Link>
            ))}

          </div>
        )}
      </div>
    </main>
  );
}