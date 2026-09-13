"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
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

/** Costo de nómina vs ventas por día. */
export function CostVsSalesChart({
  data,
}: {
  data: Array<{ label: string; cost: number; sales: number }>;
}) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" />
          <XAxis dataKey="label" stroke="var(--color-outline)" fontSize={11} />
          <YAxis
            stroke="var(--color-outline)"
            fontSize={12}
            tickFormatter={(v) => currency(Number(v))}
            width={72}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => [currency(Number(value)), name]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="sales"
            name="Ventas"
            fill="var(--color-tertiary-fixed-dim)"
            radius={[6, 6, 0, 0]}
          />
          <Line
            type="monotone"
            dataKey="cost"
            name="Costo nómina"
            stroke="var(--color-error)"
            strokeWidth={2.5}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horas trabajadas por día. */
export function HoursTrendChart({
  data,
}: {
  data: Array<{ label: string; hours: number }>;
}) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" />
          <XAxis dataKey="label" stroke="var(--color-outline)" fontSize={11} />
          <YAxis stroke="var(--color-outline)" fontSize={12} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => [`${Number(value).toFixed(1)} h`, "Horas"]}
          />
          <Bar dataKey="hours" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Ranking horizontal genérico (costo o horas). */
export function RankingChart({
  data,
  valueLabel,
  money = true,
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
            tickFormatter={(v) =>
              money ? currency(Number(v)) : `${Number(v).toFixed(0)} h`
            }
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="var(--color-outline)"
            fontSize={12}
            width={150}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => [
              money
                ? currency(Number(value))
                : `${Number(value).toFixed(1)} h`,
              valueLabel,
            ]}
          />
          <Bar dataKey="value" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Distribución del costo entre sucursales. */
export function CostShareChart({
  data,
}: {
  data: Array<{ name: string; value: number }>;
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
            formatter={(value, name) => [currency(Number(value)), name]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horas planeadas vs horas realmente trabajadas, por sucursal. */
export function PlannedVsActualChart({
  data,
}: {
  data: Array<{ name: string; planeadas: number; reales: number }>;
}) {
  return (
    <div style={{ height: Math.max(220, data.length * 56) }}>
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
            tickFormatter={(v) => `${Number(v).toFixed(0)} h`}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="var(--color-outline)"
            fontSize={12}
            width={150}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => [`${Number(value).toFixed(1)} h`, name]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="planeadas"
            name="Planeadas"
            fill="var(--color-on-surface-variant)"
            radius={[0, 6, 6, 0]}
          />
          <Bar
            dataKey="reales"
            name="Reales"
            fill="var(--color-primary)"
            radius={[0, 6, 6, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
