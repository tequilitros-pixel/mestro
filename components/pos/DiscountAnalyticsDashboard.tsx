import Link from "next/link";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";
import DiscountRankingChart from "./DiscountAnalyticsCharts";

export type DiscountRanking = {
  name: string;
  amount: number;
  count: number;
};

export type DiscountAnalytics = {
  amount: number;
  count: number;
  average: number;
  topGiver: string;
  topBranch: string;
  byGiver: DiscountRanking[];
  byBranch: DiscountRanking[];
  bySubject: DiscountRanking[];
  recent: Array<{
    id: string;
    saleId: string;
    code: string;
    date: string;
    giver: string;
    branch: string;
    subject: string;
    amount: number;
    reason: string;
  }>;
};

const money = (value: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

const labels = {
  courtesies: {
    title: "Cortesías",
    description: "Quién entrega más cortesías, en qué sucursal y a qué productos se aplican.",
    metric: "Valor de cortesías",
    count: "Cortesías otorgadas",
    subject: "Productos con más cortesías",
    subjectColumn: "Producto",
  },
  employees: {
    title: "Trabajadores",
    description: "Beneficios de empleado utilizados, responsables de la venta y sucursales.",
    metric: "Beneficio otorgado",
    count: "Beneficios aplicados",
    subject: "Trabajadores con más beneficio",
    subjectColumn: "Trabajador",
  },
  products: {
    title: "Productos",
    description: "Productos que concentran más descuentos y quién los está aplicando.",
    metric: "Descuento en productos",
    count: "Productos descontados",
    subject: "Productos con más descuento",
    subjectColumn: "Producto",
  },
} as const;

export default function DiscountAnalyticsDashboard({
  mode,
  analytics,
  branches,
  days,
  branchId,
}: {
  mode: keyof typeof labels;
  analytics: DiscountAnalytics;
  branches: Array<{ id: string; name: string }>;
  days: number;
  branchId: string;
}) {
  const copy = labels[mode];
  const basePath = `/pos/discounts/${mode}`;

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-sm font-semibold text-primary">Descuentos</p>
          <h1 className="text-3xl font-bold text-on-surface">{copy.title}</h1>
          <p className="mt-2 text-sm text-on-surface-variant">{copy.description}</p>
        </div>
        <form className="flex flex-wrap gap-2" action={basePath}>
          <select
            name="branch"
            defaultValue={branchId}
            className="rounded-xl border border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface"
          >
            <option value="">Todas las sucursales</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
          <select
            name="days"
            defaultValue={String(days)}
            className="rounded-xl border border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface"
          >
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="90">Últimos 90 días</option>
          </select>
          <button className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary">
            Aplicar
          </button>
        </form>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Reportes de descuentos">
        <Link
          href="/pos/discounts/rules"
          className="rounded-xl border border-outline-variant bg-surface-container px-4 py-2 text-sm font-bold text-on-surface-variant hover:text-on-surface"
        >
          Administrar
        </Link>
        {([
          ["courtesies", "Cortesías"],
          ["employees", "Trabajadores"],
          ["products", "Productos"],
        ] as const).map(([key, label]) => (
          <Link
            key={key}
            href={`/pos/discounts/${key}?days=${days}${branchId ? `&branch=${branchId}` : ""}`}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
              mode === key
                ? "bg-primary text-on-primary"
                : "border border-outline-variant bg-surface-container text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card highlight><CardLabel>{copy.metric}</CardLabel><CardValue>{money(analytics.amount)}</CardValue></Card>
        <Card><CardLabel>{copy.count}</CardLabel><CardValue>{analytics.count}</CardValue></Card>
        <Card><CardLabel>Promedio por aplicación</CardLabel><CardValue>{money(analytics.average)}</CardValue></Card>
        <Card><CardLabel>Quién más otorga</CardLabel><CardValue>{analytics.topGiver}</CardValue></Card>
        <Card><CardLabel>Sucursal principal</CardLabel><CardValue>{analytics.topBranch}</CardValue></Card>
      </section>

      {analytics.count === 0 ? (
        <Card className="py-12 text-center text-sm text-on-surface-variant">
          No hay registros para los filtros seleccionados.
        </Card>
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-1 text-lg font-bold text-on-surface">Quién otorga más</h2>
              <p className="mb-4 text-sm text-on-surface-variant">Valor económico acumulado por responsable de venta.</p>
              <DiscountRankingChart data={analytics.byGiver} valueLabel={copy.metric} />
            </Card>
            <Card>
              <h2 className="mb-1 text-lg font-bold text-on-surface">Descuentos por sucursal</h2>
              <p className="mb-4 text-sm text-on-surface-variant">Comparativo para detectar dónde se concentran.</p>
              <DiscountRankingChart data={analytics.byBranch} valueLabel={copy.metric} />
            </Card>
          </section>

          <Card>
            <h2 className="mb-1 text-lg font-bold text-on-surface">{copy.subject}</h2>
            <p className="mb-4 text-sm text-on-surface-variant">Los diez registros con mayor valor acumulado.</p>
            <DiscountRankingChart data={analytics.bySubject} valueLabel={copy.metric} />
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-outline-variant p-5">
              <h2 className="text-lg font-bold text-on-surface">Movimientos recientes</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-container-high text-xs uppercase text-on-surface-variant">
                  <tr>
                    <th className="px-5 py-3">Fecha / venta</th>
                    <th className="px-5 py-3">Otorgó</th>
                    <th className="px-5 py-3">Sucursal</th>
                    <th className="px-5 py-3">{copy.subjectColumn}</th>
                    <th className="px-5 py-3">Motivo</th>
                    <th className="px-5 py-3 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {analytics.recent.map((row) => (
                    <tr key={row.id} className="text-on-surface">
                      <td className="whitespace-nowrap px-5 py-3">
                        <div>{new Date(row.date).toLocaleDateString("es-MX")}</div>
                        <Link href={`/pos/sales/${row.saleId}`} className="text-xs font-semibold text-primary">{row.code}</Link>
                      </td>
                      <td className="px-5 py-3">{row.giver}</td>
                      <td className="px-5 py-3">{row.branch}</td>
                      <td className="px-5 py-3">{row.subject}</td>
                      <td className="px-5 py-3 text-on-surface-variant">{row.reason}</td>
                      <td className="px-5 py-3 text-right font-bold">{money(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </main>
  );
}
