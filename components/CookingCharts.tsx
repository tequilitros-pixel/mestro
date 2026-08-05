 "use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from "recharts";

type CookingEvent = {
  id: string;
  type: string;
  createdAt: Date | string;
  temperatureTop: number | null;
  temperatureMiddle: number | null;
  temperatureBottom: number | null;
  liters?: number | null;
  temperature?: number | null;
  ph?: number | null;
  brix?: number | null;
  notes?: string | null;
};

type ChartData = {
  time: string;
  timestamp: number;
  superior: number | null;
  media: number | null;
  inferior: number | null;
};

const eventLabels: Record<string, string> = {
  AUMENTAR_VAPOR: "+VAPOR",
  BAJAR_VAPOR: "−VAPOR",
  SUSPENDER_VAPOR: "PAUSA",
  MIELES_AMARGAS: "AMARGAS",
  MIELES_DULCES: "DULCES",
  OBSERVACION: "NOTA",
  FIN_COCCION: "FIN",
};

export default function CookingCharts({ events }: { events: CookingEvent[] }) {
  const temperatureEvents = events.filter((event) => event.type === "TEMPERATURA");

  const data: ChartData[] = temperatureEvents.map((event) => {
    const date = new Date(event.createdAt);

    return {
      time: date.toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      timestamp: date.getTime(),
      superior: event.temperatureTop,
      media: event.temperatureMiddle,
      inferior: event.temperatureBottom,
    };
  });

  const importantEvents = events
    .filter((event) => event.type !== "TEMPERATURA" && data.length > 0)
    .map((event) => {
      const eventTime = new Date(event.createdAt).getTime();

      const closestPoint = data.reduce((closest, point) => {
        const currentDiff = Math.abs(point.timestamp - eventTime);
        const closestDiff = Math.abs(closest.timestamp - eventTime);
        return currentDiff < closestDiff ? point : closest;
      }, data[0]);

      return {
        ...event,
        chartTime: closestPoint.time,
        chartY:
          closestPoint.superior ??
          closestPoint.media ??
          closestPoint.inferior ??
          0,
      };
    });

  if (data.length === 0) {
    return (
      <section className="mt-8 rounded-2xl bg-surface-container p-8">
        <h2 className="mb-2 text-2xl font-bold">Gráficas de cocción</h2>
        <p className="text-on-surface-variant">
          Aún no hay temperaturas registradas para graficar.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl bg-surface-container p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Gráficas de cocción</h2>
        <p className="text-sm text-on-surface-variant">Temperatura por hora</p>
      </div>

      <div className="rounded-2xl bg-surface-container-high p-5">
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 35, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" />
              <XAxis dataKey="time" stroke="var(--color-outline)" />
              <YAxis stroke="var(--color-outline)" unit="°C" domain={["dataMin - 5", "dataMax + 5"]} />
              <Tooltip
                contentStyle={{
                  background: "var(--color-surface-container-high)",
                  border: "1px solid var(--color-outline-variant)",
                  borderRadius: "12px",
                  color: "var(--color-on-surface)",
                }}
              />
              <Legend />
{importantEvents.map((event) => (
  <ReferenceLine
    key={event.id}
    x={event.chartTime}
    stroke="var(--color-secondary)"
    strokeDasharray="4 4"
    label={{
      value: eventLabels[event.type] ?? "•",
      position: "top",
      fill: "var(--color-secondary)",
      fontSize: 11,
      fontWeight: 700,
    }}
  />
))}

              <Line type="monotone" dataKey="inferior" name="Inferior" stroke="var(--color-on-surface-variant)" strokeDasharray="2 3" strokeWidth={2.5} dot connectNulls />
              <Line type="monotone" dataKey="media" name="Media" stroke="var(--color-outline)" strokeDasharray="6 3" strokeWidth={2.5} dot connectNulls />
              <Line type="monotone" dataKey="superior" name="Superior" stroke="var(--color-on-surface)" strokeWidth={2.5} dot connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}