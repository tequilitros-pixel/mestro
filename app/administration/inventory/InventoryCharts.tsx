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

const CHART_COLORS = [
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

const currency = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);

const units = (value: number) =>
  new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(value);

/** Ranking horizontal: productos, categorías o sucursales. */
export function InventoryRankingChart({
  data,
  valueLabel,
  money = false,
}: {
  data: Array<{ name: string; value: number }>;
  valueLabel: string;
  money?: boolean;
}) {
  return (
    <div style={{ height: Math.max(200, data.length * 42) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-outline-variant)"
            horizontal={false}
          />
          <XAxis
            type="number"
            stroke="var(--color-outline)"
            fontSize={12}
            tickFormatter={(v) => (money ? currency(Number(v)) : units(Number(v)))}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="var(--color-outline)"
            fontSize={12}
            width={160}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => [
              money ? currency(Number(value)) : units(Number(value)),
              valueLabel,
            ]}
          />
          <Bar dataKey="value" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Entradas vs salidas por día. */
export function InventoryFlowChart({
  data,
}: {
  data: Array<{ label: string; consumed: number; received: number }>;
}) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" />
          <XAxis dataKey="label" stroke="var(--color-outline)" fontSize={11} />
          <YAxis stroke="var(--color-outline)" fontSize={12} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => [units(Number(value)), name]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="received"
            name="Entradas"
            fill="var(--color-tertiary-fixed-dim)"
            radius={[6, 6, 0, 0]}
          />
          <Bar
            dataKey="consumed"
            name="Salidas"
            fill="var(--color-primary)"
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Distribución (categorías, tipos de movimiento). */
export function InventoryShareChart({
  data,
  money = false,
}: {
  data: Array<{ name: string; value: number }>;
  money?: boolean;
}) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={95}
            paddingAngle={2}
          >
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => [
              money ? currency(Number(value)) : units(Number(value)),
              name,
            ]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
