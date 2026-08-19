import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import SuccessToast from "@/components/ui/SuccessToast";
import ProcessTable from "@/components/production/ProcessTable";
import { PageHeader } from "@/components/ui/CompactUI";

export default async function FermentationPage() {
  const fermentations = await prisma.fermentation.findMany({ orderBy: { createdAt: "desc" }, include: { lot: true, readings: { orderBy: { createdAt: "desc" }, take: 1 } } });
  return <main className="page-frame space-y-4 text-on-surface"><Suspense fallback={null}><SuccessToast params={{ created: "Fermentación iniciada exitosamente" }} /></Suspense><div className="mx-auto max-w-7xl"><PageHeader title="Fermentación" description="Lecturas y avance de cada tina." actions={<Link href="/fermentation/new" className="compact-action inline-flex items-center bg-primary font-semibold text-on-primary">Nueva fermentación</Link>} /><ProcessTable emptyLabel="No hay fermentaciones registradas." columns={[{ key: "code", label: "Código del lote", width: "16%" }, { key: "tank", label: "Tina", width: "13%" }, { key: "must", label: "Mosto", width: "12%" }, { key: "brix", label: "°Brix actual", width: "12%" }, { key: "ph", label: "pH actual", width: "12%" }, { key: "temperature", label: "Temperatura", width: "14%" }, { key: "status", label: "Estado", width: "21%" }]} filters={[{ key: "tank", label: "Tina", options: [...new Set(fermentations.map((item) => item.tank))] }]} rows={fermentations.map((item) => { const last = item.readings[0]; return { id: item.id, href: `/fermentation/${item.id}`, code: item.lot.code, startedAt: item.startedAt.toISOString(), status: item.status === "TERMINADA" ? "Terminado" : "En proceso", finished: item.status === "TERMINADA", values: { tank: item.tank, must: `${item.mustLiters.toLocaleString("es-MX")} L`, brix: String(last?.brix ?? item.initialBrix), ph: String(last?.ph ?? item.initialPh), temperature: `${last?.temperature ?? item.initialTemperature} °C` }, filters: { tank: item.tank } }; })} /></div></main>;
}
