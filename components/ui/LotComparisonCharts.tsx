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
      <section className="mt-8 rounded-2xl bg-slate-900 p-8">
        <h2 className="mb-2 text-2xl font-bold">Comparación de lotes</h2>
        <p className="text-slate-400">
          Aún no hay lotes terminados para comparar.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-slate-900 p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold">Extracción por lote</h2>
          <p className="text-sm text-slate-400">%</p>
        </div>
        <div className="rounded-2xl bg-slate-800 p-5">
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="lote" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" unit="%" domain={["dataMin - 5", "dataMax + 5"]} />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: "12px",
                    color: "#e5e7eb",
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="extraccion" name="Extracción" stroke="#facc15" strokeWidth={3} dot connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-slate-900 p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold">Costo por litro</h2>
          <p className="text-sm text-slate-400">$ / L</p>
        </div>
        <div className="rounded-2xl bg-slate-800 p-5">
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="lote" stroke="#94a3b8" />
               <YAxis stroke="#94a3b8" domain={["auto", "auto"]} />

                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: "12px",
                    color: "#e5e7eb",
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="costoPorLitro" name="Costo por litro" stroke="#f87171" strokeWidth={3} dot connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-slate-900 p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold">Litros producidos y horas de cocción</h2>
        </div>
        <div className="rounded-2xl bg-slate-800 p-5">
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="lote" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: "12px",
                    color: "#e5e7eb",
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="litros" name="Litros producidos" stroke="#60a5fa" strokeWidth={3} dot connectNulls />
                <Line type="monotone" dataKey="horasCoccion" name="Horas de cocción" stroke="#4ade80" strokeWidth={3} dot connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
}
