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
    <section className="rounded-3xl border border-cyan-500/30 bg-slate-900 p-8 shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-400">
            MAESTRO IA
          </p>

          <h2 className="mt-2 text-3xl font-bold text-white">
            Análisis Inteligente
          </h2>
        </div>

        <div className="text-right">
          <p className="text-sm text-slate-400">Confianza</p>

          <p className="text-4xl font-bold text-green-400">
            {confidence}%
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl bg-slate-800 p-6">
        <p className="text-sm text-slate-400">
          Calificación MAESTRO
        </p>

        <h3 className="mt-2 text-6xl font-black text-amber-400">
          {score}/100
        </h3>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-700 p-6">
        <p className="text-sm uppercase tracking-wider text-cyan-300">
          Recomendación
        </p>

        <p className="mt-3 text-lg leading-8 text-slate-200">
          {recommendation}
        </p>
      </div>
    </section>
  );
}