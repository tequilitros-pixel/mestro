import MissionControl from "@/components/intelligence/MissionControl";
import EquipmentCard from "@/components/ui/EquipmentCard";
import MaestroCard from "@/components/ui/MaestroCard";
import { ExcellenceEngine, LearningEngine, Predictor, ProcessMonitor } from "@/lib/brain";

export default function ControlRoomPage() {
  const prediction = Predictor.fromAgave({
    agaveKg: 3500,
    totalCost: 22000,
  });

  const excellence = ExcellenceEngine.evaluate({
    cookingTemp: 92,
    fermentationAlcohol: 5.4,
    extraction: 90,
  });

  const learning = LearningEngine.summary();

  const monitor = ProcessMonitor.analyze({
    cookingTemp: 92,
    cookingHours: 33,
    fermentationAlcohol: 5.4,
    fermentationPH: 4.6,
    extraction: 90,
  });

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
        recommendations={monitor.recommendations}
        alerts={monitor.alerts}
      />

      <section className="grid gap-6 xl:grid-cols-3">
        <MaestroCard
          message="Buenos días, José. Analicé la planta y no detecto riesgos críticos."
          tasks={[
            "No destilar Tina 2 todavía",
            "Mantener cocción estable en 92°C",
            "Preparar Alambique 2",
          ]}
          production={`${Math.round(prediction.expectedLiters)} L`}
          confidence={prediction.confidence}
          href="/plant"
        />

        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 xl:col-span-2">
          <p className="text-sm uppercase tracking-[0.35em] text-amber-400">
            Planta en vivo
          </p>

          <div className="mt-6 grid gap-5 md:grid-cols-3">
            <EquipmentCard
              icon="🔥"
              title="Horno 1"
              status="OPERANDO"
              lot="AG-2026-001"
              value="92°C"
              subtitle="33 horas"
              href="/cooking"
              tone="green"
            />

            <EquipmentCard
              icon="🧪"
              title="Tina 2"
              status="ESPERAR"
              lot="AG-2026-001"
              value="5.4%"
              subtitle="Alcohol actual"
              href="/fermentation"
              tone="yellow"
            />

            <EquipmentCard
              icon="🥃"
              title="Alambique 2"
              status="PREPARAR"
              value="Libre"
              subtitle="Disponible"
              href="/distillation"
              tone="blue"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-4">
        <Kpi title="Producción esperada" value={`${Math.round(prediction.expectedLiters)} L`} />
        <Kpi title="IQ del lote" value={`${Math.round(excellence.score)}/100`} />
        <Kpi title="Confianza" value={`${prediction.confidence}%`} />
        <Kpi title="Alertas" value={monitor.alerts.length} />
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