import {
  BrainIcon,
  CheckIcon,
  AlertIcon,
  InfoIcon,
  ChartLineIcon,
} from "@/components/ui/icons";

type SalaInsights = {
  resumen: string;
  fortalezas: string[];
  riesgos: string[];
  recomendaciones: string[];
  prediccion: string;
};

export default function AIInsightsCard({
  insights,
}: {
  insights: SalaInsights | null;
}) {
  if (!insights) {
    return (
      <section className="rounded-3xl border border-outline-variant bg-surface-container p-8">
        <p className="font-mono text-sm uppercase tracking-[0.35em] text-outline">
          Análisis de MAESTRO
        </p>
        <p className="mt-4 text-on-surface-variant">
          Aún no hay suficientes lotes terminados para generar un análisis con IA.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-outline-variant bg-surface-container p-8">
      <p className="flex items-center gap-2 font-mono text-sm uppercase tracking-[0.35em] text-outline">
        <BrainIcon className="h-4 w-4" />
        Análisis de MAESTRO
      </p>

      <p className="mt-4 text-lg text-on-surface">{insights.resumen}</p>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-tertiary-fixed-dim">
            <CheckIcon className="h-4 w-4" />
            Fortalezas
          </p>
          <ul className="space-y-1 text-sm text-on-surface-variant">
            {insights.fortalezas.map((item, i) => (
              <li key={i}>• {item}</li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-error">
            <AlertIcon className="h-4 w-4" />
            Riesgos
          </p>
          <ul className="space-y-1 text-sm text-on-surface-variant">
            {insights.riesgos.map((item, i) => (
              <li key={i}>• {item}</li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-primary">
            <InfoIcon className="h-4 w-4" />
            Recomendaciones
          </p>
          <ul className="space-y-1 text-sm text-on-surface-variant">
            {insights.recomendaciones.map((item, i) => (
              <li key={i}>• {item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-surface-container-high p-4">
        <p className="flex items-center gap-1.5 text-sm text-on-surface-variant">
          <ChartLineIcon className="h-4 w-4" />
          Predicción
        </p>
        <p className="mt-1 text-on-surface">{insights.prediccion}</p>
      </div>
    </section>
  );
}
