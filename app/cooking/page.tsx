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
    <main className="min-h-screen bg-background p-10 text-on-surface">
      <div className="mx-auto max-w-6xl">
       
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="font-mono text-sm uppercase tracking-[0.4em] text-on-surface-variant">
              MAESTRO
            </p>
            <h1 className="mt-3 text-4xl font-bold">Cocción</h1>
            <p className="mt-2 text-on-surface-variant">
              Procesos de cocción registrados.
            </p>
          </div>

          <Link
            href="/cooking/new"
            className="rounded-xl bg-primary px-6 py-3 font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
          >
            Nueva cocción
          </Link>
        </div>

        <section className="space-y-4">
          {cookings.length === 0 ? (
            <div className="rounded-2xl bg-surface-container p-8 text-on-surface-variant">
              Aún no hay cocciones registradas.
            </div>
          ) : (
            cookings.map((cooking) => (
              <Link
                key={cooking.id}
                href={`/cooking/${cooking.id}`}
                className="block rounded-2xl bg-surface-container p-6 hover:bg-surface-container-high"
              >
                <h2 className="text-2xl font-bold">{cooking.lot.code}</h2>
                <p className="mt-2 text-on-surface-variant">
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