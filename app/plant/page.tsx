import PlantHeader from "@/components/ui/PlantHeader";
import MaestroCard from "@/components/ui/MaestroCard";
import EquipmentCard from "@/components/ui/EquipmentCard";
import PlantStatusCard from "@/components/PlantStatusCard";
import { Predictor } from "@/lib/brain/Predictor";
import { ExcellenceEngine } from "@/lib/brain/ExcellenceEngine";
import AIReport from "@/components/ui/AIReport";
import { LearningEngine } from "@/lib/brain";
import MissionControl from "@/components/intelligence/MissionControl";
import { getActiveProcesses } from "@/lib/brain/data/getActiveProcesses";
import { analyzeActiveProcesses } from "@/lib/brain/analyzeActiveProcesses";

export default async function PlantPage() {
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
    <main className="min-h-screen bg-slate-950 p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8">

        <PlantHeader
          title="Destiladora del Norte"
          status={alertMessages.length > 0 ? "🟡 Planta con observaciones" : "🟢 Planta saludable"}
          health={96}
        />

        <section className="grid gap-5 md:grid-cols-4">
          {cookings.map((cooking) => {
            const temp = cooking.events.find((e) => e.temperature != null)
              ?.temperature;
            return (
              <PlantStatusCard
                key={cooking.id}
                icon="🔥"
                title={cooking.equipment.name}
                value={temp != null ? `${temp}°C` : "Sin lectura"}
                status="ok"
              />
            );
          })}

          {fermentations.map((fermentation) => {
            const alcohol = fermentation.readings.find(
              (r) => r.alcohol != null
            )?.alcohol;
            const hasAlert = alertMessages.some((m) =>
              m.startsWith(fermentation.tank)
            );
            return (
              <PlantStatusCard
                key={fermentation.id}
                icon="🧪"
                title={fermentation.tank}
                value={alcohol != null ? `${alcohol}%` : "Sin lectura"}
                status={hasAlert ? "warning" : "ok"}
              />
            );
          })}

          {distillations.map((distillation) => {
            const alcohol = distillation.events.find(
              (e) => e.alcohol != null
            )?.alcohol;
            return (
              <PlantStatusCard
                key={distillation.id}
                icon="🥃"
                title={distillation.equipment.name}
                value={alcohol != null ? `${alcohol}°` : "Sin lectura"}
                status="ok"
              />
            );
          })}

          {cookings.length === 0 &&
            fermentations.length === 0 &&
            distillations.length === 0 && (
              <p className="text-slate-400 md:col-span-4">
                No hay procesos activos en este momento.
              </p>
            )}
        </section>

        <MaestroCard
          message={
            alertMessages.length > 0
              ? "Buenos días, José. Detecté observaciones que requieren atención."
              : "Buenos días, José. MAESTRO analizó la planta y todo opera normalmente."
          }
          tasks={recommendations.length > 0 ? recommendations : ["Sin acciones pendientes."]}
          production={`${prediction.expectedLiters.toFixed(0)} L`}
          confidence={prediction.confidence}
        />

        <MissionControl
          score={Math.round(excellence.score)}
          confidence={prediction.confidence}
          expectedLiters={Math.round(prediction.expectedLiters)}
          recommendation={learning.recommendation}
          recommendations={recommendations}
          alerts={alertMessages}
        />

        <AIReport
          score={Math.round(excellence.score)}
          confidence={prediction.confidence}
          recommendation={learning.recommendation}
        />

        <section className="grid gap-6 md:grid-cols-3">
          {cookings.map((cooking) => {
            const temp = cooking.events.find((e) => e.temperature != null)
              ?.temperature;
            return (
              <EquipmentCard
                key={cooking.id}
                icon="🔥"
                title={cooking.equipment.name}
                status="Operando"
                value={temp != null ? `${temp}°C` : "Sin lectura"}
                href="/cooking"
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
                status="Fermentando"
                value={alcohol != null ? `${alcohol}%` : "Sin lectura"}
                href="/fermentation"
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
                status="Destilando"
                value={alcohol != null ? `${alcohol}°` : "Sin lectura"}
                href="/distillation"
              />
            );
          })}
        </section>

      </div>
    </main>
  );
}
