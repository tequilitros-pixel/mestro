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

type CookingEvent = {
  id: string;
  type: string;
  createdAt: Date | string;
  temperatureTop: number | null;
  temperatureMiddle: number | null;
  temperatureBottom: number | null;
};

type ChartData = {
  time: string;
  temperatureTop: number | null;
  temperatureMiddle: number | null;
  temperatureBottom: number | null;
};

export default function CookingCharts({ events }: { events: CookingEvent[] }) {
  const data: ChartData[] = events
    .filter((event) => event.type === "TEMPERATURA")
    .map((event) => ({
      time: new Date(event.createdAt).toLocaleString(),
      temperatureTop: event.temperatureTop,
      temperatureMiddle: event.temperatureMiddle,
      temperatureBottom: event.temperatureBottom,
    }));

  if (data.length === 0) {
    return (
      <section className="mt-8 rounded-2xl bg-slate-900 p-8">
        <h2 className="mb-2 text-2xl font-bold">Gráficas de cocción</h2>
        <p className="text-slate-400">
          Aún no hay temperaturas registradas para graficar.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl bg-slate-900 p-8">
      <h2 className="mb-6 text-2xl font-bold">Gráficas de cocción</h2>

      <div className="grid gap-6 md:grid-cols-3">
        <Chart
          title="Temperatura superior"
          data={data}
          dataKey="temperatureTop"
        />

        <Chart
          title="Temperatura media"
          data={data}
          dataKey="temperatureMiddle"
        />

        <Chart
          title="Temperatura inferior"
          data={data}
          dataKey="temperatureBottom"
        />
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