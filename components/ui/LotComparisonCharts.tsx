"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

type HistoricLot = {
  code: string;
  extraction: number | null;
  alcohol: number | null;
  cookingHours: number | null;
  cookingTemp: number | null;
  litersProduced: number | null;
  costPerLiter: number | null;
  createdAt: Date | string;
};

export default function LotComparisonCharts({ lots }: { lots: HistoricLot[] }) {
  const data = lots.map((lot) => ({
    lote: lot.code,
    extraccion: lot.extraction,
    alcohol: lot.alcohol,
    horasCoccion: lot.cookingHours,
    litros: lot.litersProduced,
    costoPorLitro: lot.costPerLiter,
  }));

  if (data.length === 0) {
    return (
      <section className="mt-8 rounded-2xl bg-surface-container p-8">
        <h2 className="mb-2 text-2xl font-bold">Comparación de lotes</h2>
        <p className="text-on-surface-variant">
          Aún no hay lotes terminados para comparar.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-surface-container p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold">Extracción por lote</h2>
          <p className="text-sm text-on-surface-variant">%</p>
        </div>
        <div className="rounded-2xl bg-surface-container-high p-5">
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" />
                <XAxis dataKey="lote" stroke="var(--color-outline)" />
                <YAxis stroke="var(--color-outline)" unit="%" domain={["dataMin - 5", "dataMax + 5"]} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-surface-container-high)",
                    border: "1px solid var(--color-outline-variant)",
                    borderRadius: "12px",
                    color: "var(--color-on-surface)",
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="extraccion" name="Extracción" stroke="var(--color-on-surface)" strokeWidth={3} dot connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-surface-container p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold">Costo por litro</h2>
          <p className="text-sm text-on-surface-variant">$ / L</p>
        </div>
        <div className="rounded-2xl bg-surface-container-high p-5">
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" />
                <XAxis dataKey="lote" stroke="var(--color-outline)" />
               <YAxis stroke="var(--color-outline)" domain={["auto", "auto"]} />

                <Tooltip
                  contentStyle={{
                    background: "var(--color-surface-container-high)",
                    border: "1px solid var(--color-outline-variant)",
                    borderRadius: "12px",
                    color: "var(--color-on-surface)",
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="costoPorLitro" name="Costo por litro" stroke="var(--color-on-surface)" strokeWidth={3} dot connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-surface-container p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold">Litros producidos y horas de cocción</h2>
        </div>
        <div className="rounded-2xl bg-surface-container-high p-5">
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" />
                <XAxis dataKey="lote" stroke="var(--color-outline)" />
                <YAxis stroke="var(--color-outline)" />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-surface-container-high)",
                    border: "1px solid var(--color-outline-variant)",
                    borderRadius: "12px",
                    color: "var(--color-on-surface)",
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="litros" name="Litros producidos" stroke="var(--color-on-surface)" strokeWidth={3} dot connectNulls />
                <Line type="monotone" dataKey="horasCoccion" name="Horas de cocción" stroke="var(--color-outline)" strokeWidth={3} dot connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
}
