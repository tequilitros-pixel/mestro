import PlantHeader from "@/components/ui/PlantHeader";
import MaestroCard from "@/components/ui/MaestroCard";
import EquipmentCard from "@/components/ui/EquipmentCard";
import PlantStatusCard from "@/components/PlantStatusCard";
import { Predictor } from "@/lib/brain/Predictor";
import { ExcellenceEngine } from "@/lib/brain/ExcellenceEngine";
import AIReport from "@/components/ui/AIReport";
import { LearningEngine } from "@/lib/brain";
import { ProcessMonitor } from "@/lib/brain";
import MissionControl from "@/components/intelligence/MissionControl";

export default function PlantPage() {
  const prediction = Predictor.fromAgave({
  agaveKg: 3500,
  totalCost: 22000,
});

const excellence = ExcellenceEngine.evaluate({
  cookingTemp: 92,
  fermentationAlcohol: 6.8,
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
    <main className="min-h-screen bg-slate-950 p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8">

        <PlantHeader
          title="Destiladora del Norte"
          status="🟢 Planta saludable"
          health={96}
        />

        <section className="grid gap-5 md:grid-cols-4">
          <PlantStatusCard
            icon="🔥"
            title="Horno 1"
            value="92°C"
            status="ok"
          />

          <PlantStatusCard
            icon="⚙️"
            title="Molienda"
            value="67%"
            status="ok"
          />

          <PlantStatusCard
            icon="🧪"
            title="Tina 2"
            value="5.4%"
            status="warning"
          />

          <PlantStatusCard
            icon="🥃"
            title="Alambique 1"
            value="58°"
            status="ok"
          />
        </section>

        <MaestroCard
  message="Buenos días, José. MAESTRO analizó la planta y todo opera normalmente."
  tasks={[
    "Finalizar cocción del Horno 1",
    "Revisar pH de Tina 2",
    "Preparar Alambique 2",
  ]}
  production={`${prediction.expectedLiters.toFixed(0)} L`}
  confidence={prediction.confidence}
  
/>
<MissionControl
  score={Math.round(excellence.score)}
  confidence={prediction.confidence}
  expectedLiters={Math.round(prediction.expectedLiters)}
  recommendation={learning.recommendation}
  recommendations={monitor.recommendations}
  alerts={monitor.alerts}
/>
<AIReport
  score={Math.round(excellence.score)}
  confidence={prediction.confidence}
  recommendation={learning.recommendation}
/>
           
        <section className="grid gap-6 md:grid-cols-3">
          <EquipmentCard
  icon="🔥"
  title="Horno 1"
  status="Operando"
  value="92°C"
  href="/cooking"
/>

<EquipmentCard
  icon="🧪"
  title="Tina 2"
  status="Fermentando"
  value="5.4%"
  href="/fermentation"
/>

<EquipmentCard
  icon="🥃"
  title="Alambique 1"
  status="Destilando"
  value="58°"
  href="/distillation"
/>
          
        </section>

      </div>
    </main>
  );
}