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
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
        <p className="text-sm uppercase tracking-[0.35em] text-amber-400">
          Análisis de MAESTRO
        </p>
        <p className="mt-4 text-slate-400">
          Aún no hay suficientes lotes terminados para generar un análisis con IA.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
      <p className="text-sm uppercase tracking-[0.35em] text-amber-400">
        🧠 Análisis de MAESTRO
      </p>

      <p className="mt-4 text-lg text-white">{insights.resumen}</p>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <div>
          <p className="mb-2 text-sm font-semibold text-green-400">
            ✅ Fortalezas
          </p>
          <ul className="space-y-1 text-sm text-slate-300">
            {insights.fortalezas.map((item, i) => (
              <li key={i}>• {item}</li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-red-400">
            ⚠️ Riesgos
          </p>
          <ul className="space-y-1 text-sm text-slate-300">
            {insights.riesgos.map((item, i) => (
              <li key={i}>• {item}</li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-amber-400">
            💡 Recomendaciones
          </p>
          <ul className="space-y-1 text-sm text-slate-300">
            {insights.recomendaciones.map((item, i) => (
              <li key={i}>• {item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-slate-800 p-4">
        <p className="text-sm text-slate-400">📈 Predicción</p>
        <p className="mt-1 text-white">{insights.prediccion}</p>
      </div>
    </section>
  );
}
