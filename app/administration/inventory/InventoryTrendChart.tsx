"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type TrendPoint = {
  date: string;
  label: string;
  movimientos: number;
};

export default function InventoryTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" />
          <XAxis dataKey="label" stroke="var(--color-outline)" fontSize={12} />
          <YAxis stroke="var(--color-outline)" fontSize={12} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: "var(--color-surface-container-high)",
              border: "1px solid var(--color-outline-variant)",
              borderRadius: "0.75rem",
              color: "var(--color-on-surface)",
            }}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""}
            formatter={(value) => [value, "Movimientos"]}
          />
          <Line
            type="monotone"
            dataKey="movimientos"
            name="Movimientos"
            stroke="var(--color-primary)"
            strokeWidth={3}
            dot
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
