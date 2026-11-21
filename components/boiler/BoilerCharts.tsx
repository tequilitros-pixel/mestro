"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { formatBusinessTime } from "@/lib/dateTime";
import type { ReactElement } from "react";

type PressureItem = {
  occurredAt: Date | string;
  canonicalPsi: unknown;
  originalUnit?: string;
};

type GasItem = {
  occurredAt: Date | string;
  levelPercent: unknown;
  levelLiters: unknown;
  type?: string;
};

const tooltipStyle = {
  backgroundColor: "var(--color-surface-container-high, #1e1e1e)",
  border: "1px solid var(--color-outline-variant, #444)",
  borderRadius: "0.75rem",
  color: "var(--color-on-surface, #fff)",
  fontSize: "0.75rem",
};

export default function BoilerCharts({
  pressureReadings = [],
  gasReadings = [],
}: {
  pressureReadings: PressureItem[];
  gasReadings: GasItem[];
}) {
  const pressureData = pressureReadings
    .map((r) => ({
      time: formatBusinessTime(r.occurredAt),
      timestamp: new Date(r.occurredAt).getTime(),
      psi: Number(r.canonicalPsi) || 0,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  const gasData = gasReadings
    .map((g) => ({
      time: formatBusinessTime(g.occurredAt),
      timestamp: new Date(g.occurredAt).getTime(),
      percent: Number(g.levelPercent) || 0,
      liters: Number(g.levelLiters) || 0,
      type: g.type,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (pressureData.length === 0 && gasData.length === 0) {
    return (
      <section className="rounded-2xl border border-outline-variant bg-surface-container p-5">
        <h3 className="font-bold">Monitoreo gráfico de Caldera</h3>
        <p className="mt-2 text-sm text-on-surface-variant">
          Aún no hay lecturas de presión ni de gas en esta sesión para graficar.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {/* Gráfica de Presión de Vapor */}
      {pressureData.length > 0 && (
        <section className="rounded-2xl border border-outline-variant bg-surface-container p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold text-on-surface">Curva de Presión de Vapor (PSI)</h3>
              <p className="text-xs text-on-surface-variant">
                Rango óptimo para cocimiento y destilación: 45 - 80 PSI.
              </p>
            </div>
            <span className="font-mono text-xs font-semibold text-primary">
              Última: {pressureData[pressureData.length - 1]?.psi.toFixed(1)} PSI
            </span>
          </div>

          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pressureData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant, #333)" />
                <XAxis dataKey="time" stroke="var(--color-outline, #888)" fontSize={11} />
                <YAxis unit=" PSI" stroke="var(--color-outline, #888)" fontSize={11} domain={[0, "auto"]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="psi"
                  name="Presión (PSI)"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#f59e0b" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Gráfica de Nivel de Gas */}
      {gasData.length > 0 && (
        <section className="rounded-2xl border border-outline-variant bg-surface-container p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold text-on-surface">Evolución de Gas LP en Tanque (%)</h3>
              <p className="text-xs text-on-surface-variant">
                Monitoreo de reserva. Alerta crítica si el nivel baja del 15%.
              </p>
            </div>
            <span className="font-mono text-xs font-semibold text-secondary">
              Último: {gasData[gasData.length - 1]?.percent.toFixed(1)}% ({gasData[gasData.length - 1]?.liters.toFixed(0)} L)
            </span>
          </div>

          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={gasData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant, #333)" />
                <XAxis dataKey="time" stroke="var(--color-outline, #888)" fontSize={11} />
                <YAxis unit="%" stroke="var(--color-outline, #888)" fontSize={11} domain={[0, 100]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="percent"
                  name="Nivel de Gas (%)"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#3b82f6" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
}
