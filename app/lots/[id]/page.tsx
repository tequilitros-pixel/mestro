import { prisma } from "@/lib/prisma";
import LotMenu from "@/components/LotMenu";
import LotProductionOverview from "@/components/lots/LotProductionOverview";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireModuleActionAccess } from "@/lib/auth";
import { getLotEngine } from "@/lib/services/lotEngine";
import { getLotFinalization } from "@/lib/lots/finalization";
import { finishProductionLot } from "@/lib/lots/finishProductionLot";
import { archiveProductionLot, ArchiveProductionLotError } from "@/lib/lots/archiveProductionLot";
import ArchiveLotControl from "@/components/lots/ArchiveLotControl";
import { calculateLotMasterBalance } from "@/lib/processCalculations";
import {
  PrinterIcon,
  BrainIcon,
  CheckIcon,
  ChevronRightIcon,
  FlameIcon,
  GearIcon,
  FlaskIcon,
  StillIcon,
  DollarIcon,
  ChartBarIcon,
} from "@/components/ui/icons";
import type { ComponentType } from "react";
import type { IconProps } from "@/components/ui/icons";
import SendToLiquorBatch from "./SendToLiquorBatch";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ archiveError?: string }>;
};

const ARCHIVE_ERRORS: Record<string, string> = {
  MISSING_CONFIRMATION: "Confirma que el lote es una prueba sin producto final real.",
  MISSING_REASON: "Indica un motivo de al menos 10 caracteres.",
  HAS_REAL_OUTPUT: "Este lote tiene salida real o inventario asociado; no se puede archivar como prueba.",
  LOT_ALREADY_FINISHED: "Un lote finalizado no se puede archivar como prueba.",
  ALREADY_ARCHIVED: "Este lote ya fue archivado.",
  LOT_NOT_FOUND: "No se encontró el lote.",
};

export default async function LotDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { archiveError } = (await searchParams) ?? {};

  const lot = await prisma.lot.findUnique({
    where: { id },
    include: {
      cookings: { orderBy: { startedAt: "asc" }, include: { events: true } },
      millings: { orderBy: { startedAt: "asc" }, include: { events: true } },
      fermentations: { orderBy: { startedAt: "asc" }, include: { readings: true } },
      distillations: { orderBy: { startedAt: "asc" }, include: { events: true } },
      expenses: true,
    },
  });

  if (!lot) notFound();

  if (lot.archivedAt) {
    return (
      <main className="min-h-screen bg-background p-10 text-on-surface">
        <div className="mx-auto max-w-4xl">
          <p className="font-mono text-sm uppercase tracking-[0.4em] text-on-surface-variant">MAESTRO</p>
          <h1 className="mt-3 text-5xl font-bold text-primary">Lote {lot.code}</h1>
          <section className="mt-8 rounded-2xl border border-outline-variant bg-surface-container p-6 sm:p-8">
            <p className="font-mono text-sm uppercase tracking-[0.3em] text-on-surface-variant">Expediente archivado</p>
            <h2 className="mt-2 text-2xl font-bold">Prueba anulada sin producción final</h2>
            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-on-surface-variant">Archivado el</dt><dd className="mt-1 font-semibold">{lot.archivedAt.toLocaleString("es-MX")}</dd></div>
              <div><dt className="text-on-surface-variant">Motivo</dt><dd className="mt-1 font-semibold">{lot.archiveReason}</dd></div>
            </dl>
            <p className="mt-6 text-sm text-on-surface-variant">Este registro se conserva para trazabilidad. No genera litros finales ni movimientos de inventario.</p>
            <Link href="/lots?status=ARCHIVED" className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-on-primary">Ver lotes archivados</Link>
          </section>
        </div>
      </main>
    );
  }
  const engine = getLotEngine(lot);
  const lastCooking = lot.cookings.at(-1);
  const lastMilling = lot.millings.at(-1);
  const lastFermentation = lot.fermentations.at(-1);
  const lastDistillation = lot.distillations.at(-1);

  const totalCost = lot.expenses.reduce((sum, e) => sum + e.amount, 0);

  // Igual que en Costos: usamos el total autoritativo fijado en
  // "Finalizar lote", no la suma de lecturas intermedias de litros.
  const totalLiters = lot.totalLitersObtained ?? 0;
  const isFinished = lot.totalLitersObtained !== null;
  const finalization = getLotFinalization({
    stage: lot.stage,
    finishedAt: lot.finishedAt,
    totalLitersObtained: lot.totalLitersObtained,
    runs: lot.distillations,
  });

  const masterBalance = calculateLotMasterBalance({
    agaveKg: lot.agaveKg,
    art: lot.art,
    totalLitersObtained: lot.totalLitersObtained,
    totalCost,
    cookings: lot.cookings,
    millings: lot.millings,
    fermentations: lot.fermentations,
    distillations: lot.distillations,
  });

  async function finishLotAction(_formData: FormData) {
    "use server";
    void _formData;

    const user = await requireModuleActionAccess("/lots");
    await finishProductionLot({ lotId: id, actorId: user.id });
    redirect(`/lots/${id}?finished=1`);
  }

  async function archiveLotAction(formData: FormData) {
    "use server";
    const user = await requireModuleActionAccess("/lots");
    if (formData.get("confirmed") !== "on") {
      redirect(`/lots/${id}?archiveError=MISSING_CONFIRMATION`);
    }
    try {
      await archiveProductionLot({
        lotId: id,
        actorId: user.id,
        reason: String(formData.get("reason") ?? ""),
      });
    } catch (caught) {
      if (caught instanceof ArchiveProductionLotError) {
        redirect(`/lots/${id}?archiveError=${caught.code}`);
      }
      throw caught;
    }
    redirect(`/lots/${id}`);
  }

  const costPerLiter = totalLiters > 0 ? totalCost / totalLiters : 0;

  const lastFermentationReading = lastFermentation?.readings.at(-1);

  /*
   * Recetas disponibles para convertir este lote en una elaboración.
   * Se marca cuáles tienen producto de inventario vinculado, porque
   * sin ese vínculo el embotellado no abona nada al inventario y el
   * usuario no se entera.
   */
  const recipeOptions = isFinished
    ? await prisma.liquorRecipe.findMany({
        where: { active: true },
        orderBy: [{ product: { name: "asc" } }, { version: "desc" }],
        select: {
          id: true,
          name: true,
          version: true,
          productId: true,
          product: {
            select: { name: true, icon: true, inventoryProductId: true },
          },
        },
      })
    : [];

  const sentBatches = isFinished
    ? await prisma.liquorBatch.findMany({
        where: { lotId: lot.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, code: true },
      })
    : [];

  return (
    <main className="min-h-screen bg-background p-10 text-on-surface">
      <div className="mx-auto max-w-7xl">

        <p className="font-mono text-sm uppercase tracking-[0.4em] text-on-surface-variant">
          MAESTRO
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-5xl font-bold text-primary">Lote {lot.code}</h1>

          {isFinished && (
            <Link
              href={`/lots/${lot.id}/qr`}
              className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-high px-5 py-3 font-bold text-primary transition duration-150 ease-out hover:scale-[1.04] hover:bg-surface-container-highest active:scale-[0.97]"
            >
              <PrinterIcon className="h-5 w-5" />
              Imprimir QR del lote
            </Link>
          )}
        </div>

        <LotMenu
          id={lot.id}
          isFinished={isFinished}
          processIds={{
            cooking: lastCooking?.id,
            milling: lastMilling?.id,
            fermentation: lastFermentation?.id,
            distillation: lastDistillation?.id,
          }}
        />

        <LotProductionOverview lotId={lot.id} nextAction={engine.nextAction} nextHref={engine.nextHref} status={engine.status} progress={engine.progress} />

        {isFinished && (
          <div className="mt-8">
            <SendToLiquorBatch
              lotId={lot.id}
              lotCode={lot.code}
              totalLiters={totalLiters}
              alreadySent={sentBatches}
              recipes={recipeOptions.map((recipe) => ({
                id: recipe.id,
                name: recipe.name,
                version: recipe.version,
                productId: recipe.productId,
                productName: recipe.product.name,
                productIcon: recipe.product.icon,
                hasInventoryLink: recipe.product.inventoryProductId !== null,
              }))}
            />
          </div>
        )}

        {finalization.ready && (
          <section
            id="finalizar-lote"
            className="mt-8 rounded-2xl border border-secondary/30 bg-surface-container p-6 sm:p-8"
          >
            <p className="font-mono text-sm uppercase tracking-[0.35em] text-secondary">
              Último paso
            </p>
            <h2 className="mt-3 text-3xl font-bold text-primary">
              Finalizar lote {lot.code}
            </h2>
            <p className="mt-2 max-w-2xl text-on-surface-variant">
              Se guardarán automáticamente {finalization.totalLiters.toLocaleString("es-MX")} L de las rectificaciones terminadas, la fecha de cierre y el QR de trazabilidad.
            </p>
            <form action={finishLotAction} className="mt-6">
              <button
                type="submit"
                className="rounded-xl bg-primary px-6 py-3 font-bold text-on-primary transition hover:opacity-90 active:scale-[0.98]"
              >
                Finalizar lote
              </button>
            </form>
          </section>
        )}


      </div>
    </main>
  );
}

function Kpi({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-surface-container p-5">
      <p className="text-sm text-on-surface-variant">{title}</p>
      <p className="mt-2 text-2xl font-bold text-primary">{value}</p>
    </div>
  );
}

function StageCard({
  icon: Icon,
  title,
  status,
  main,
  detail,
  href,
}: {
  icon: ComponentType<IconProps>;
  title: string;
  status: string;
  main: string;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl bg-surface-container p-6 transition hover:bg-surface-container-high"
    >
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-primary">
          <Icon className="h-5 w-5 text-on-surface-variant" />
          {title}
        </h2>
        <span className="rounded-full border border-outline-variant bg-surface-container-high px-3 py-1 text-sm text-on-surface-variant">
          {status}
        </span>
      </div>

      <p className="mt-6 text-4xl font-bold text-primary">{main}</p>
      <p className="mt-3 text-on-surface-variant">{detail}</p>

      <p className="mt-6 flex items-center gap-1 text-on-surface-variant">
        Abrir etapa
        <ChevronRightIcon className="h-4 w-4" />
      </p>
    </Link>
  );
}
