import MissionControl from "@/components/intelligence/MissionControl";
import EquipmentCard from "@/components/ui/EquipmentCard";
import MaestroCard from "@/components/ui/MaestroCard";
import { ExcellenceEngine, LearningEngine, Predictor } from "@/lib/brain";
import { getActiveProcesses } from "@/lib/brain/data/getActiveProcesses";
import { analyzeActiveProcesses } from "@/lib/brain/analyzeActiveProcesses";

export default async function ControlRoomPage() {
  const { cookings, fermentations, distillations } = await getActiveProcesses();
  const { alerts, recommendations } = await analyzeActiveProcesses();

  const totalAgaveKg = cookings.reduce((sum, c) => sum + c.agaveKg, 0);

  const prediction = Predictor.fromAgave({
    agaveKg: totalAgaveKg,
    totalCost: 22000,
  });

  const latestCooking = cookings[0];
  const latestCookingTemp = latestCooking?.events.find(
    (e) => e.temperature != null
  )?.temperature;

  const latestFermentation = fermentations[0];
  const latestAlcohol = latestFermentation?.readings.find(
    (r) => r.alcohol != null
  )?.alcohol;

  const excellence = ExcellenceEngine.evaluate({
    cookingTemp: latestCookingTemp ?? undefined,
    fermentationAlcohol: latestAlcohol ?? undefined,
  });

  const learning = LearningEngine.summary();

  const alertMessages = alerts.map((a) => `${a.source}: ${a.message}`);

  return (
    <main className="space-y-8">
      <section>
        <p className="text-sm uppercase tracking-[0.4em] text-amber-400">
          MAESTRO
        </p>

        <h1 className="mt-3 text-5xl font-black text-white">
          Sala de Control
        </h1>

        <p className="mt-3 max-w-3xl text-slate-400">
          Vista ejecutiva de operación, inteligencia y decisiones de la planta.
        </p>
      </section>

      <MissionControl
        score={Math.round(excellence.score)}
        confidence={prediction.confidence}
        expectedLiters={Math.round(prediction.expectedLiters)}
        recommendation={learning.recommendation}
        recommendations={recommendations}
        alerts={alertMessages}
      />

      <section className="grid gap-6 xl:grid-cols-3">
        <MaestroCard
          message={
            alertMessages.length > 0
              ? "Buenos días. Detecté observaciones que requieren atención en el proceso."
              : "Buenos días. Analicé la planta y no detecto riesgos críticos."
          }
          tasks={
            recommendations.length > 0
              ? recommendations
              : ["Sin acciones pendientes."]
          }
          production={`${Math.round(prediction.expectedLiters)} L`}
          confidence={prediction.confidence}
          href="/plant"
        />

        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 xl:col-span-2">
          <p className="text-sm uppercase tracking-[0.35em] text-amber-400">
            Planta en vivo
          </p>

          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {cookings.map((cooking) => {
              const temp = cooking.events.find((e) => e.temperature != null)
                ?.temperature;

              return (
                <EquipmentCard
                  key={cooking.id}
                  icon="🔥"
                  title={cooking.equipment.name}
                  status="OPERANDO"
                  lot={cooking.lot.code}
                  value={temp != null ? `${temp}°C` : "Sin lectura"}
                  subtitle={`Desde ${cooking.startedAt.toLocaleString("es-MX", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`}
                  href="/cooking"
                  tone="green"
                />
              );
            })}

            {fermentations.map((fermentation) => {
              const alcohol = fermentation.readings.find(
                (r) => r.alcohol != null
              )?.alcohol;

              return (
                <EquipmentCard
                  key={fermentation.id}
                  icon="🧪"
                  title={fermentation.tank}
                  status="OPERANDO"
                  lot={fermentation.lot.code}
                  value={alcohol != null ? `${alcohol}%` : "Sin lectura"}
                  subtitle="Alcohol actual"
                  href="/fermentation"
                  tone="yellow"
                />
              );
            })}

            {distillations.map((distillation) => {
              const alcohol = distillation.events.find(
                (e) => e.alcohol != null
              )?.alcohol;

              return (
                <EquipmentCard
                  key={distillation.id}
                  icon="🥃"
                  title={distillation.equipment.name}
                  status="OPERANDO"
                  lot={distillation.lot.code}
                  value={alcohol != null ? `${alcohol}%` : "Sin lectura"}
                  subtitle="Grado actual"
                  href="/distillation"
                  tone="blue"
                />
              );
            })}

            {cookings.length === 0 &&
              fermentations.length === 0 &&
              distillations.length === 0 && (
                <p className="text-slate-400 md:col-span-3">
                  No hay procesos activos en este momento.
                </p>
              )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-4">
        <Kpi title="Producción esperada" value={`${Math.round(prediction.expectedLiters)} L`} />
        <Kpi title="IQ del lote" value={`${Math.round(excellence.score)}/100`} />
        <Kpi title="Confianza" value={`${prediction.confidence}%`} />
        <Kpi title="Alertas" value={alertMessages.length} />
      </section>
    </main>
  );
}

function Kpi({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-3 text-4xl font-black text-white">{value}</p>
    </div>
  );
}
