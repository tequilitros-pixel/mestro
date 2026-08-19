"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const money = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);

const tooltipStyle = {
  background: "var(--color-surface-container-high)",
  border: "1px solid var(--color-outline-variant)",
  borderRadius: "0.75rem",
  color: "var(--color-on-surface)",
};

export default function DiscountRankingChart({
  data,
  valueLabel,
}: {
  data: Array<{ name: string; amount: number }>;
  valueLabel: string;
}) {
  return (
    <div style={{ height: Math.max(250, data.length * 48) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 20, left: 12 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-outline-variant)"
            horizontal={false}
          />
          <XAxis
            type="number"
            tickFormatter={(value) => money(Number(value))}
            stroke="var(--color-outline)"
            fontSize={12}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={135}
            stroke="var(--color-outline)"
            fontSize={12}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => [money(Number(value)), valueLabel]}
          />
          <Bar dataKey="amount" fill="var(--color-primary)" radius={[0, 7, 7, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
