type Props = {
  score: number;
  confidence: number;
  expectedLiters: number;
  recommendation: string;
  recommendations: string[];
  alerts: string[];
};

export default function MissionControl({
  score,
  confidence,
  expectedLiters,
  recommendation,
  recommendations,
  alerts,
}: Props) {
  return (
    <section className="rounded-3xl border border-cyan-500/30 bg-slate-900 p-8 shadow-xl">

      <div className="flex items-center justify-between">

        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-cyan-400">
            MAESTRO
          </p>

          <h2 className="mt-2 text-4xl font-black text-white">
            Centro de Inteligencia
          </h2>
        </div>

        <div className="text-right">
          <p className="text-sm text-slate-400">
            Confianza
          </p>

          <p className="text-5xl font-black text-green-400">
            {confidence}%
          </p>
        </div>

      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-3">

        <div className="rounded-2xl bg-slate-800 p-6">

          <p className="text-sm text-slate-400">
            IQ DEL LOTE
          </p>

          <h3 className="mt-3 text-5xl font-black text-amber-400">
            {score}
          </h3>

        </div>

        <div className="rounded-2xl bg-slate-800 p-6">

          <p className="text-sm text-slate-400">
            Producción esperada
          </p>

          <h3 className="mt-3 text-5xl font-black text-white">
            {expectedLiters} L
          </h3>

        </div>

        <div className="rounded-2xl bg-slate-800 p-6">

          <p className="text-sm text-slate-400">
            Estado
          </p>

          <h3 className="mt-3 text-4xl font-black text-green-400">
            Saludable
          </h3>

        </div>

      </div>

      <div className="mt-8 rounded-2xl bg-slate-800 p-6">

        <p className="text-sm uppercase tracking-widest text-cyan-300">
          Recomendación MAESTRO
        </p>
        <div className="mt-8 rounded-2xl bg-cyan-950/40 border border-cyan-700 p-6">

  <p className="text-sm uppercase tracking-widest text-cyan-300">
    Prioridad Operativa
  </p>

  <div className="mt-4 space-y-4">

    {recommendations.length === 0 ? (

      <p className="text-green-400">
        ✔ No existen acciones pendientes.
      </p>

    ) : (

      recommendations.map((item, index) => (

        <div
          key={index}
          className="rounded-xl bg-slate-800 p-4"
        >

          <p className="text-lg text-slate-200">
            {item}
          </p>

        </div>

      ))

    )}

  </div>

</div>

        <p className="mt-4 text-xl leading-9 text-slate-200">
          {recommendation}
        </p>

      </div>

      <div className="mt-8 rounded-2xl border border-slate-700 p-6">

        <p className="text-sm uppercase tracking-widest text-red-300">
          Alertas
        </p>

        <div className="mt-4 space-y-3">

          {alerts.length === 0 ? (
            <p className="text-green-400">
              ✔ No existen alertas críticas.
            </p>
          ) : (
            alerts.map((alert, index) => (
              <p
                key={index}
                className="text-amber-300"
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