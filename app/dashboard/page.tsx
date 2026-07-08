import { prisma } from "@/lib/prisma";
import MainNav from "@/components/MainNav";

export default async function DashboardPage() {
  const lots = await prisma.lot.count();

  const fermenting = await prisma.fermentation.count({
    where: { status: "ACTIVA" },
  });

  const distilling = await prisma.distillation.count({
    where: { status: "ACTIVA" },
  });

  const finished = await prisma.distillation.count({
    where: { status: "TERMINADA" },
  });

  const distillations = await prisma.distillation.findMany({
    include: { events: true },
  });

  const totalLiters = distillations.reduce((sum, distillation) => {
    const liters = distillation.events.reduce(
      (s, event) => s + (event.liters ?? 0),
      0
    );

    return sum + liters;
  }, 0);

  const finishedLots = await prisma.lot.findMany({
    include: {
      distillations: {
        include: { events: true },
      },
      expenses: true,
    },
  });

  const averageYield =
    finishedLots.length === 0
      ? 0
      : finishedLots.reduce((sum, lot) => {
          const loaded = lot.distillations.reduce(
            (s, distillation) => s + (distillation.loadedLiters ?? 0),
            0
          );

          const produced = lot.distillations.reduce((s, distillation) => {
            return (
              s +
              distillation.events.reduce(
                (x, event) => x + (event.liters ?? 0),
                0
              )
            );
          }, 0);

          if (loaded === 0) return sum;

          return sum + (produced / loaded) * 100;
        }, 0) / finishedLots.length;

  return (
    <main className="min-h-screen bg-slate-950 p-10 text-white">
      <div className="mx-auto max-w-7xl">
        <MainNav />

        <p className="text-sm uppercase tracking-[0.4em] text-amber-400">
          MAESTRO
        </p>

        <h1 className="mt-3 text-5xl font-bold">Dashboard Ejecutivo</h1>

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <Card title="Lotes" value={lots} color="bg-blue-600" />

          <Card title="Fermentando" value={fermenting} color="bg-green-600" />

          <Card title="Destilando" value={distilling} color="bg-amber-500" />

          <Card title="Terminados" value={finished} color="bg-purple-600" />

          <Card
            title="Litros producidos"
            value={Number(totalLiters.toFixed(0))}
            color="bg-cyan-600"
          />

          <Card
            title="Eficiencia promedio"
            value={`${averageYield.toFixed(1)} %`}
            color="bg-green-600"
          />
        </div>
      </div>
    </main>
  );
}

function Card({
  title,
  value,
  color,
}: {
  title: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className={`rounded-2xl ${color} p-6 shadow-lg`}>
      <p className="text-sm uppercase tracking-wider text-white/80">{title}</p>

      <p className="mt-3 text-4xl font-bold text-white">{value}</p>
    </div>
  );
}