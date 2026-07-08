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

type Reading = {
  createdAt: Date;
  brix: number | null;
  ph: number | null;
  temperature: number | null;
  alcohol: number | null;
};

export default function FermentationCharts({
  readings,
}: {
  readings: Reading[];
}) {
  const data = readings
    .slice()
    .reverse()
    .map((reading) => ({
      time: new Date(reading.createdAt).toLocaleString(),
      brix: reading.brix,
      ph: reading.ph,
      temperature: reading.temperature,
      alcohol: reading.alcohol,
    }));

  if (data.length === 0) {
    return (
      <section className="mt-8 rounded-2xl bg-slate-900 p-8">
        <h2 className="mb-2 text-2xl font-bold">Gráficas</h2>
        <p className="text-slate-400">
          Aún no hay lecturas para graficar.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl bg-slate-900 p-8">
      <h2 className="mb-6 text-2xl font-bold">Gráficas de fermentación</h2>

      <div className="grid gap-6 md:grid-cols-2">
        <Chart title="°Brix" data={data} dataKey="brix" />
        <Chart title="pH" data={data} dataKey="ph" />
        <Chart title="Temperatura °C" data={data} dataKey="temperature" />
        <Chart title="Alcohol %" data={data} dataKey="alcohol" />
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
  brix: number | null;
  ph: number | null;
  temperature: number | null;
  alcohol: number | null;
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