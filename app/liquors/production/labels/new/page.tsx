import Link from "next/link";
import { requireModuleAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LiquorQrWizard from "@/components/liquors/LiquorQrWizard";
import { PageHeader } from "@/components/ui/CompactUI";

export default async function NewLiquorLabelPage() {
  await requireModuleAccess("/liquors/production");
  const liquorBatches = await prisma.liquorBatch.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, code: true, productionDate: true, finalAlcohol: true, product: { select: { name: true, defaultAlcohol: true } } } });
  const serialized = liquorBatches.map((batch) => ({ id: batch.id, code: batch.code, productName: batch.product.name, productionDate: batch.productionDate.toISOString(), finalAlcohol: batch.finalAlcohol, defaultAlcohol: batch.product.defaultAlcohol }));
  return <main className="page-frame text-on-surface"><div className="mx-auto max-w-4xl"><PageHeader title="Nueva etiqueta de licor" description="Selecciona un lote de elaboración y completa la ficha que verá el consumidor." actions={<Link href="/liquors/production/labels" className="compact-action">Volver</Link>} /><div className="mt-5"><LiquorQrWizard liquorBatches={serialized} /></div></div></main>;
}
