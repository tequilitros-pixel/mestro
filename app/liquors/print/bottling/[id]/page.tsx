import Link from "next/link";
import { notFound } from "next/navigation";

import BottleLabel from "@/components/liquors/BottleLabel";
import { prisma } from "@/lib/prisma";
import { resolveBottleOrigin } from "@/lib/liquors/bottleOrigin";

import PrintButton from "./PrintButton";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function BottlingLabelsPage({
  params,
}: Props) {
  const { id } = await params;

  const bottling = await prisma.liquorBottling.findUnique({
    where: {
      id,
    },
    include: {
      batch: {
        include: {
          product: true,
        },
      },

      // El tequila blanco se embotella directo del granel: no hay lote
      // de elaboración, el origen impreso es la materia prima.
      rawMaterial: true,
      bottles: {
        orderBy: {
          serialNumber: "asc",
        },
      },
    },
  });

  if (!bottling) {
    notFound();
  }

  const batch = bottling.batch;
  const origin = resolveBottleOrigin(bottling);

  const totalBottles = Math.max(
    bottling.producedBottles,
    bottling.bottles.length,
    1
  );

  // El granel no trae graduación registrada, así que la etiqueta la
  // omite en lugar de inventar un valor.
  const alcohol = batch
    ? batch.finalAlcohol ??
      batch.product.defaultAlcohol ??
      batch.initialAlcohol ??
      null
    : null;

  return (
    <main className="min-h-screen bg-background px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 rounded-2xl border border-outline-variant bg-surface-container p-6 print:hidden">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-on-surface-variant">
                Impresión masiva
              </p>

              <h1 className="mt-1 text-3xl font-black text-on-surface">
                {origin.productName}
              </h1>

              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-on-surface-variant">
                <span>
                  {origin.fromBulk ? origin.sourceLabel : "Lote"}:{" "}
                  <strong className="text-on-surface">
                    {origin.sourceCode}
                  </strong>
                </span>

                <span>
                  Embotellado:{" "}
                  <strong className="text-on-surface">
                    {bottling.code}
                  </strong>
                </span>

                <span>
                  Botellas registradas:{" "}
                  <strong className="text-on-surface">
                    {bottling.bottles.length}
                  </strong>
                </span>

                <span>
                  Presentación:{" "}
                  <strong className="text-on-surface">
                    {bottling.bottleSizeMl} ml
                  </strong>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <PrintButton labelCount={bottling.bottles.length} />

              <Link
                href="/liquors/bottling"
                className="rounded-lg border border-outline-variant bg-surface-container-high px-5 py-3 font-bold text-on-surface transition hover:bg-surface-container-highest"
              >
                ← Regresar
              </Link>
            </div>
          </div>
        </header>

        {bottling.bottles.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-outline-variant bg-surface-container/50 p-12 text-center print:hidden">
            <h2 className="text-xl font-black text-on-surface">
              No hay botellas registradas
            </h2>

            <p className="mt-2 text-on-surface-variant">
              Este embotellado todavía no tiene botellas individuales.
            </p>
          </section>
        ) : (
          <section
            className="grid justify-center gap-4 print:block"
            style={{
              gridTemplateColumns: "repeat(auto-fit, 50mm)",
            }}
          >
            {bottling.bottles.map((bottle) => (
              <div
                key={bottle.id}
                className="break-inside-avoid print:m-0"
                style={{
                  width: "50mm",
                  height: "30mm",
                  breakInside: "avoid",
                  pageBreakInside: "avoid",
                }}
              >
                <BottleLabel
                  bottle={{
                    productName: origin.productName,
                    productIcon: origin.productIcon,
                    bottleSizeMl: bottling.bottleSizeMl,
                    bottleCode: bottle.code,
                    batchCode: origin.sourceCode,
                    serialNumber: bottle.serialNumber,
                    totalBottles,
                    alcohol,
                    qrToken: bottle.qrToken,
                
                  }}
                />
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}