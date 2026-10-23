"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { formatBusinessTime } from "@/lib/dateTime";
import type { ReactElement } from "react";

type MillingEvent = {
  id: string;
  type: string;
  createdAt: Date | string;

  value: number | null;

  brix: number | null;
  ph: number | null;
  temperature: number | null;
  waterLiters: number | null;
  bagasseKg: number | null;
  washRecoveredLiters: number | null;
  pressPasses: number | null;

  notes: string | null;
};

type ChartData = {
  time: string;
  timestamp: number;
  brix: number | null;
  ph: number | null;
  temperature: number | null;
  water: number | null;
  bagasse: number | null;
  washRecovered: number | null;
  pressPasses: number | null;
};

const tooltipStyle = {
  backgroundColor: "var(--color-surface-container-high, #1e1e1e)",
  border: "1px solid var(--color-outline-variant, #444)",
  borderRadius: "0.75rem",
  color: "var(--color-on-surface, #fff)",
  fontSize: "0.75rem",
};

export default function MillingCharts({ events }: { events: MillingEvent[] }) {
  const data: ChartData[] = events
    .map((event) => ({
      time: formatBusinessTime(event.createdAt),
      timestamp: new Date(event.createdAt).getTime(),
      brix: event.brix ?? (event.type === "REGISTRO_BRIX" ? event.value : null),
      ph: event.ph ?? (event.type === "REGISTRO_PH" ? event.value : null),
      temperature:
        event.temperature ??
        (event.type === "REGISTRO_TEMPERATURA" ? event.value : null),
      water:
        event.waterLiters ?? (event.type === "AGREGAR_AGUA" ? event.value : null),
      bagasse:
        event.bagasseKg ??
        (event.type === "REGISTRO_BAGAZO" ? event.value : null),
      washRecovered: event.washRecoveredLiters,
      pressPasses: event.pressPasses,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  const hasBrix = data.some((d) => d.brix !== null);
  const hasPh = data.some((d) => d.ph !== null);
  const hasTemp = data.some((d) => d.temperature !== null);
  const hasWater = data.some((d) => d.water !== null);
  const hasBagasse = data.some((d) => d.bagasse !== null);
  const hasWash = data.some((d) => d.washRecovered !== null);

  if (events.length === 0 || (!hasBrix && !hasPh && !hasTemp && !hasWater && !hasBagasse && !hasWash)) {
    return (
      <section className="mt-4 rounded-xl border border-outline-variant bg-surface-container p-4 sm:p-5">
        <h2 className="text-sm font-semibold">Gráficas de molienda</h2>
        <p className="mt-2 text-sm text-on-surface-variant">Aún no hay eventos o lecturas registrados para graficar.</p>
      </section>
    );
  }

  return (
    <section className="mt-4 space-y-6 rounded-xl border border-outline-variant bg-surface-container p-4 sm:p-5">
      <div>
        <h2 className="text-base font-bold">Gráficas de molienda</h2>
        <p className="text-xs text-on-surface-variant">
          Control de extracción de jugos, dilución con agua, concentración de azúcares y descarga de bagazo.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {hasBrix && (
          <Chart title="Evolución de °Brix (Riqueza de azúcares)">
            <LineChart data={data.filter((d) => d.brix !== null)} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant, #333)" />
              <XAxis dataKey="time" stroke="var(--color-outline, #888)" fontSize={11} tick={{ fill: "var(--color-outline, #888)" }} />
              <YAxis unit="°Bx" stroke="var(--color-outline, #888)" fontSize={11} tick={{ fill: "var(--color-outline, #888)" }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="brix" name="°Brix Mosto" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} connectNulls />
            </LineChart>
          </Chart>
        )}

        {hasPh && (
          <Chart title="Acidez del mosto (pH)">
            <LineChart data={data.filter((d) => d.ph !== null)} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant, #333)" />
              <XAxis dataKey="time" stroke="var(--color-outline, #888)" fontSize={11} tick={{ fill: "var(--color-outline, #888)" }} />
              <YAxis domain={[3, 7]} stroke="var(--color-outline, #888)" fontSize={11} tick={{ fill: "var(--color-outline, #888)" }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="ph" name="pH" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} connectNulls />
            </LineChart>
          </Chart>
        )}

        {hasTemp && (
          <Chart title="Temperatura de molienda (°C)">
            <LineChart data={data.filter((d) => d.temperature !== null)} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant, #333)" />
              <XAxis dataKey="time" stroke="var(--color-outline, #888)" fontSize={11} tick={{ fill: "var(--color-outline, #888)" }} />
              <YAxis unit="°C" stroke="var(--color-outline, #888)" fontSize={11} tick={{ fill: "var(--color-outline, #888)" }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="temperature" name="Temp. °C" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} connectNulls />
            </LineChart>
          </Chart>
        )}

        {(hasWater || hasWash) && (
          <Chart title="Agua agregada vs Mosto recuperado en lavado (L)">
            <BarChart data={data.filter((d) => d.water !== null || d.washRecovered !== null)} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant, #333)" />
              <XAxis dataKey="time" stroke="var(--color-outline, #888)" fontSize={11} tick={{ fill: "var(--color-outline, #888)" }} />
              <YAxis unit=" L" stroke="var(--color-outline, #888)" fontSize={11} tick={{ fill: "var(--color-outline, #888)" }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend verticalAlign="top" height={36} />
              <Bar dataKey="water" name="Agua agregada (L)" fill="#0284c7" radius={[4, 4, 0, 0]} />
              <Bar dataKey="washRecovered" name="Mosto lavado recuperado (L)" fill="#14b8a6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </Chart>
        )}

        {hasBagasse && (
          <Chart title="Bagazo evacuado (kg)">
            <BarChart data={data.filter((d) => d.bagasse !== null)} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant, #333)" />
              <XAxis dataKey="time" stroke="var(--color-outline, #888)" fontSize={11} tick={{ fill: "var(--color-outline, #888)" }} />
              <YAxis unit=" kg" stroke="var(--color-outline, #888)" fontSize={11} tick={{ fill: "var(--color-outline, #888)" }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend verticalAlign="top" height={36} />
              <Bar dataKey="bagasse" name="Bagazo (kg)" fill="#78716c" radius={[4, 4, 0, 0]} />
            </BarChart>
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
