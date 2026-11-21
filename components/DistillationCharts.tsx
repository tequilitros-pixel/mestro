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

type Event = {
  id?: string;
  type?: string;
  createdAt: Date | string;
  temperature: number | null;
  outputTemperature: number | null;
  alcohol: number | null;
  alcoholCorrected: number | null;
  liters: number | null;
  notes?: string | null;
};

const tooltipStyle = {
  backgroundColor: "var(--color-surface-container-high, #1e1e1e)",
  border: "1px solid var(--color-outline-variant, #444)",
  borderRadius: "0.75rem",
  color: "var(--color-on-surface, #fff)",
  fontSize: "0.75rem",
};

export default function DistillationCharts({
  events,
}: {
  events: Event[];
}) {
  const data = events
    .map((event) => ({
      time: formatBusinessTime(event.createdAt),
      timestamp: new Date(event.createdAt).getTime(),
      type: event.type ?? "",
      temperature: event.temperature,
      outputTemperature: event.outputTemperature,
      alcohol: event.alcohol,
      corrected: event.alcoholCorrected,
      liters: event.liters,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  const hasTemp = data.some((e) => e.temperature !== null || e.outputTemperature !== null);
  const hasAlcohol = data.some((e) => e.alcohol !== null || e.corrected !== null);
  const hasLiters = data.some((e) => e.liters !== null && e.liters > 0);

  if (events.length === 0 || (!hasTemp && !hasAlcohol && !hasLiters)) {
    return (
      <section className="mt-4 rounded-xl border border-outline-variant bg-surface-container p-4 sm:p-5">
        <h2 className="mb-1 text-sm font-semibold">Gráficas de destilación</h2>
        <p className="mt-2 text-sm text-on-surface-variant">Aún no hay mediciones o lecturas registradas para graficar.</p>
      </section>
    );
  }

  // Acumulado de litros para el gráfico de avance de producción
  let runningTotal = 0;
  const volumeData = data
    .filter((e) => e.liters !== null && e.liters > 0)
    .map((e) => {
      runningTotal += e.liters!;
      return {
        time: e.time,
        timestamp: e.timestamp,
        fraccion: e.liters,
        acumulado: runningTotal,
      };
    });

  let headsLiters = 0;
  let headsLAA = 0;
  let heartLiters = 0;
  let heartLAA = 0;
  let tailsLiters = 0;
  let tailsLAA = 0;

  events.forEach((e) => {
    const lts = Number(e.liters ?? 0);
    const alc = Number(e.alcoholCorrected ?? e.alcohol ?? 0);
    const laa = (lts * alc) / 100;
    if (e.type === "CORTE_CABEZAS") {
      headsLiters += lts;
      headsLAA += laa;
    } else if (e.type === "INICIO_CORAZON" || e.type === "FIN_CORAZON") {
      heartLiters += lts;
      heartLAA += laa;
    } else if (e.type === "INICIO_COLAS") {
      tailsLiters += lts;
      tailsLAA += laa;
    }
  });

  const hasFractionData = (headsLiters + heartLiters + tailsLiters) > 0;
  const fractionData = [
    { name: "Cabezas", litros: Number(headsLiters.toFixed(1)), laa: Number(headsLAA.toFixed(1)) },
    { name: "Corazón (Tequila)", litros: Number(heartLiters.toFixed(1)), laa: Number(heartLAA.toFixed(1)) },
    { name: "Colas", litros: Number(tailsLiters.toFixed(1)), laa: Number(tailsLAA.toFixed(1)) },
  ];

  return (
    <section className="mt-4 space-y-6 rounded-xl border border-outline-variant bg-surface-container p-4 sm:p-5">
      <div>
        <h2 className="text-base font-bold">Gráficas de destilación</h2>
        <p className="text-xs text-on-surface-variant">
          Evolución del grado alcohólico, gradiente térmico de condensación y fraccionamiento de volumen.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Curva de Alcohol */}
        {hasAlcohol && (
          <Chart title="Curva de riqueza alcohólica (% Vol: Leído vs Corregido a 20°C)">
            <LineChart
              data={data.filter((d) => d.alcohol !== null || d.corrected !== null)}
              margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant, #333)" />
              <XAxis dataKey="time" stroke="var(--color-outline, #888)" fontSize={11} tick={{ fill: "var(--color-outline, #888)" }} />
              <YAxis unit="%" stroke="var(--color-outline, #888)" fontSize={11} tick={{ fill: "var(--color-outline, #888)" }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend verticalAlign="top" height={36} />
              <Line
                type="monotone"
                dataKey="alcohol"
                name="Alcohol leído (%)"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="corrected"
                name="Alcohol corregido 20°C (%)"
                stroke="#a855f7"
                strokeWidth={3}
                dot={{ r: 4 }}
                connectNulls
              />
            </LineChart>
          </Chart>
        )}

        {/* Perfil Térmico */}
        {hasTemp && (
          <Chart title="Perfil térmico: Olla / Alambique vs Salida de condensador (°C)">
            <LineChart
              data={data.filter((d) => d.temperature !== null || d.outputTemperature !== null)}
              margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant, #333)" />
              <XAxis dataKey="time" stroke="var(--color-outline, #888)" fontSize={11} tick={{ fill: "var(--color-outline, #888)" }} />
              <YAxis unit="°C" stroke="var(--color-outline, #888)" fontSize={11} tick={{ fill: "var(--color-outline, #888)" }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend verticalAlign="top" height={36} />
              <Line
                type="monotone"
                dataKey="temperature"
                name="Alambique (°C)"
                stroke="#f97316"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="outputTemperature"
                name="Salida destilado (°C)"
                stroke="#06b6d4"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                connectNulls
              />
            </LineChart>
          </Chart>
        )}

        {/* Litros obtenidos / Acumulado */}
        {volumeData.length > 0 && (
          <div className="md:col-span-2">
            <Chart title="Volumen de destilado capturado (Litros por registro y acumulado)">
              <BarChart data={volumeData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant, #333)" />
                <XAxis dataKey="time" stroke="var(--color-outline, #888)" fontSize={11} tick={{ fill: "var(--color-outline, #888)" }} />
                <YAxis unit=" L" stroke="var(--color-outline, #888)" fontSize={11} tick={{ fill: "var(--color-outline, #888)" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend verticalAlign="top" height={36} />
                <Bar dataKey="fraccion" name="Litros fracción (L)" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </Chart>
          </div>
        )}

        {/* Fraccionamiento de Cortes: Cabezas, Corazón, Colas */}
        {hasFractionData && (
          <div className="md:col-span-2">
            <Chart title="Fraccionamiento de Cortes Maestros: Volumen (L) vs Alcohol Puro (LAA)">
              <BarChart data={fractionData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant, #333)" />
                <XAxis dataKey="name" stroke="var(--color-outline, #888)" fontSize={11} tick={{ fill: "var(--color-outline, #888)" }} />
                <YAxis stroke="var(--color-outline, #888)" fontSize={11} tick={{ fill: "var(--color-outline, #888)" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend verticalAlign="top" height={36} />
                <Bar dataKey="litros" name="Volumen (L)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="laa" name="Alcohol Puro (LAA)" fill="#ec4899" radius={[4, 4, 0, 0]} />
              </BarChart>
            </Chart>
          </div>
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
