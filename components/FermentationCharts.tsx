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
import { formatBusinessDateTime } from "@/lib/dateTime";
import type { ReactElement } from "react";

type Reading = {
  createdAt: Date | string;
  brix: number | null;
  ph: number | null;
  temperature: number | null;
  alcohol: number | null;
  saccharometer?: number | null;
  citricAcidGrams?: number | null;
  bicarbonateGrams?: number | null;
  heatingMinutes?: number | null;
};

const tooltipStyle = {
  backgroundColor: "var(--color-surface-container-high, #1e1e1e)",
  border: "1px solid var(--color-outline-variant, #444)",
  borderRadius: "0.75rem",
  color: "var(--color-on-surface, #fff)",
  fontSize: "0.75rem",
};

export default function FermentationCharts({
  readings,
}: {
  readings: Reading[];
}) {
  const data = readings
    .slice()
    .map((reading) => ({
      time: formatBusinessDateTime(reading.createdAt),
      timestamp: new Date(reading.createdAt).getTime(),
      brix: reading.brix,
      ph: reading.ph,
      temperature: reading.temperature,
      alcohol: reading.alcohol,
      saccharometer: reading.saccharometer ?? null,
      citricAcid: Number(reading.citricAcidGrams ?? 0),
      bicarbonate: Number(reading.bicarbonateGrams ?? 0),
      heatingMinutes: Number(reading.heatingMinutes ?? 0),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  const hasBrix = data.some((r) => r.brix !== null);
  const hasAlcohol = data.some((r) => r.alcohol !== null);
  const hasPh = data.some((r) => r.ph !== null);
  const hasTemp = data.some((r) => r.temperature !== null);
  const hasSaccharometer = data.some((r) => r.saccharometer !== null);
  const hasAdditions = data.some((r) => r.citricAcid > 0 || r.bicarbonate > 0);

  if (data.length === 0 || (!hasBrix && !hasAlcohol && !hasPh && !hasTemp && !hasSaccharometer)) {
    return (
      <section className="mt-4 rounded-xl border border-outline-variant bg-surface-container p-4 sm:p-5">
        <h2 className="text-sm font-semibold">Gráficas de fermentación</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          Aún no hay lecturas analíticas registradas para graficar.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-4 space-y-6 rounded-xl border border-outline-variant bg-surface-container p-4 sm:p-5">
      <div>
        <h2 className="text-base font-bold">Gráficas de fermentación</h2>
        <p className="text-xs text-on-surface-variant">
          Cinética de fermentación (atenuación de azúcares y producción de alcohol), evolución térmica y control de pH.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Curva Cinética Dual: Azúcar (°Bx) vs Alcohol (%) */}
        {(hasBrix || hasAlcohol) && (
          <div className="md:col-span-2">
            <Chart title="Cinética de fermentación: Atenuación de azúcares vs Alcohol producido">
              <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant, #333)" />
                <XAxis dataKey="time" stroke="var(--color-outline, #888)" fontSize={11} tick={{ fill: "var(--color-outline, #888)" }} />
                <YAxis
                  yAxisId="left"
                  unit="°Bx"
                  stroke="#10b981"
                  fontSize={11}
                  tick={{ fill: "#10b981" }}
                  label={{ value: "°Brix", angle: -90, position: "insideLeft", fill: "#10b981", fontSize: 11 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  unit="%"
                  stroke="#a855f7"
                  fontSize={11}
                  tick={{ fill: "#a855f7" }}
                  label={{ value: "Alcohol %", angle: 90, position: "insideRight", fill: "#a855f7", fontSize: 11 }}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend verticalAlign="top" height={36} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="brix"
                  name="Azúcares (°Brix)"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  connectNulls
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="alcohol"
                  name="Alcohol (% Vol)"
                  stroke="#a855f7"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  connectNulls
                />
              </LineChart>
            </Chart>
          </div>
        )}

        {/* Temperatura vs pH */}
        {(hasTemp || hasPh) && (
          <Chart title="Control ambiental: Temperatura de la tina (°C) y pH">
            <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant, #333)" />
              <XAxis dataKey="time" stroke="var(--color-outline, #888)" fontSize={11} tick={{ fill: "var(--color-outline, #888)" }} />
              <YAxis
                yAxisId="temp"
                unit="°C"
                stroke="#f97316"
                fontSize={11}
                tick={{ fill: "#f97316" }}
              />
              <YAxis
                yAxisId="ph"
                orientation="right"
                domain={[3, 6]}
                stroke="#38bdf8"
                fontSize={11}
                tick={{ fill: "#38bdf8" }}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend verticalAlign="top" height={36} />
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="temperature"
                name="Temperatura (°C)"
                stroke="#f97316"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                connectNulls
              />
              <Line
                yAxisId="ph"
                type="monotone"
                dataKey="ph"
                name="pH"
                stroke="#38bdf8"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                connectNulls
              />
            </LineChart>
          </Chart>
        )}

        {/* Sacarímetro */}
        {hasSaccharometer && (
          <Chart title="Lecturas de Sacarímetro">
            <LineChart data={data.filter((d) => d.saccharometer !== null)} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant, #333)" />
              <XAxis dataKey="time" stroke="var(--color-outline, #888)" fontSize={11} tick={{ fill: "var(--color-outline, #888)" }} />
              <YAxis stroke="var(--color-outline, #888)" fontSize={11} tick={{ fill: "var(--color-outline, #888)" }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend verticalAlign="top" height={36} />
              <Line
                type="monotone"
                dataKey="saccharometer"
                name="Sacarímetro"
                stroke="#14b8a6"
                strokeWidth={3}
                dot={{ r: 4 }}
                connectNulls
              />
            </LineChart>
          </Chart>
        )}

        {/* Adiciones químicas */}
        {hasAdditions && (
          <Chart title="Adición de correctores de pH (Gramos)">
            <BarChart data={data.filter((d) => d.citricAcid > 0 || d.bicarbonate > 0)} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant, #333)" />
              <XAxis dataKey="time" stroke="var(--color-outline, #888)" fontSize={11} tick={{ fill: "var(--color-outline, #888)" }} />
              <YAxis unit=" g" stroke="var(--color-outline, #888)" fontSize={11} tick={{ fill: "var(--color-outline, #888)" }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend verticalAlign="top" height={36} />
              <Bar dataKey="citricAcid" name="Ácido cítrico (g)" fill="#eab308" radius={[4, 4, 0, 0]} />
              <Bar dataKey="bicarbonate" name="Bicarbonato (g)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
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
