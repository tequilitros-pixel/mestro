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

type Event = {
  createdAt: Date | string;
  temperature: number | null;
  outputTemperature: number | null;
  alcohol: number | null;
  alcoholCorrected: number | null;
  liters: number | null;
};

export default function DistillationCharts({
  events,
}: {
  events: Event[];
}) {
  const data = events.map((event) => ({
    time: new Date(event.createdAt).toLocaleTimeString(),
    temperature: event.temperature,
    outputTemperature: event.outputTemperature,
    alcohol: event.alcohol,
    corrected: event.alcoholCorrected,
    liters: event.liters,
  }));

  if (data.length === 0) {
    return (
      <section className="mt-8 rounded-2xl bg-slate-900 p-8">
        <h2 className="mb-2 text-2xl font-bold">
          Gráficas de destilación
        </h2>

        <p className="text-slate-400">
          Aún no hay registros.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl bg-slate-900 p-8">
      <h2 className="mb-6 text-2xl font-bold">
        Gráficas de destilación
      </h2>

      <div className="grid gap-6 md:grid-cols-2">
        <Chart title="Temperatura alambique" data={data} dataKey="temperature" />
        <Chart title="Temperatura salida" data={data} dataKey="outputTemperature" />
        <Chart title="Alcohol leído" data={data} dataKey="alcohol" />
        <Chart title="Alcohol corregido" data={data} dataKey="corrected" />
        <Chart title="Litros" data={data} dataKey="liters" />
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
  data: {
  time: string;
  temperature: number | null;
  outputTemperature: number | null;
  alcohol: number | null;
  corrected: number | null;
  liters: number | null;
}[];
  dataKey: string;
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