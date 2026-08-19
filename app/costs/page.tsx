import { prisma } from "@/lib/prisma";
import ProcessTable from "@/components/production/ProcessTable";
import { MetricCard, PageHeader } from "@/components/ui/CompactUI";

export default async function CostsPage() {
  const lots = await prisma.lot.findMany({ include: { expenses: true }, orderBy: { createdAt: "desc" } });
  const rows = lots.map((lot) => { const totalCost = lot.expenses.reduce((sum, expense) => sum + expense.amount, 0); const totalLiters = lot.totalLitersObtained ?? 0; return { id: lot.id, href: `/lots/${lot.id}/costs`, code: lot.code, startedAt: lot.startedAt.toISOString(), status: lot.totalLitersObtained !== null ? "Terminado" : "En proceso", finished: lot.totalLitersObtained !== null, values: { cost: `$${totalCost.toLocaleString("es-MX", { maximumFractionDigits: 2 })}`, liters: totalLiters ? `${totalLiters.toFixed(2)} L` : "Pendiente", costPerLiter: totalLiters ? `$${(totalCost / totalLiters).toFixed(2)}` : "—" } }; });
  const totalCost = rows.reduce((sum, row) => sum + Number(row.values.cost.replace(/[^\d.-]/g, "")), 0);
  const totalLiters = lots.reduce((sum, lot) => sum + (lot.totalLitersObtained ?? 0), 0);
  return <main className="page-frame space-y-4 text-on-surface"><div className="mx-auto max-w-7xl"><PageHeader title="Centro de Costos" description="Costos y rendimiento por lote." /><div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3"><MetricCard label="Costo total" value={`$${totalCost.toLocaleString("es-MX", { maximumFractionDigits: 2 })}`} /><MetricCard label="Litros producidos" value={`${totalLiters.toFixed(2)} L`} /><MetricCard label="Costo promedio por litro" value={totalLiters ? `$${(totalCost / totalLiters).toFixed(2)}` : "—"} /></div><ProcessTable emptyLabel="No hay lotes con costos para los filtros seleccionados." columns={[{ key: "code", label: "Código del lote", width: "24%" }, { key: "cost", label: "Costo total", width: "20%" }, { key: "liters", label: "Litros producidos", width: "20%" }, { key: "costPerLiter", label: "Costo por litro", width: "20%" }, { key: "status", label: "Estado", width: "16%" }]} rows={rows} /></div></main>;
}
