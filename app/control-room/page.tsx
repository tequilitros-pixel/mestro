import { analyzeLotHistory } from "@/lib/brain/analyzeLotHistory";
import LotComparisonCharts from "@/components/ui/LotComparisonCharts";
import { getSalaInsights } from "@/lib/ai/getSalaInsights";
import AIInsightsCard from "@/components/ui/AIInsightsCard";

const TREND_LABEL: Record<string, string> = {
  MEJORANDO: "📈 Mejorando",
  EMPEORANDO: "📉 Empeorando",
  ESTABLE: "➡️ Estable",
  SIN_DATOS: "Sin datos suficientes",
};

export default async function ControlRoomPage() {
  const {
    lots,
    averageExtraction,
    averageCookingHours,
    averageCostPerLiter,
    bestLot,
    worstLot,
    trend,
  } = await analyzeLotHistory();

  const aiInsights = await getSalaInsights();

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
          Historial y comparación de lotes terminados. Aquí MAESTRO aprende de la producción a lo largo del tiempo.
        </p>
      </section>

      <AIInsightsCard insights={aiInsights} />

      <section className="grid gap-6 md:grid-cols-4">
        <Kpi title="Lotes terminados" value={lots.length} />
        <Kpi
          title="Extracción promedio"
          value={averageExtraction != null ? `${averageExtraction.toFixed(1)}%` : "—"}
        />
        <Kpi
          title="Costo promedio por litro"
          value={averageCostPerLiter != null ? `$${averageCostPerLiter.toFixed(2)}` : "—"}
        />
        <Kpi
          title="Horas de cocción promedio"
          value={averageCookingHours != null ? `${averageCookingHours.toFixed(1)}h` : "—"}
        />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Tendencia de extracción</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {TREND_LABEL[trend.extraction]}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Tendencia de costo por litro</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {TREND_LABEL[trend.costPerLiter]}
          </p>
        </div>
      </section>

      {(bestLot || worstLot) && (
        <section className="grid gap-6 md:grid-cols-2">
          {bestLot && (
            <div className="rounded-2xl border border-green-800 bg-green-950/30 p-6">
              <p className="text-sm text-green-400">🏆 Mejor lote (más litros)</p>
              <p className="mt-2 text-xl font-bold text-white">{bestLot.code}</p>
              <p className="text-slate-400">
                {bestLot.litersProduced}L · {bestLot.extraction}% extracción · ${bestLot.costPerLiter?.toFixed(2)}/L
              </p>
            </div>
          )}
          {worstLot && worstLot.lotId !== bestLot?.lotId && (
            <div className="rounded-2xl border border-red-800 bg-red-950/30 p-6">
              <p className="text-sm text-red-400">⚠️ Lote con menor producción</p>
              <p className="mt-2 text-xl font-bold text-white">{worstLot.code}</p>
              <p className="text-slate-400">
                {worstLot.litersProduced}L · {worstLot.extraction}% extracción · ${worstLot.costPerLiter?.toFixed(2)}/L
              </p>
            </div>
          )}
        </section>
      )}

      <LotComparisonCharts lots={lots} />
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
