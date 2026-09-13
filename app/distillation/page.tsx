import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ProcessTable from "@/components/production/ProcessTable";
import { MetricCard, PageHeader } from "@/components/ui/CompactUI";

const TYPE_LABELS: Record<string, string> = { DESTROZADO: "Destrozado", RECTIFICACION: "Rectificación" };

export default async function DistillationPage() {
  const distillations = await prisma.distillation.findMany({ include: { lot: true, equipment: true }, orderBy: { startedAt: "desc" } });
  const active = distillations.filter((item) => item.status === "ACTIVA").length;
  const finished = distillations.filter((item) => item.status === "TERMINADA").length;
  const liters = distillations.reduce((sum, item) => sum + item.loadedLiters, 0);
  return <main className="page-frame space-y-4 text-on-surface"><div className="mx-auto max-w-7xl"><PageHeader title="Destilación" description="Control de alambiques, destrozado, rectificación y cortes." actions={<Link href="/distillation/new" className="compact-action inline-flex items-center bg-primary font-semibold text-on-primary">Nueva destilación</Link>} /><div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3"><MetricCard label="Corridas activas" value={active} /><MetricCard label="Corridas terminadas" value={finished} /><MetricCard label="Litros cargados" value={`${liters.toLocaleString("es-MX")} L`} /></div><ProcessTable emptyLabel="Aún no hay destilaciones registradas." columns={[{ key: "code", label: "Código del lote", width: "19%" }, { key: "type", label: "Tipo", width: "15%" }, { key: "equipment", label: "Alambique", width: "19%" }, { key: "liters", label: "Litros cargados", width: "16%" }, { key: "startedAt", label: "Inicio", width: "17%" }, { key: "status", label: "Estado", width: "14%" }]} filters={[{ key: "type", label: "Tipo", options: [...new Set(distillations.map((item) => TYPE_LABELS[item.type] ?? item.type))] }, { key: "equipment", label: "Alambique", options: [...new Set(distillations.map((item) => item.equipment.name))] }]} rows={distillations.map((item) => ({ id: item.id, href: `/distillation/${item.id}`, code: item.lot.code, startedAt: item.startedAt.toISOString(), status: item.status === "TERMINADA" ? "Terminado" : "En proceso", finished: item.status === "TERMINADA", values: { type: TYPE_LABELS[item.type] ?? item.type, equipment: item.equipment.name, liters: `${item.loadedLiters.toLocaleString("es-MX")} L` }, filters: { type: TYPE_LABELS[item.type] ?? item.type, equipment: item.equipment.name } }))} /></div></main>;
}
