"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type BranchSummary = {
  name: string;
  affectedProducts: number;
  missingRows: number;
  exactRate: number;
};

type DailySummary = {
  label: string;
  missingRows: number;
  affectedBranches: number;
};

type ConsumptionSummary = {
  name: string;
  movements: number;
};

export default function CountDashboardCharts({
  branchSummary,
  dailySummary,
  consumptionByBranch,
}: {
  branchSummary: BranchSummary[];
  dailySummary: DailySummary[];
  consumptionByBranch: ConsumptionSummary[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Faltantes por sucursal">
        {branchSummary.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={branchSummary} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" />
              <XAxis dataKey="name" stroke="var(--color-outline)" fontSize={11} />
              <YAxis allowDecimals={false} stroke="var(--color-outline)" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [Number(value), "Productos afectados"]} />
              <Bar dataKey="affectedProducts" name="Productos afectados" fill="var(--color-error)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Movimientos de consumo por sucursal">
        {consumptionByBranch.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={consumptionByBranch} layout="vertical" margin={{ top: 8, right: 18, left: 12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" />
              <XAxis type="number" allowDecimals={false} stroke="var(--color-outline)" fontSize={11} />
              <YAxis type="category" dataKey="name" width={82} stroke="var(--color-outline)" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [Number(value), "Movimientos"]} />
              <Bar dataKey="movements" name="Movimientos" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Incidencias por día">
        {dailySummary.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailySummary} margin={{ top: 8, right: 18, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" />
              <XAxis dataKey="label" stroke="var(--color-outline)" fontSize={10} />
              <YAxis allowDecimals={false} stroke="var(--color-outline)" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="missingRows" name="Productos faltantes" stroke="var(--color-error)" strokeWidth={3} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="affectedBranches" name="Sucursales afectadas" stroke="var(--color-secondary)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-outline-variant bg-surface-container p-4">
      <h2 className="font-bold">{title}</h2>
      <div className="mt-3 h-64">{children}</div>
    </section>
  );
}

function EmptyChart() {
  return <p className="flex h-full items-center justify-center text-sm text-on-surface-variant">Sin datos para graficar.</p>;
}

const tooltipStyle = {
  background: "var(--color-surface-container-high)",
  border: "1px solid var(--color-outline-variant)",
  borderRadius: "0.75rem",
  color: "var(--color-on-surface)",
};
