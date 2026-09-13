"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartPanel } from "@/components/ui/CompactUI";

const COLORS = [
  "var(--color-primary)",
  "var(--color-tertiary-fixed-dim)",
  "var(--color-secondary)",
  "var(--color-error)",
  "var(--color-on-surface-variant)",
];

const tooltipStyle = {
  background: "var(--color-surface-container-high)",
  border: "1px solid var(--color-outline-variant)",
  borderRadius: "0.75rem",
  color: "var(--color-on-surface)",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(value);

export function ExpensesCharts({
  byCategory,
  byDay,
}: {
  byCategory: Array<{ name: string; value: number }>;
  byDay: Array<{ label: string; amount: number }>;
}) {
  if (byCategory.length === 0) {
    return <p className="text-sm text-on-surface-variant">No hay datos para graficar con los filtros seleccionados.</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartPanel title="Salidas por día">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byDay} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" />
              <XAxis dataKey="label" stroke="var(--color-outline)" fontSize={11} />
              <YAxis stroke="var(--color-outline)" fontSize={12} tickFormatter={(value) => formatCurrency(Number(value))} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatCurrency(Number(value)), "Salidas"]} />
              <Bar dataKey="amount" name="Salidas" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
      </ChartPanel>

      <ChartPanel title="Distribución por categoría">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                {byCategory.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatCurrency(Number(value)), "Salidas"]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
      </ChartPanel>
    </div>
  );
}
