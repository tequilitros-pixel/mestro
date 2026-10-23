"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  BarChart,
  Bar,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBusinessTime } from "@/lib/dateTime";
import type { ReactElement } from "react";

type CookingEvent = {
  id: string;
  type: string;
  createdAt: Date | string;
  temperatureTop: number | null;
  temperatureMiddle: number | null;
  temperatureBottom: number | null;
  liters?: number | null;
  brix?: number | null;
};

type SteamInterval = {
  id: string;
  state: string;
  startedAt: Date | string;
  endedAt: Date | string | null;
  pressureReadings: Array<{
    occurredAt: Date | string;
    canonicalPsi: unknown;
  }>;
};

type SweetHoneyRecovery = {
  id: string;
  liters: number | string | unknown;
  brix: number | string | unknown | null;
  recoveredAt: Date | string;
};

const tooltipStyle = {
  backgroundColor: "var(--color-surface-container-high, #1e1e1e)",
  border: "1px solid var(--color-outline-variant, #444)",
  borderRadius: "0.75rem",
  color: "var(--color-on-surface, #fff)",
  fontSize: "0.75rem",
};

export default function CookingCharts({
  events,
  steamIntervals = [],
  sweetHoneyRecoveries = [],
}: {
  events: CookingEvent[];
  steamIntervals?: SteamInterval[];
  sweetHoneyRecoveries?: SweetHoneyRecovery[];
}) {
  // Datos de temperatura
  const tempData = events
    .filter((e) => e.type === "TEMPERATURA" && (e.temperatureTop !== null || e.temperatureMiddle !== null || e.temperatureBottom !== null))
    .map((e) => ({
      time: formatBusinessTime(e.createdAt),
      timestamp: new Date(e.createdAt).getTime(),
      superior: e.temperatureTop,
      media: e.temperatureMiddle,
      inferior: e.temperatureBottom,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  // Datos de presión de vapor
  const pressureData = steamIntervals
    .flatMap((interval) =>
      interval.pressureReadings.map((reading) => ({
        time: formatBusinessTime(reading.occurredAt),
        timestamp: new Date(reading.occurredAt).getTime(),
        psi: Number(reading.canonicalPsi) || 0,
      }))
    )
    .sort((a, b) => a.timestamp - b.timestamp);

  // Datos de mieles (mieles amargas y mieles dulces de eventos + sweetHoneyRecoveries)
  const honeyMap = new Map<string, { time: string; timestamp: number; mielesAmargasLiters: number; mielesDulcesLiters: number; mielesDulcesBrix: number | null }>();

  events.forEach((e) => {
    if (e.type === "MIELES_AMARGAS" && e.liters) {
      const time = formatBusinessTime(e.createdAt);
      const prev = honeyMap.get(time) ?? { time, timestamp: new Date(e.createdAt).getTime(), mielesAmargasLiters: 0, mielesDulcesLiters: 0, mielesDulcesBrix: null };
      prev.mielesAmargasLiters += Number(e.liters);
      honeyMap.set(time, prev);
    } else if (e.type === "MIELES_DULCES") {
      const time = formatBusinessTime(e.createdAt);
      const prev = honeyMap.get(time) ?? { time, timestamp: new Date(e.createdAt).getTime(), mielesAmargasLiters: 0, mielesDulcesLiters: 0, mielesDulcesBrix: null };
      if (e.liters) prev.mielesDulcesLiters += Number(e.liters);
      if (e.brix) prev.mielesDulcesBrix = Number(e.brix);
      honeyMap.set(time, prev);
    }
  });

  sweetHoneyRecoveries.forEach((r) => {
    const time = formatBusinessTime(r.recoveredAt);
    const prev = honeyMap.get(time) ?? { time, timestamp: new Date(r.recoveredAt).getTime(), mielesAmargasLiters: 0, mielesDulcesLiters: 0, mielesDulcesBrix: null };
    if (r.liters) prev.mielesDulcesLiters += Number(r.liters);
    if (r.brix) prev.mielesDulcesBrix = Number(r.brix);
    honeyMap.set(time, prev);
  });

  const honeyData = Array.from(honeyMap.values()).sort((a, b) => a.timestamp - b.timestamp);

  const hasAnyData = tempData.length > 0 || pressureData.length > 0 || honeyData.length > 0 || steamIntervals.length > 0;

  if (!hasAnyData) {
    return (
      <section className="mt-4 rounded-xl border border-outline-variant bg-surface-container p-4 sm:p-5">
        <h2 className="text-sm font-semibold">Gráficas de cocción</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          Aún no hay temperaturas, presiones o mieles registradas para graficar.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-4 space-y-6 rounded-xl border border-outline-variant bg-surface-container p-4 sm:p-5">
      <div>
        <h2 className="text-base font-bold">Gráficas de cocimiento</h2>
        <p className="text-xs text-on-surface-variant">
          Monitoreo térmico, inyección de vapor de caldera y extracción de mieles.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {tempData.length > 0 && (
          <Chart title="Curva de temperatura del horno / autoclave (°C)">
            <LineChart data={tempData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant, #333)" />
              <XAxis
                dataKey="time"
                stroke="var(--color-outline, #888)"
                fontSize={11}
                tick={{ fill: "var(--color-outline, #888)" }}
              />
              <YAxis
                unit="°C"
                stroke="var(--color-outline, #888)"
                fontSize={11}
                tick={{ fill: "var(--color-outline, #888)" }}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend verticalAlign="top" height={36} />
              <Line
                type="monotone"
                dataKey="superior"
                name="Temp. Superior"
                stroke="#f97316"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="media"
                name="Temp. Media"
                stroke="#eab308"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="inferior"
                name="Temp. Inferior"
                stroke="#06b6d4"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                connectNulls
              />
            </LineChart>
          </Chart>
        )}

        {pressureData.length > 0 && (
          <Chart title="Presión de vapor de caldera (PSI)">
            <LineChart data={pressureData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant, #333)" />
              <XAxis
                dataKey="time"
                stroke="var(--color-outline, #888)"
                fontSize={11}
                tick={{ fill: "var(--color-outline, #888)" }}
              />
              <YAxis
                unit=" PSI"
                stroke="var(--color-outline, #888)"
                fontSize={11}
                tick={{ fill: "var(--color-outline, #888)" }}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend verticalAlign="top" height={36} />
              <Line
                type="stepAfter"
                dataKey="psi"
                name="Presión PSI"
                stroke="#8b5cf6"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </LineChart>
          </Chart>
        )}

        {honeyData.length > 0 && (
          <Chart title="Extracción de mieles (Amargas vs Dulces L)">
            <BarChart data={honeyData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant, #333)" />
              <XAxis
                dataKey="time"
                stroke="var(--color-outline, #888)"
                fontSize={11}
                tick={{ fill: "var(--color-outline, #888)" }}
              />
              <YAxis
                unit=" L"
                stroke="var(--color-outline, #888)"
                fontSize={11}
                tick={{ fill: "var(--color-outline, #888)" }}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend verticalAlign="top" height={36} />
              <Bar
                dataKey="mielesAmargasLiters"
                name="Mieles amargas (L)"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="mielesDulcesLiters"
                name="Mieles dulces (L)"
                fill="#22c55e"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </Chart>
        )}

        {honeyData.some((h) => h.mielesDulcesBrix !== null) && (
          <Chart title="Concentración de azúcar en mieles dulces (°Brix)">
            <LineChart
              data={honeyData.filter((h) => h.mielesDulcesBrix !== null)}
              margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant, #333)" />
              <XAxis
                dataKey="time"
                stroke="var(--color-outline, #888)"
                fontSize={11}
                tick={{ fill: "var(--color-outline, #888)" }}
              />
              <YAxis
                unit="°Bx"
                stroke="var(--color-outline, #888)"
                fontSize={11}
                tick={{ fill: "var(--color-outline, #888)" }}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend verticalAlign="top" height={36} />
              <Line
                type="monotone"
                dataKey="mielesDulcesBrix"
                name="°Brix Mieles Dulces"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ r: 4 }}
                connectNulls
              />
            </LineChart>
          </Chart>
        )}
      </div>

      {steamIntervals.length > 0 && (
        <div className="rounded-xl border border-outline-variant bg-surface-container-high p-4">
          <h3 className="text-sm font-semibold text-on-surface">Franjas de inyección de vapor</h3>
          <p className="mt-1 text-xs text-on-surface-variant">
            Ciclos de inyección controlados para la hidrólisis de inulina en azúcares fermentables.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {steamIntervals.map((interval, i) => (
              <div
                key={interval.id || i}
                className="flex items-center justify-between rounded-lg border border-outline-variant/50 bg-surface-container p-3 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      interval.state === "INYECTANDO" ? "bg-amber-500 animate-pulse" : "bg-outline"
                    }`}
                  />
                  <span className="font-semibold text-on-surface">
                    {interval.state === "INYECTANDO" ? "Inyección activa" : "Corte / Reposo"}
                  </span>
                </div>
                <span className="text-on-surface-variant font-mono">
                  {formatBusinessTime(interval.startedAt)} —{" "}
                  {interval.endedAt ? formatBusinessTime(interval.endedAt) : "En curso"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Chart({ title, children }: { title: string; children: ReactElement }) {
  return (
    <div className="rounded-xl border border-outline-variant/60 bg-surface-container-high p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-on-surface">{title}</p>
      <div className="h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
