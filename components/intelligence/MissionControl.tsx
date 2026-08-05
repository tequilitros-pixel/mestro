import { CheckIcon } from "@/components/ui/icons";

type Props = {
  score: number;
  level: string;
  confidence: number;
  expectedLiters: number;
  recommendation: string;
  recommendations: string[];
  alerts: string[];
};

const LEVEL_COLOR: Record<string, string> = {
  Excelente: "text-tertiary-fixed-dim",
  "Muy bueno": "text-tertiary-fixed-dim",
  Bueno: "text-secondary",
  Regular: "text-secondary",
  Crítico: "text-error",
};

export default function MissionControl({
  score,
  level,
  confidence,
  expectedLiters,
  recommendation,
  recommendations,
  alerts,
}: Props) {
  const hasAlerts = alerts.length > 0;

  const statusLabel = hasAlerts ? "Con alertas" : level;

  const statusColor = hasAlerts
    ? "text-secondary"
    : (LEVEL_COLOR[level] ?? "text-tertiary-fixed-dim");

  return (
    <section className="rounded-xl border border-outline-variant bg-surface-container p-8 shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.4em] text-outline">
            MAESTRO
          </p>

          <h2 className="mt-2 text-4xl font-black text-primary">
            Centro de Inteligencia
          </h2>
        </div>

        <div className="text-right">
          <p className="text-sm text-on-surface-variant">
            Confianza
          </p>

          <p className="text-5xl font-black text-tertiary-fixed-dim">
            {confidence}%
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <div className="rounded-xl bg-surface-container-high p-6">
          <p className="text-sm text-on-surface-variant">
            IQ DEL LOTE
          </p>

          <h3 className="mt-3 text-5xl font-black text-primary">
            {score}
          </h3>
        </div>

        <div className="rounded-xl bg-surface-container-high p-6">
          <p className="text-sm text-on-surface-variant">
            Producción esperada
          </p>

          <h3 className="mt-3 text-5xl font-black text-primary">
            {expectedLiters} L
          </h3>
        </div>

        <div className="rounded-xl bg-surface-container-high p-6">
          <p className="text-sm text-on-surface-variant">
            Estado
          </p>

          <h3 className={`mt-3 text-4xl font-black ${statusColor}`}>
            {statusLabel}
          </h3>
        </div>
      </div>

      <div className="mt-8 rounded-xl bg-surface-container-high p-6">
        <p className="font-mono text-sm uppercase tracking-widest text-outline">
          Recomendación MAESTRO
        </p>

        <div className="mt-8 rounded-xl border border-secondary/30 bg-secondary/5 p-6">
          <p className="font-mono text-sm uppercase tracking-widest text-secondary">
            Prioridad Operativa
          </p>

          <div className="mt-4 space-y-4">
            {recommendations.length === 0 ? (
              <p className="flex items-center gap-1.5 text-tertiary-fixed-dim">
                <CheckIcon className="h-4 w-4" />
                No existen acciones pendientes.
              </p>
            ) : (
              recommendations.map((item, index) => (
                <div
                  key={index}
                  className="rounded-xl bg-surface-container-highest p-4"
                >
                  <p className="text-lg text-on-surface">
                    {item}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <p className="mt-4 text-xl leading-9 text-on-surface">
          {recommendation}
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-outline-variant p-6">
        <p className="font-mono text-sm uppercase tracking-widest text-error">
          Alertas
        </p>

        <div className="mt-4 space-y-3">
          {alerts.length === 0 ? (
            <p className="flex items-center gap-1.5 text-tertiary-fixed-dim">
              <CheckIcon className="h-4 w-4" />
              No existen alertas críticas.
            </p>
          ) : (
            alerts.map((alert, index) => (
              <p
                key={index}
                className="text-secondary"
              >
                {alert}
              </p>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
