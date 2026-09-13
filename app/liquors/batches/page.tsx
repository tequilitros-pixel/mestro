import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ProcessTable from "@/components/production/ProcessTable";
import { PageHeader } from "@/components/ui/CompactUI";

const date = (value: Date | null) => value ? new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Mexico_City" }).format(value) : "—";
const label = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());

export default async function LiquorBatchesPage() {
  const batches = await prisma.liquorBatch.findMany({ orderBy: { createdAt: "desc" }, include: { product: true } });
  return <main className="page-frame text-on-surface"><div className="mx-auto max-w-7xl"><PageHeader title="Lotes" description="Consulta y continúa los lotes registrados." actions={<Link href="/liquors" className="compact-action inline-flex items-center bg-primary font-semibold text-on-primary">Nuevo lote</Link>} /><ProcessTable emptyLabel="No hay lotes registrados." columns={[{ key: "code", label: "Código de lote", width: "14%" }, { key: "product", label: "Producto", width: "15%" }, { key: "startedAt", label: "Fecha de producción", width: "14%" }, { key: "volume", label: "Volumen", width: "11%" }, { key: "alcohol", label: "Alcohol", width: "10%" }, { key: "expiration", label: "Caducidad", width: "13%" }, { key: "stage", label: "Etapa", width: "12%" }, { key: "status", label: "Estado", width: "11%" }]} filters={[{ key: "product", label: "Producto", options: [...new Set(batches.map((item) => item.product.name))] }, { key: "stage", label: "Etapa", options: [...new Set(batches.map((item) => label(item.status)))] }]} rows={batches.map((item) => { const alcohol = item.finalAlcohol ?? item.initialAlcohol; return { id: item.id, href: `/liquors/batches/${item.id}`, code: item.code, search: `${item.code} ${item.product.name}`, startedAt: item.productionDate.toISOString(), status: item.status === "TERMINADO" ? "Terminado" : "En proceso", finished: item.status === "TERMINADO", values: { product: item.product.name, volume: `${item.actualLiters ?? item.plannedLiters} L`, alcohol: alcohol === null ? "—" : `${alcohol}%`, expiration: date(item.expirationDate), stage: label(item.status) }, filters: { product: item.product.name, stage: label(item.status) } }; })} /></div></main>;
}
