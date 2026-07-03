import { Sidebar } from "../components/Sidebar";
import {  } from "../components/";
import { EquipmentCard } from "../components/EquipmentCard";

const equipment = [
  {
    name: "Horno 1",
    status: "Cociendo",
    current: 3500,
    max: 7000,
    unit: "kg",
    lot: "AG-2026-001",
  },
  {
    name: "Tina 1",
    status: "Disponible",
    current: 0,
    max: 6000,
    unit: "L",
  },
  {
    name: "Tina 2",
    status: "Disponible",
    current: 0,
    max: 6000,
    unit: "L",
  },
  {
    name: "Tina 3",
    status: "Disponible",
    current: 0,
    max: 6000,
    unit: "L",
  },
  {
    name: "Tina 4",
    status: "Disponible",
    current: 0,
    max: 6000,
    unit: "L",
  },
  {
    name: "Alambique 1",
    status: "Disponible",
    current: 0,
    max: 1000,
    unit: "L",
  },
  {
    name: "Alambique 2",
    status: "Disponible",
    current: 0,
    max: 1000,
    unit: "L",
  },
  {
    name: "Alambique 3",
    status: "Disponible",
    current: 0,
    max: 1000,
    unit: "L",
  },
];

export default function Home() {
  return (
    <main className="flex min-h-screen bg-slate-950 text-white">
      <Sidebar />

      <div className="flex-1">
        < />

        <section className="mx-auto max-w-7xl px-8 py-8">
          <header className="mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-amber-400">
              MAESTRO
            </p>

            <h1 className="mt-3 text-4xl font-bold">
              Centro de Control
            </h1>

            <p className="mt-3 max-w-3xl text-slate-400">
              Conoce tu planta. Controla tu producción. Cada equipo muestra su
              capacidad, ocupación actual, estado operativo y lote relacionado.
            </p>
          </header>

          <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Lote activo</p>
            <h2 className="mt-1 text-3xl font-semibold">AG-2026-001</h2>
            <p className="mt-2 text-slate-300">
              Etapa actual: <span className="text-amber-400">Cocción</span>
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold">
              Capacidad y estado de equipos
            </h2>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {equipment.map((item) => (
                <EquipmentCard
                  key={item.name}
                  name={item.name}
                  status={item.status}
                  current={item.current}
                  max={item.max}
                  unit={item.unit}
                  lot={item.lot}
                />
              ))}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}