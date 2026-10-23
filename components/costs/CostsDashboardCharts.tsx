"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { ReactElement } from "react";

const CATEGORY_COLORS: Record<string, string> = {
  "Materia prima": "#10b981",
  "Cocción": "#f97316",
  "Molienda": "#eab308",
  "Fermentación": "#06b6d4",
  "Destilación": "#8b5cf6",
  "Envasado": "#ec4899",
  "Transporte": "#64748b",
  "Mano de obra": "#3b82f6",
  "Otros": "#94a3b8",
};

const DEFAULT_COLORS = [
  "#10b981",
  "#3b82f6",
  "#f97316",
  "#8b5cf6",
  "#eab308",
  "#06b6d4",
  "#ec4899",
  "#64748b",
];

const tooltipStyle = {
  backgroundColor: "var(--color-surface-container-high, #1e1e1e)",
  border: "1px solid var(--color-outline-variant, #444)",
  borderRadius: "0.75rem",
  color: "var(--color-on-surface, #fff)",
  fontSize: "0.75rem",
};

type LotCostSummary = {
  code: string;
  cost: number;
  liters: number;
  costPerLiter: number;
};

type CategorySummary = {
  category: string;
  amount: number;
};

export default function CostsDashboardCharts({
  lotSummaries,
  categorySummaries,
}: {
  lotSummaries: LotCostSummary[];
  categorySummaries: CategorySummary[];
}) {
  const hasLots = lotSummaries.length > 0;
  const hasCategories = categorySummaries.length > 0;

  if (!hasLots && !hasCategories) {
    return null;
  }

  return (
    <section className="mb-6 space-y-6 rounded-2xl border border-outline-variant bg-surface-container p-5 sm:p-6">
      <div>
        <h2 className="text-base font-bold text-on-surface">Análisis gráfico de costos de producción</h2>
        <p className="text-xs text-on-surface-variant">
          Comparativa de costo unitario por lote y desglose presupuestal por fase operativa del proceso tequilero.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Gráfico 1: Costo por litro por Lote */}
        {hasLots && (
          <Chart title="Costo unitario ($ MXN por litro) por lote">
            <BarChart
              data={lotSummaries.filter((l) => l.costPerLiter > 0)}
              margin={{ top: 10, right: 20, left: 10, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant, #333)" />
              <XAxis
                dataKey="code"
                stroke="var(--color-outline, #888)"
                fontSize={11}
                tick={{ fill: "var(--color-outline, #888)" }}
              />
              <YAxis
                unit=" $"
                stroke="var(--color-outline, #888)"
                fontSize={11}
                tick={{ fill: "var(--color-outline, #888)" }}
                tickFormatter={(val) => `$${Number(val).toFixed(0)}`}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value) => [`$${Number(value).toFixed(2)} MXN`, "Costo / Litro"]}
              />
              <Legend verticalAlign="top" height={36} />
              <Bar
                dataKey="costPerLiter"
                name="Costo por litro ($/L)"
                fill="#3b82f6"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </Chart>
        )}

        {/* Gráfico 2: Desglose por categoría */}
        {hasCategories && (
          <Chart title="Distribución de gastos por etapa o concepto ($ MXN)">
            <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value) => [`$${Number(value).toLocaleString("es-MX", { maximumFractionDigits: 2 })} MXN`, "Gasto"]}
              />
              <Legend verticalAlign="bottom" height={40} />
              <Pie
                data={categorySummaries}
                dataKey="amount"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={3}
              >
                {categorySummaries.map((entry, index) => (
                  <Cell
                    key={`cell-${entry.category || index}`}
                    fill={CATEGORY_COLORS[entry.category] ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          </Chart>
        )}
      </div>
    </section>
  );
}

function Chart({
  title,
  children,
}: {
  title: string;
  children: ReactElement;
}) {
  return (
    <div className="rounded-xl border border-outline-variant/60 bg-surface-container-high p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-on-surface">{title}</h3>
      <div className="h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
