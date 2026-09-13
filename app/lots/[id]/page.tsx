import { prisma } from "@/lib/prisma";
import LotMenu from "@/components/LotMenu";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLotEngine } from "@/lib/services/lotEngine";
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
};

export default async function LotDetailPage({ params }: Props) {
  const { id } = await params;

  const lot = await prisma.lot.findUnique({
    where: { id },
    include: {
      cookings: { include: { events: true } },
      millings: { include: { events: true } },
      fermentations: { include: { readings: true } },
      distillations: { include: { events: true } },
      expenses: true,
    },
  });

  if (!lot) notFound();
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

        <section className="mt-8 rounded-xl bg-surface-container p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-mono text-sm uppercase tracking-[0.35em] text-on-surface-variant">
                MOTOR DEL LOTE
              </p>

              <h2 className="mt-3 text-4xl font-bold text-primary">
                {engine.status}
              </h2>

              <p className="mt-3 max-w-2xl text-on-surface-variant">
                {engine.message}
              </p>
            </div>

            <Link
              href={engine.nextHref}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-center font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
            >
              {engine.nextAction}
            </Link>
          </div>

          <div className="mt-8">
            <div className="mb-2 flex justify-between text-sm text-on-surface-variant">
              <span>Progreso del lote</span>
              <span>{engine.progress}%</span>
            </div>

            <div className="h-4 rounded-full bg-surface-container-high">
              <div
                className="h-4 rounded-full bg-primary"
                style={{ width: `${engine.progress}%` }}
              />
            </div>
          </div>
        </section>
        <section className="mt-6 rounded-xl border border-outline-variant bg-surface-container p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-sm uppercase tracking-[0.35em] text-on-surface-variant">
                PRÓXIMA ACCIÓN
              </p>

              <h2 className="mt-2 text-3xl font-bold text-primary">
                {engine.nextAction}
              </h2>

              <p className="mt-2 text-on-surface-variant">
                Esta es la siguiente actividad recomendada por MAESTRO.
              </p>
            </div>

            <Link
              href={engine.nextHref}
              className="flex items-center gap-2 rounded-xl bg-primary px-8 py-4 font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] active:scale-[0.97]"
            >
              IR
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <span className="text-sm text-on-surface-variant">
              Prioridad:
            </span>

            <span
              className={`rounded-full px-3 py-1 text-sm font-bold ${
                engine.priority === "ALTA"
                  ? "bg-error text-on-error"
                  : engine.priority === "NORMAL"
                  ? "bg-secondary text-on-secondary"
                  : "bg-surface-container-high text-on-surface"
              }`}
            >
              {engine.priority}
            </span>
          </div>
        </section>
        <section className="mt-6 rounded-xl border border-outline-variant bg-surface-container p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <BrainIcon className="h-6 w-6 text-on-primary" />
            </div>

            <div>
              <p className="font-mono text-sm uppercase tracking-[0.35em] text-on-surface-variant">
                MAESTRO DICE
              </p>

              <h2 className="text-2xl font-bold text-primary">
                Recomendaciones para este lote
              </h2>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {engine.advice.map((item: string, index: number) => (
              <div
                key={index}
                className="flex items-start gap-3 rounded-xl bg-surface-container-high p-4"
              >
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-tertiary-fixed-dim" />

                <p className="text-on-surface">
                  {item}
                </p>
              </div>
            ))}
          </div>
        </section>
        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <Kpi title="Etapa actual" value={lot.stage} />
          <Kpi title="Agave" value={`${lot.agaveKg.toLocaleString()} kg`} />
          <Kpi title="ART" value={lot.art ?? "-"} />
          <Kpi title="Costo/L" value={costPerLiter > 0 ? `$${costPerLiter.toFixed(2)}` : "-"} />
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <StageCard
            icon={FlameIcon}
            title="Cocción"
            status={lastCooking?.status ?? "Pendiente"}
            main={lastCooking ? `${lastCooking.agaveKg.toLocaleString()} kg` : "Sin registro"}
            detail={`${lastCooking?.events.length ?? 0} eventos`}
            href={lastCooking ? `/cooking/${lastCooking.id}` : "/cooking"}
          />

          <StageCard
            icon={GearIcon}
            title="Molienda"
            status={lastMilling?.status ?? "Pendiente"}
            main={lastMilling?.mashLiters ? `${lastMilling.mashLiters} L mosto` : "Sin mosto"}
            detail={
              lastMilling?.brix
                ? `Último Brix: ${lastMilling.brix}`
                : `${lastMilling?.events.length ?? 0} eventos`
            }
            href={lastMilling ? `/milling/${lastMilling.id}` : "/milling"}
          />

          <StageCard
            icon={FlaskIcon}
            title="Fermentación"
            status={lastFermentation?.status ?? "Pendiente"}
            main={
              lastFermentationReading?.brix
                ? `${lastFermentationReading.brix} °Brix`
                : lastFermentation
                  ? `${lastFermentation.mustLiters} L mosto`
                  : "Sin registro"
            }
            detail={
              lastFermentationReading?.alcohol
                ? `Alcohol: ${lastFermentationReading.alcohol}%`
                : `${lastFermentation?.readings.length ?? 0} lecturas`
            }
            href={lastFermentation ? `/fermentation/${lastFermentation.id}` : "/fermentation"}
          />

          <StageCard
            icon={StillIcon}
            title="Destilación"
            status={lastDistillation?.status ?? "Pendiente"}
            main={isFinished ? `${totalLiters.toFixed(2)} L` : "Sin litros"}
            detail={`${lot.distillations.length} corridas`}
            href={lastDistillation ? `/distillation/${lastDistillation.id}` : "/distillation"}
          />

          <StageCard
            icon={DollarIcon}
            title="Costos"
            status={totalCost > 0 ? "Registrado" : "Pendiente"}
            main={`$${totalCost.toLocaleString()}`}
            detail={costPerLiter > 0 ? `$${costPerLiter.toFixed(2)} por litro` : "Sin costo/L"}
            href={`/lots/${lot.id}/costs`}
          />

          <StageCard
            icon={ChartBarIcon}
            title="Resultado"
            status="En análisis"
            main={isFinished ? `${totalLiters.toFixed(2)} L producidos` : "Sin producción"}
            detail="Expediente vivo del lote"
            href={`/lots/${lot.id}`}
          />
        </section>
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
