import type { ComponentType } from "react";
import { analyzeLotHistory } from "@/lib/brain/analyzeLotHistory";
import LotComparisonCharts from "@/components/ui/LotComparisonCharts";
import { getSalaInsights } from "@/lib/ai/getSalaInsights";
import AIInsightsCard from "@/components/ui/AIInsightsCard";
import {
  type IconProps,
  ArrowUpRightIcon,
  ArrowDownRightIcon,
  ArrowRightIcon,
  CheckIcon,
  AlertIcon,
} from "@/components/ui/icons";

const TREND_INFO: Record<
  string,
  { icon: ComponentType<IconProps>; label: string; tone: string }
> = {
  MEJORANDO: { icon: ArrowUpRightIcon, label: "Mejorando", tone: "text-tertiary-fixed-dim" },
  EMPEORANDO: { icon: ArrowDownRightIcon, label: "Empeorando", tone: "text-error" },
  ESTABLE: { icon: ArrowRightIcon, label: "Estable", tone: "text-on-surface-variant" },
  SIN_DATOS: { icon: ArrowRightIcon, label: "Sin datos suficientes", tone: "text-on-surface-variant" },
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
        <p className="font-mono text-sm uppercase tracking-[0.4em] text-on-surface-variant">
          MAESTRO
        </p>

        <h1 className="mt-3 text-5xl font-black text-on-surface">
          Sala de Control
        </h1>

        <p className="mt-3 max-w-3xl text-on-surface-variant">
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
        <TrendCard label="Tendencia de extracción" trendKey={trend.extraction} />
        <TrendCard label="Tendencia de costo por litro" trendKey={trend.costPerLiter} />
      </section>

      {(bestLot || worstLot) && (
        <section className="grid gap-6 md:grid-cols-2">
          {bestLot && (
            <div className="rounded-2xl border border-tertiary-fixed-dim/30 bg-tertiary-fixed-dim/10 p-6">
              <p className="flex items-center gap-1.5 text-sm text-tertiary-fixed-dim">
                <CheckIcon className="h-4 w-4 shrink-0" />
                Mejor lote (más litros)
              </p>
              <p className="mt-2 text-xl font-bold text-on-surface">{bestLot.code}</p>
              <p className="text-on-surface-variant">
                {bestLot.litersProduced}L · {bestLot.extraction}% extracción · ${bestLot.costPerLiter?.toFixed(2)}/L
              </p>
            </div>
          )}
          {worstLot && worstLot.lotId !== bestLot?.lotId && (
            <div className="rounded-2xl border border-error/30 bg-error/10 p-6">
              <p className="flex items-center gap-1.5 text-sm text-error">
                <AlertIcon className="h-4 w-4 shrink-0" />
                Lote con menor producción
              </p>
              <p className="mt-2 text-xl font-bold text-on-surface">{worstLot.code}</p>
              <p className="text-on-surface-variant">
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
    <div className="rounded-3xl border border-outline-variant bg-surface-container p-6">
      <p className="text-sm text-on-surface-variant">{title}</p>
      <p className="mt-3 text-4xl font-black text-on-surface">{value}</p>
    </div>
  );
}

function TrendCard({
  label,
  trendKey,
}: {
  label: string;
  trendKey: string;
}) {
  const info = TREND_INFO[trendKey] ?? TREND_INFO.SIN_DATOS;
  const TrendGlyph = info.icon;

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container p-6">
      <p className="text-sm text-on-surface-variant">{label}</p>
      <p className={`mt-2 flex items-center gap-2 text-2xl font-bold ${info.tone}`}>
        <TrendGlyph className="h-5 w-5 shrink-0" />
        {info.label}
      </p>
    </div>
  );
}
