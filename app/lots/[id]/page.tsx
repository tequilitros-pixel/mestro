import { prisma } from "@/lib/prisma";
import MainNav from "@/components/MainNav";
import LotMenu from "@/components/LotMenu";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLotEngine } from "@/lib/services/lotEngine";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function LotDetailPage({ params }: Props) {
  const { id } = await params;

  const lot = await prisma.lot.findUnique({
    where: { id },
    include: {
      cookings: { include: { events: true } },
      millings: { include: { events: true } },
      fermentations: { include: { readings: true } },
      distillations: { include: { events: true } },
      expenses: true,
    },
  });

  if (!lot) notFound();
const engine = getLotEngine(lot);
  const lastCooking = lot.cookings.at(-1);
  const lastMilling = lot.millings.at(-1);
  const lastFermentation = lot.fermentations.at(-1);
  const lastDistillation = lot.distillations.at(-1);

  const totalCost = lot.expenses.reduce((sum, e) => sum + e.amount, 0);

  const totalLiters = lot.distillations.reduce((sum, d) => {
    return sum + d.events.reduce((s, e) => s + (e.liters ?? 0), 0);
  }, 0);

  const costPerLiter = totalLiters > 0 ? totalCost / totalLiters : 0;

  const lastFermentationReading = lastFermentation?.readings.at(-1);

  return (
    <main className="min-h-screen bg-slate-950 p-10 text-white">
      <div className="mx-auto max-w-7xl">
        <MainNav />

        <p className="text-sm uppercase tracking-[0.4em] text-amber-400">
          MAESTRO
        </p>

        <h1 className="mt-3 text-5xl font-bold">Lote {lot.code}</h1>

        <LotMenu id={lot.id} />
        <section className="mt-8 rounded-3xl bg-slate-900 p-8">
  <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
    <div>
      <p className="text-sm uppercase tracking-[0.35em] text-amber-400">
        MOTOR DEL LOTE
      </p>

      <h2 className="mt-3 text-4xl font-bold">
        {engine.status}
      </h2>

      <p className="mt-3 max-w-2xl text-slate-300">
        {engine.message}
      </p>
    </div>

    <Link
      href={engine.nextHref}
      className="rounded-2xl bg-amber-400 px-6 py-4 text-center font-bold text-slate-950"
    >
      {engine.nextAction}
    </Link>
  </div>

  <div className="mt-8">
    <div className="mb-2 flex justify-between text-sm text-slate-400">
      <span>Progreso del lote</span>
      <span>{engine.progress}%</span>
    </div>

    <div className="h-4 rounded-full bg-slate-800">
      <div
        className="h-4 rounded-full bg-amber-400"
        style={{ width: `${engine.progress}%` }}
      />
    </div>
  </div>
</section>
<section className="mt-6 rounded-3xl border border-amber-500/30 bg-slate-900 p-8">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm uppercase tracking-[0.35em] text-amber-400">
        PRÓXIMA ACCIÓN
      </p>

      <h2 className="mt-2 text-3xl font-bold">
        {engine.nextAction}
      </h2>

      <p className="mt-2 text-slate-400">
        Esta es la siguiente actividad recomendada por MAESTRO.
      </p>
    </div>

    <Link
      href={engine.nextHref}
      className="rounded-2xl bg-amber-400 px-8 py-4 font-bold text-slate-950 transition hover:scale-105"
    >
      IR →
    </Link>
  </div>

  <div className="mt-8 flex items-center gap-3">
    <span className="text-sm text-slate-400">
      Prioridad:
    </span>

    <span
      className={`rounded-full px-3 py-1 text-sm font-bold ${
        engine.priority === "ALTA"
          ? "bg-red-500 text-white"
          : engine.priority === "NORMAL"
          ? "bg-yellow-400 text-slate-900"
          : "bg-slate-700 text-white"
      }`}
    >
      {engine.priority}
    </span>
  </div>
</section>
<section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-8">
  <div className="flex items-center gap-3">
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 text-2xl">
      🧠
    </div>

    <div>
      <p className="text-sm uppercase tracking-[0.35em] text-amber-400">
        MAESTRO DICE
      </p>

      <h2 className="text-2xl font-bold">
        Recomendaciones para este lote
      </h2>
    </div>
  </div>

  <div className="mt-6 space-y-4">
    {engine.advice.map((item: string, index: number) => (
      <div
        key={index}
        className="flex items-start gap-3 rounded-xl bg-slate-800 p-4"
      >
        <span className="mt-1 text-green-400">✔</span>

        <p className="text-slate-200">
          {item}
        </p>
      </div>
    ))}
  </div>
</section>
        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <Kpi title="Etapa actual" value={lot.stage} />
          <Kpi title="Agave" value={`${lot.agaveKg.toLocaleString()} kg`} />
          <Kpi title="ART" value={lot.art ?? "-"} />
          <Kpi title="Costo/L" value={costPerLiter > 0 ? `$${costPerLiter.toFixed(2)}` : "-"} />
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <StageCard
            title="🔥 Cocción"
            status={lastCooking?.status ?? "Pendiente"}
            main={lastCooking ? `${lastCooking.agaveKg.toLocaleString()} kg` : "Sin registro"}
            detail={`${lastCooking?.events.length ?? 0} eventos`}
            href={lastCooking ? `/cooking/${lastCooking.id}` : "/cooking"}
          />

          <StageCard
            title="⚙️ Molienda"
            status={lastMilling?.status ?? "Pendiente"}
            main={lastMilling?.mashLiters ? `${lastMilling.mashLiters} L mosto` : "Sin mosto"}
            detail={
              lastMilling?.brix
                ? `Último Brix: ${lastMilling.brix}`
                : `${lastMilling?.events.length ?? 0} eventos`
            }
            href={lastMilling ? `/milling/${lastMilling.id}` : "/milling"}
          />

          <StageCard
            title="🧪 Fermentación"
            status={lastFermentation?.status ?? "Pendiente"}
            main={
              lastFermentationReading?.brix
                ? `${lastFermentationReading.brix} °Brix`
                : lastFermentation
                  ? `${lastFermentation.mustLiters} L mosto`
                  : "Sin registro"
            }
            detail={
              lastFermentationReading?.alcohol
                ? `Alcohol: ${lastFermentationReading.alcohol}%`
                : `${lastFermentation?.readings.length ?? 0} lecturas`
            }
            href={lastFermentation ? `/fermentation/${lastFermentation.id}` : "/fermentation"}
          />

          <StageCard
            title="🥃 Destilación"
            status={lastDistillation?.status ?? "Pendiente"}
            main={totalLiters > 0 ? `${totalLiters.toFixed(2)} L` : "Sin litros"}
            detail={`${lot.distillations.length} corridas`}
            href={lastDistillation ? `/distillation/${lastDistillation.id}` : "/distillation"}
          />

          <StageCard
            title="💰 Costos"
            status={totalCost > 0 ? "Registrado" : "Pendiente"}
            main={`$${totalCost.toLocaleString()}`}
            detail={costPerLiter > 0 ? `$${costPerLiter.toFixed(2)} por litro` : "Sin costo/L"}
            href={`/lots/${lot.id}/costs`}
          />

          <StageCard
            title="📊 Resultado"
            status="En análisis"
            main={totalLiters > 0 ? `${totalLiters.toFixed(2)} L producidos` : "Sin producción"}
            detail="Expediente vivo del lote"
            href={`/lots/${lot.id}`}
          />
        </section>
      </div>
    </main>
  );
}

function Kpi({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function StageCard({
  title,
  status,
  main,
  detail,
  href,
}: {
  title: string;
  status: string;
  main: string;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-3xl bg-slate-900 p-6 transition hover:bg-slate-800"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{title}</h2>
        <span className="rounded-full bg-amber-400/10 px-3 py-1 text-sm text-amber-400">
          {status}
        </span>
      </div>

      <p className="mt-6 text-4xl font-bold">{main}</p>
      <p className="mt-3 text-slate-400">{detail}</p>

      <p className="mt-6 text-amber-400">Abrir etapa →</p>
    </Link>
  );
}