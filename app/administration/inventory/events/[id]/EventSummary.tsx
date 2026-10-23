import { InventoryRankingChart, InventoryShareChart } from "../../InventoryCharts";
import type { EventConsumptionRow } from "@/lib/inventory/eventAnalytics";

const number = (value: number) => new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 }).format(value);
const money = (value: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

export default function EventSummary({ rows, saleAmount, complete, pendingReturns }: {
  rows: EventConsumptionRow[];
  saleAmount: number | null;
  complete: boolean;
  pendingReturns: number;
}) {
  const used = rows.filter((row) => row.consumed > 0);
  const liquids = rows.filter((row) => row.consumedLiters !== null && row.consumedLiters > 0)
    .sort((a, b) => (b.consumedLiters ?? 0) - (a.consumedLiters ?? 0));
  const cost = rows.reduce((sum, row) => sum + row.consumedCost, 0);
  const costComplete = rows.every((row) => row.costKnown);
  const liters = liquids.reduce((sum, row) => sum + (row.consumedLiters ?? 0), 0);
  const byCategory = [...rows.reduce((map, row) => {
    map.set(row.category, (map.get(row.category) ?? 0) + row.consumedCost);
    return map;
  }, new Map<string, number>())].filter(([, amount]) => amount > 0)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-on-surface">Resumen de consumo</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          {complete ? "Estimación final" : "Estimación parcial"} con las cantidades cargadas y el regreso capturado.
          {pendingReturns > 0 && ` Faltan ${pendingReturns} registros de regreso; esos productos aún no cuentan como consumidos.`}
          {" "}La diferencia puede incluir faltantes; el inventario no identifica qué cocteles se prepararon.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-outline-variant bg-surface-container p-4"><p className="text-xs text-on-surface-variant">Productos consumidos</p><p className="mt-1 text-2xl font-bold text-on-surface">{used.length}</p></div>
        <div className="rounded-xl border border-outline-variant bg-surface-container p-4"><p className="text-xs text-on-surface-variant">Líquidos consumidos</p><p className="mt-1 text-2xl font-bold text-on-surface">{number(liters)} L</p></div>
        <div className="rounded-xl border border-outline-variant bg-surface-container p-4"><p className="text-xs text-on-surface-variant">Costo estimado de insumos{costComplete ? "" : " con precio conocido"}</p><p className="mt-1 text-2xl font-bold text-on-surface">{money(cost)}</p></div>
        <div className="rounded-xl border border-outline-variant bg-surface-container p-4"><p className="text-xs text-on-surface-variant">Venta menos insumos</p><p className="mt-1 text-2xl font-bold text-on-surface">{saleAmount === null || !complete || !costComplete ? "—" : money(saleAmount - cost)}</p></div>
      </div>

      {liquids.length > 0 && (
        <div className="rounded-xl border border-outline-variant bg-surface-container p-5">
          <h3 className="font-semibold text-on-surface">Bebidas y líquidos más consumidos · litros estimados</h3>
          <InventoryRankingChart data={liquids.slice(0, 10).map((row) => ({ name: row.name, value: row.consumedLiters ?? 0 }))} valueLabel="Litros" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {used.length > 0 && (
          <div className="rounded-xl border border-outline-variant bg-surface-container p-5">
            <h3 className="font-semibold text-on-surface">Mayor costo consumido por producto</h3>
            <InventoryRankingChart data={[...used].sort((a, b) => b.consumedCost - a.consumedCost).slice(0, 8).map((row) => ({ name: row.name, value: row.consumedCost }))} valueLabel="Costo" money />
          </div>
        )}
        {byCategory.length > 0 && (
          <div className="rounded-xl border border-outline-variant bg-surface-container p-5">
            <h3 className="font-semibold text-on-surface">Costo por categoría</h3>
            <InventoryShareChart data={byCategory} money />
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-surface-container-high text-left text-xs text-on-surface-variant"><tr><th className="px-3 py-3">Producto</th><th className="px-3 py-3 text-right">Cargado total</th><th className="px-3 py-3 text-right">Regresó cerrado</th><th className="px-3 py-3 text-right">Dañado</th><th className="px-3 py-3 text-right">Consumido estimado</th><th className="px-3 py-3 text-right">Costo</th></tr></thead>
          <tbody className="divide-y divide-outline-variant">
            {rows.map((row) => <tr key={row.key}><td className="px-3 py-3"><p className="font-medium text-on-surface">{row.name}</p><p className="text-xs text-on-surface-variant">{row.category}</p></td><td className="px-3 py-3 text-right">{number(row.sent)} {row.unit}</td><td className="px-3 py-3 text-right">{number(row.returned)} {row.unit}</td><td className="px-3 py-3 text-right">{number(row.damaged)} {row.unit}</td><td className="px-3 py-3 text-right font-semibold">{number(row.consumed)} {row.unit}{row.consumedLiters !== null && <span className="block text-xs font-normal text-on-surface-variant">{number(row.consumedLiters)} L</span>}</td><td className="px-3 py-3 text-right">{row.costKnown ? money(row.consumedCost) : "Sin costo"}</td></tr>)}
            {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-on-surface-variant">Aún no hay datos de consumo para este evento.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-on-surface-variant">El consumo es una diferencia de inventario. Venta menos insumos excluye mano de obra, transporte y otros gastos{costComplete ? "." : "; se oculta mientras falten precios de insumos consumidos."}</p>
    </section>
  );
}
