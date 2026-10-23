import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModuleAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LiquorQrWizard from "@/components/liquors/LiquorQrWizard";
import { PageHeader } from "@/components/ui/CompactUI";
import type { PublicQrRecord } from "@/lib/publicQr";

export default async function EditLiquorLabelPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModuleAccess("/liquors/production");
  const { id } = await params;
  const [profile, liquorBatches] = await Promise.all([
    prisma.publicQrProfile.findUnique({ where: { id } }),
    prisma.liquorBatch.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, code: true, productionDate: true, finalAlcohol: true, product: { select: { name: true, defaultAlcohol: true } } } }),
  ]);
  if (!profile || !profile.batchId) notFound();
  const record: PublicQrRecord = { id: profile.id, publicId: profile.publicId, batchId: profile.batchId, lotId: profile.lotId, productName: profile.productName, lotCode: profile.lotCode, payload: profile.payload as PublicQrRecord["payload"], visibility: profile.visibility as PublicQrRecord["visibility"], status: profile.status, createdAt: profile.createdAt.toISOString(), publishedAt: profile.publishedAt?.toISOString() ?? null, updatedAt: profile.updatedAt.toISOString() };
  const serialized = liquorBatches.map((batch) => ({ id: batch.id, code: batch.code, productName: batch.product.name, productionDate: batch.productionDate.toISOString(), finalAlcohol: batch.finalAlcohol, defaultAlcohol: batch.product.defaultAlcohol }));
  return <main className="page-frame text-on-surface"><div className="mx-auto max-w-4xl"><PageHeader title="Editar etiqueta de licor" description={`La URL /q/licor/${profile.publicId} permanece sin cambios.`} actions={<Link href="/liquors/production/labels" className="compact-action">Volver</Link>} /><div className="mt-5"><LiquorQrWizard liquorBatches={serialized} initial={record} /></div></div></main>;
}
