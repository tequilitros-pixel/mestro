import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModuleAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PublicQrWizard from "@/components/liquors/PublicQrWizard";
import LiquorQrWizard from "@/components/liquors/LiquorQrWizard";
import { PageHeader } from "@/components/ui/CompactUI";
import type { PublicQrRecord } from "@/lib/publicQr";

export default async function EditPublicQrPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModuleAccess("/liquors/production");
  const { id } = await params;
  const [profile, lots, liquorBatches] = await Promise.all([
    prisma.publicQrProfile.findUnique({ where: { id } }),
    prisma.lot.findMany({ where: { stage: { not: "TERMINADO" } }, orderBy: { createdAt: "desc" }, select: { id: true, code: true, startedAt: true, cookings: { select: { startedAt: true, finishedAt: true } }, millings: { select: { startedAt: true, finishedAt: true } }, fermentations: { select: { startedAt: true, finishedAt: true } }, distillations: { select: { startedAt: true, finishedAt: true, finalAlcohol: true } } } }),
    prisma.liquorBatch.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, code: true, productionDate: true, finalAlcohol: true, product: { select: { name: true, defaultAlcohol: true } } } }),
  ]);
  if (!profile) notFound();
  const record: PublicQrRecord = { id: profile.id, publicId: profile.publicId, batchId: profile.batchId, lotId: profile.lotId, productName: profile.productName, lotCode: profile.lotCode, payload: profile.payload as PublicQrRecord["payload"], visibility: profile.visibility as PublicQrRecord["visibility"], status: profile.status, createdAt: profile.createdAt.toISOString(), publishedAt: profile.publishedAt?.toISOString() ?? null, updatedAt: profile.updatedAt.toISOString() };
  const serialized = lots.map(toLotOption);
  const serializedLiquors = liquorBatches.map((batch) => ({ id: batch.id, code: batch.code, productName: batch.product.name, productionDate: batch.productionDate.toISOString(), finalAlcohol: batch.finalAlcohol, defaultAlcohol: batch.product.defaultAlcohol }));
  const publicPath = profile.batchId ? `/q/licor/${profile.publicId}` : `/q/tequila/${profile.publicId}`;
  return <main className="page-frame text-on-surface"><div className="mx-auto max-w-4xl"><PageHeader title={profile.batchId ? "Editar QR de licor" : "Editar QR de tequila"} description={`La URL ${publicPath} permanece sin cambios.`} actions={<Link href="/liquors/production/qr" className="compact-action">Volver</Link>} /><div className="mt-5">{profile.batchId ? <LiquorQrWizard liquorBatches={serializedLiquors} initial={record} /> : <PublicQrWizard batches={serialized} initial={record} />}</div></div></main>;
}

function toLotOption(lot: { id: string; code: string; startedAt: Date; cookings: { startedAt: Date; finishedAt: Date | null }[]; millings: { startedAt: Date; finishedAt: Date | null }[]; fermentations: { startedAt: Date; finishedAt: Date | null }[]; distillations: { startedAt: Date; finishedAt: Date | null; finalAlcohol: number | null }[] }) {
  const cooking = lot.cookings[0]; const milling = lot.millings[0]; const fermentation = lot.fermentations[0]; const distillation = lot.distillations[lot.distillations.length - 1];
  return { id: lot.id, code: lot.code, productName: "Tequila", productionDate: lot.startedAt.toISOString(), finalAlcohol: distillation?.finalAlcohol ?? null, defaultAlcohol: null, process: { cookingMethod: cooking ? "Cocción registrada" : "", cookingDate: date(cooking?.finishedAt ?? cooking?.startedAt), milling: milling ? "Molienda registrada" : "", fermentation: fermentation ? "Fermentación registrada" : "", fermentationDuration: fermentation?.startedAt && fermentation?.finishedAt ? `${Math.round((fermentation.finishedAt.getTime() - fermentation.startedAt.getTime()) / 86400000)} días` : "", distillations: lot.distillations.length ? String(lot.distillations.length) : "", distillationDate: date(distillation?.finishedAt ?? distillation?.startedAt), obtainedAlcohol: distillation?.finalAlcohol == null ? "" : String(distillation.finalAlcohol), adjustmentWater: "", barrelType: "", barrelMaterial: "", barrelOrigin: "", maturationTime: "", barrelEntryDate: "", barrelExitDate: "" } };
}

function date(value?: Date | null) { return value ? value.toISOString().slice(0, 10) : ""; }
