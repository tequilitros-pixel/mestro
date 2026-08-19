import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ProcessTable from "@/components/production/ProcessTable";
import { PageHeader } from "@/components/ui/CompactUI";

export default async function CookingPage() {
  const cookings = await prisma.cooking.findMany({ orderBy: { createdAt: "desc" }, include: { lot: true, equipment: true } });
  return <main className="page-frame space-y-4 text-on-surface"><div className="mx-auto max-w-7xl"><PageHeader title="Cocción" description="Procesos de cocción registrados." actions={<Link href="/cooking/new" className="compact-action inline-flex items-center bg-primary font-semibold text-on-primary">Nueva cocción</Link>} /><ProcessTable emptyLabel="Aún no hay cocciones registradas." columns={[{ key: "code", label: "Código del lote", width: "20%" }, { key: "equipment", label: "Horno", width: "18%" }, { key: "agave", label: "Agave", width: "14%" }, { key: "startedAt", label: "Inicio", width: "18%" }, { key: "duration", label: "Duración", width: "14%" }, { key: "status", label: "Estado", width: "16%" }]} filters={[{ key: "equipment", label: "Horno", options: [...new Set(cookings.map((item) => item.equipment.name))] }]} rows={cookings.map((item) => ({ id: item.id, href: `/cooking/${item.id}`, code: item.lot.code, startedAt: item.startedAt.toISOString(), status: item.status === "TERMINADA" ? "Terminado" : "En proceso", finished: item.status === "TERMINADA", values: { equipment: item.equipment.name, agave: `${item.agaveKg.toLocaleString("es-MX")} kg`, duration: `${Math.max(0, Math.round(((item.finishedAt ?? new Date()).getTime() - item.startedAt.getTime()) / 36e5))} h` }, filters: { equipment: item.equipment.name } }))} /></div></main>;
}
