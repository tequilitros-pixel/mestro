import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BottleLabel from "@/components/liquors/BottleLabel";
import AutoPrint from "@/components/liquors/AutoPrint"; 

type Props = {
  params: Promise<{
    id: string;
    bottlingId: string;
  }>;

  searchParams: Promise<{
    start?: string;
    end?: string;
  }>;
};

export default async function LiquorLabelsPrintPage({
  params,
  searchParams,
}: Props) {
  const { id, bottlingId } = await params;
  const query = await searchParams;

  const start = Number(query.start);
  const end = Number(query.end);

  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 1 ||
    end < start
  ) {
    redirect(`/liquors/batches/${id}/labels/${bottlingId}`);
  }

  const bottling = await prisma.liquorBottling.findFirst({
    where: {
      id: bottlingId,
      batchId: id,
    },

    select: {
      bottleSizeMl: true,
      bottledAt: true,
      expirationDate: true,

      batch: {
        select: {
          code: true,
          initialAlcohol: true,

          product: {
            select: {
              name: true,
              icon: true,
            },
          },

          recipe: {
            select: {
              targetAlcohol: true,
            },
          },
        },
      },

      bottles: {
        orderBy: {
          serialNumber: "asc",
        },

        select: {
          id: true,
          code: true,
          serialNumber: true,
          qrToken: true,
          authenticityCode: true,
          manufacturedAt: true,
          bottledAt: true,
          expirationDate: true,
        },
      },
    },
  });

  if (!bottling) {
    notFound();
  }

  // La consulta filtra por `batchId`, así que los embotellados de
  // granel (sin lote de elaboración) nunca llegan a esta pantalla.
  const batch = bottling.batch;

  if (!batch) {
    notFound();
  }

  const totalBottles = bottling.bottles.length;

  if (end > totalBottles) {
    redirect(`/liquors/batches/${id}/labels/${bottlingId}`);
  }

  const selectedBottles = bottling.bottles.slice(start - 1, end);

  const alcohol =
    batch.initialAlcohol ??
    batch.recipe.targetAlcohol ??
    null;

  return (
    <>
      <AutoPrint />

      <main className="label-print-page">
        {selectedBottles.map((bottle) => {
          const manufacturedAt =
            bottle.manufacturedAt ??
            bottle.bottledAt ??
            bottling.bottledAt;

          const expirationDate =
            bottle.expirationDate ??
            bottling.expirationDate;

          return (
            <BottleLabel
              key={bottle.id}
              bottle={{
                productName: batch.product.name,
                productIcon: batch.product.icon,
                bottleSizeMl: bottling.bottleSizeMl,
                bottleCode: bottle.code,
                batchCode: batch.code,
                serialNumber: bottle.serialNumber,
                totalBottles,
                alcohol,
                qrToken: bottle.qrToken,
                authenticityCode: bottle.authenticityCode,
                manufacturedAt,
                expirationDate,
              }}
            />
          );
        })}
      </main>
    </>
  );
}