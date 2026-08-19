import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ProcessTable from "@/components/production/ProcessTable";
import { PageHeader } from "@/components/ui/CompactUI";

export default async function MillingPage() {
  const millings = await prisma.milling.findMany({ include: { lot: true, equipment: true }, orderBy: { startedAt: "desc" } });
  return <main className="page-frame space-y-4 text-on-surface"><div className="mx-auto max-w-7xl"><PageHeader title="Molienda" description="Procesos de molienda registrados." actions={<Link href="/milling/new" className="compact-action inline-flex items-center bg-primary font-semibold text-on-primary">Nueva molienda</Link>} /><ProcessTable emptyLabel="Aún no hay moliendas registradas." columns={[{ key: "code", label: "Código del lote", width: "20%" }, { key: "equipment", label: "Equipo", width: "18%" }, { key: "agave", label: "Agave procesado", width: "16%" }, { key: "startedAt", label: "Inicio", width: "18%" }, { key: "yield", label: "Rendimiento", width: "14%" }, { key: "status", label: "Estado", width: "14%" }]} filters={[{ key: "equipment", label: "Equipo", options: [...new Set(millings.map((item) => item.equipment.name))] }]} rows={millings.map((item) => ({ id: item.id, href: `/milling/${item.id}`, code: item.lot.code, startedAt: item.startedAt.toISOString(), status: item.status === "TERMINADA" ? "Terminado" : "En proceso", finished: item.status === "TERMINADA", values: { equipment: item.equipment.name, agave: `${item.cookedKg.toLocaleString("es-MX")} kg`, yield: (item.finalMashLiters ?? item.mashLiters) !== null ? `${(item.finalMashLiters ?? item.mashLiters ?? 0).toLocaleString("es-MX")} L` : "—" }, filters: { equipment: item.equipment.name } }))} /></div></main>;
}
