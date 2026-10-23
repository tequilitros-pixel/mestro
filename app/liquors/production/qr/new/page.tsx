import Link from "next/link";
import { requireModuleAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PublicQrWizard from "@/components/liquors/PublicQrWizard";
import { PageHeader } from "@/components/ui/CompactUI";

export default async function NewPublicQrPage() {
  await requireModuleAccess("/liquors/production");
  const lots = await prisma.lot.findMany({ where: { stage: { not: "TERMINADO" } }, orderBy: { createdAt: "desc" }, select: { id: true, code: true, startedAt: true, cookings: { select: { startedAt: true, finishedAt: true } }, millings: { select: { startedAt: true, finishedAt: true } }, fermentations: { select: { startedAt: true, finishedAt: true } }, distillations: { select: { startedAt: true, finishedAt: true, finalAlcohol: true } } } });
  const serialized = lots.map(toLotOption);
  return <main className="page-frame text-on-surface"><div className="mx-auto max-w-4xl"><PageHeader title="Crear QR de tequila" description="Crea la ficha pública de un lote del proceso de tequila." actions={<Link href="/liquors/production/qr" className="compact-action">Volver</Link>} /><div className="mt-5"><PublicQrWizard batches={serialized} /></div></div></main>;
}

function toLotOption(lot: { id: string; code: string; startedAt: Date; cookings: { startedAt: Date; finishedAt: Date | null }[]; millings: { startedAt: Date; finishedAt: Date | null }[]; fermentations: { startedAt: Date; finishedAt: Date | null }[]; distillations: { startedAt: Date; finishedAt: Date | null; finalAlcohol: number | null }[] }) {
  const cooking = lot.cookings[0]; const milling = lot.millings[0]; const fermentation = lot.fermentations[0]; const distillation = lot.distillations[lot.distillations.length - 1];
  return { id: lot.id, code: lot.code, productName: "Tequila", productionDate: lot.startedAt.toISOString(), finalAlcohol: distillation?.finalAlcohol ?? null, defaultAlcohol: null, process: { cookingMethod: cooking ? "Cocción registrada" : "", cookingDate: date(cooking?.finishedAt ?? cooking?.startedAt), milling: milling ? "Molienda registrada" : "", fermentation: fermentation ? "Fermentación registrada" : "", fermentationDuration: fermentation?.startedAt && fermentation?.finishedAt ? `${Math.round((fermentation.finishedAt.getTime() - fermentation.startedAt.getTime()) / 86400000)} días` : "", distillations: lot.distillations.length ? String(lot.distillations.length) : "", distillationDate: date(distillation?.finishedAt ?? distillation?.startedAt), obtainedAlcohol: distillation?.finalAlcohol == null ? "" : String(distillation.finalAlcohol), adjustmentWater: "", barrelType: "", barrelMaterial: "", barrelOrigin: "", maturationTime: "", barrelEntryDate: "", barrelExitDate: "" } };
}

function date(value?: Date | null) { return value ? value.toISOString().slice(0, 10) : ""; }
