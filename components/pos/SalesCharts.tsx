"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
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

/** Ventas diarias por sucursal: una línea por sucursal. */
export function DailyBranchChart({
  data,
  branchNames,
}: {
  data: Array<Record<string, string | number>>;
  branchNames: string[];
}) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" />
          <XAxis dataKey="label" stroke="var(--color-outline)" fontSize={12} />
          <YAxis
            stroke="var(--color-outline)"
            fontSize={12}
            tickFormatter={(v) => currency(Number(v))}
            width={70}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => [currency(Number(value)), name]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {branchNames.map((name, index) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={CHART_COLORS[index % CHART_COLORS.length]}
              strokeWidth={2.5}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Barras horizontales para rankings (productos, categorías, sucursales). */
export function RankingBarChart({
  data,
  valueLabel = "Ventas",
}: {
  data: Array<{ name: string; value: number }>;
  valueLabel?: string;
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
            tickFormatter={(v) => currency(Number(v))}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="var(--color-outline)"
            fontSize={12}
            width={140}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => [currency(Number(value)), valueLabel]}
          />
          <Bar dataKey="value" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Distribución (métodos de pago, participación por categoría). */
export function DistributionPieChart({
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
              <Cell
                key={entry.name}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
              />
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

/** Ventas por hora del día. */
export function HourlyChart({
  data,
}: {
  data: Array<{ label: string; total: number }>;
}) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" />
          <XAxis dataKey="label" stroke="var(--color-outline)" fontSize={11} />
          <YAxis
            stroke="var(--color-outline)"
            fontSize={12}
            tickFormatter={(v) => currency(Number(v))}
            width={70}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => [currency(Number(value)), "Ventas"]}
          />
          <Bar dataKey="total" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
