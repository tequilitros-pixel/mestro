import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function CookingPage() {
  const cookings = await prisma.cooking.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      lot: true,
      equipment: true,
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
            <h1 className="mt-3 text-4xl font-bold">Cocción</h1>
            <p className="mt-2 text-slate-400">
              Procesos de cocción registrados.
            </p>
          </div>

          <Link
            href="/cooking/new"
            className="rounded-xl bg-amber-400 px-6 py-3 font-bold text-black"
          >
            Nueva cocción
          </Link>
        </div>

        <section className="space-y-4">
          {cookings.length === 0 ? (
            <div className="rounded-2xl bg-slate-900 p-8 text-slate-400">
              Aún no hay cocciones registradas.
            </div>
          ) : (
            cookings.map((cooking) => (
              <Link
                key={cooking.id}
                href={`/cooking/${cooking.id}`}
                className="block rounded-2xl bg-slate-900 p-6 hover:bg-slate-800"
              >
                <h2 className="text-2xl font-bold">{cooking.lot.code}</h2>
                <p className="mt-2 text-slate-400">
                  {cooking.equipment.name} · {cooking.agaveKg.toLocaleString()} kg · {cooking.status}
                </p>
              </Link>
            ))
          )}
        </section>
      </div>
    </main>
  );
}