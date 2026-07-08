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
  brix: number | null;
  ph: number | null;
  temperature: number | null;
  water: number | null;
  bagasse: number | null;
};

export default function MillingCharts({ events }: { events: MillingEvent[] }) {
  const data: ChartData[] = events.map((event) => ({
    time: new Date(event.createdAt).toLocaleString(),
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
  }));

  if (events.length === 0) {
    return (
      <section className="mt-8 rounded-2xl bg-slate-900 p-8">
        <h2 className="mb-2 text-2xl font-bold">Gráficas de molienda</h2>
        <p className="text-slate-400">Aún no hay eventos para graficar.</p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl bg-slate-900 p-8">
      <h2 className="mb-6 text-2xl font-bold">Gráficas de molienda</h2>

      <div className="grid gap-6 md:grid-cols-2">
        <Chart title="°Brix" data={data} dataKey="brix" />
        <Chart title="pH" data={data} dataKey="ph" />
        <Chart title="Temperatura °C" data={data} dataKey="temperature" />
        <Chart title="Agua agregada L" data={data} dataKey="water" />
      </div>
    </section>
  );
}

function Chart({
  title,
  data,
  dataKey,
}: {
  title: string;
  data: ChartData[];
  dataKey: keyof ChartData;
}) {
  return (
    <div className="rounded-2xl bg-slate-800 p-5">
      <h3 className="mb-4 font-bold">{title}</h3>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" hide />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey={dataKey}
              strokeWidth={3}
              dot
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}