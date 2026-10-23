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

type ExpenseItem = {
  category: string;
  amount: number;
};

export default function LotCostCharts({
  expenses,
}: {
  expenses: ExpenseItem[];
}) {
  if (expenses.length === 0) {
    return null;
  }

  // Agrupar gastos por categoría
  const categoryMap = new Map<string, number>();
  expenses.forEach((e) => {
    const current = categoryMap.get(e.category) ?? 0;
    categoryMap.set(e.category, current + e.amount);
  });

  const categoryData = Array.from(categoryMap.entries()).map(([category, amount]) => ({
    category,
    amount,
  }));

  return (
    <section className="mt-8 space-y-6 rounded-2xl border border-outline-variant bg-surface-container p-6 sm:p-8">
      <div>
        <h2 className="text-xl font-bold text-on-surface">Gráficas de costos del lote</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Desglose visual por etapa productiva (materia prima, energía, insumos y mano de obra).
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Chart title="Gastos por categoría ($ MXN)">
          <BarChart data={categoryData} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant, #333)" />
            <XAxis
              dataKey="category"
              stroke="var(--color-outline, #888)"
              fontSize={11}
              tick={{ fill: "var(--color-outline, #888)" }}
            />
            <YAxis
              unit=" $"
              stroke="var(--color-outline, #888)"
              fontSize={11}
              tick={{ fill: "var(--color-outline, #888)" }}
              tickFormatter={(val) => `$${Number(val).toLocaleString()}`}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value) => [`$${Number(value).toLocaleString("es-MX", { maximumFractionDigits: 2 })} MXN`, "Monto"]}
            />
            <Legend verticalAlign="top" height={36} />
            <Bar dataKey="amount" name="Costo acumulado ($)" fill="#10b981" radius={[6, 6, 0, 0]}>
              {categoryData.map((entry, index) => (
                <Cell
                  key={`cell-bar-${entry.category || index}`}
                  fill={CATEGORY_COLORS[entry.category] ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </Chart>

        <Chart title="Proporción del gasto (%)">
          <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value) => [`$${Number(value).toLocaleString("es-MX", { maximumFractionDigits: 2 })} MXN`, "Gasto"]}
            />
            <Legend verticalAlign="bottom" height={40} />
            <Pie
              data={categoryData}
              dataKey="amount"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={80}
              paddingAngle={3}
            >
              {categoryData.map((entry, index) => (
                <Cell
                  key={`cell-pie-${entry.category || index}`}
                  fill={CATEGORY_COLORS[entry.category] ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                />
              ))}
            </Pie>
          </PieChart>
        </Chart>
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
