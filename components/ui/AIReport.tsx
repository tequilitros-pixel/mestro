type Props = {
  score: number;
  recommendation: string;
  confidence: number;
};

export default function AIReport({
  score,
  recommendation,
  confidence,
}: Props) {
  return (
    <section className="surface-sheen rounded-xl border border-outline-variant bg-surface-container p-8 shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-on-surface-variant">
            MAESTRO IA
          </p>

          <h2 className="mt-2 text-3xl font-bold text-primary">
            Análisis Inteligente
          </h2>
        </div>

        <div className="text-right">
          <p className="text-sm text-on-surface-variant">Confianza</p>

          <p className="text-4xl font-bold text-tertiary-fixed-dim">
            {confidence}%
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-xl bg-surface-container-high p-6">
        <p className="text-sm text-on-surface-variant">
          Calificación MAESTRO
        </p>

        <h3 className="mt-2 text-6xl font-black text-primary">
          {score}/100
        </h3>
      </div>

      <div className="mt-6 rounded-xl border border-outline-variant p-6">
        <p className="font-mono text-sm uppercase tracking-wider text-on-surface-variant">
          Recomendación
        </p>

        <p className="mt-3 text-lg leading-8 text-on-surface">
          {recommendation}
        </p>
      </div>
    </section>
  );
}