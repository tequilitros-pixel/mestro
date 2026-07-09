import { prisma } from "../lib/prisma";
import { EquipmentCard } from "../components/EquipmentCard";


export default async function Home() {
  const equipment = await prisma.equipment.findMany({
    where: {
      active: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  const indicators = [
    { label: "Lote activo", value: "AG-2026-001" },
    { label: "Etapa actual", value: "Cocción" },
    { label: "Equipos registrados", value: `${equipment.length}` },
    { label: "Equipos operando", value: `${equipment.filter((e) => e.status === "OPERANDO").length}` },
    { label: "Fermentación total", value: "24,000 L" },
    { label: "Destilación total", value: "2,550 L" },
  ];

  return (
    <main className="flex min-h-screen bg-slate-950 text-white">
    

      <div className="flex-1">
        

        <section className="mx-auto max-w-7xl px-8 py-8">
          <header className="mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-amber-400">
              MAESTRO
            </p>

            <h1 className="mt-3 text-4xl font-bold">Centro de Control</h1>

            <p className="mt-3 max-w-3xl text-slate-400">
              Conoce tu planta. Controla tu producción. Cada equipo muestra su
              capacidad, ocupación actual, estado operativo y ubicación.
            </p>
          </header>

          <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Estado general</p>
            <h2 className="mt-1 text-3xl font-semibold text-green-400">
              Planta operando
            </h2>
            <p className="mt-2 text-slate-300">
              Equipos cargados desde la base de datos:{" "}
              <span className="text-amber-400">{equipment.length}</span>
            </p>
          </section>

          <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            {indicators.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
              >
                <p className="text-sm text-slate-400">{item.label}</p>
                <p className="mt-2 text-xl font-semibold">{item.value}</p>
              </div>
            ))}
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold">
              Capacidad y estado de equipos
            </h2>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {equipment.map((item) => (
                <EquipmentCard
                  key={item.id}
                  id={item.id}                  name={item.name}
                  status={item.status}
                  current={item.currentLoad}
                  max={item.capacity}
                  unit={item.unit}
                  lot={item.location ?? undefined}
                />
              ))}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}