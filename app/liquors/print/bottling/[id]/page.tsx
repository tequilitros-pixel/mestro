import Link from "next/link";
import { notFound } from "next/navigation";

import BottleLabel from "@/components/liquors/BottleLabel";
import { prisma } from "@/lib/prisma";

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
  const product = batch.product;

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://maestro-destiladora.space"
  ).replace(/\/$/, "");

  const totalBottles = Math.max(
    bottling.producedBottles,
    bottling.bottles.length,
    1
  );

  const alcohol =
    batch.finalAlcohol ??
    product.defaultAlcohol ??
    batch.initialAlcohol ??
    null;

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 rounded-2xl bg-white p-6 shadow-sm print:hidden">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-neutral-500">
                Impresión masiva
              </p>

              <h1 className="mt-1 text-3xl font-black text-neutral-950">
                {product.name}
              </h1>

              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-neutral-600">
                <span>
                  Lote:{" "}
                  <strong className="text-neutral-900">
                    {batch.code}
                  </strong>
                </span>

                <span>
                  Embotellado:{" "}
                  <strong className="text-neutral-900">
                    {bottling.code}
                  </strong>
                </span>

                <span>
                  Botellas registradas:{" "}
                  <strong className="text-neutral-900">
                    {bottling.bottles.length}
                  </strong>
                </span>

                <span>
                  Presentación:{" "}
                  <strong className="text-neutral-900">
                    {bottling.bottleSizeMl} ml
                  </strong>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <PrintButton labelCount={bottling.bottles.length} />

              <Link
                href="/liquors/bottling"
                className="rounded-lg border border-neutral-300 bg-white px-5 py-3 font-bold text-neutral-800 transition hover:bg-neutral-50"
              >
                ← Regresar
              </Link>
            </div>
          </div>
        </header>

        {bottling.bottles.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center print:hidden">
            <h2 className="text-xl font-black text-neutral-900">
              No hay botellas registradas
            </h2>

            <p className="mt-2 text-neutral-600">
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
                    productName: product.name,
                    productIcon: product.icon,
                    bottleSizeMl: bottling.bottleSizeMl,
                    bottleCode: bottle.code,
                    batchCode: batch.code,
                    serialNumber: bottle.serialNumber,
                    totalBottles,
                    alcohol,
                    qrToken: bottle.qrToken,
                    qrUrl: `${appUrl}/liquors/qr/${bottle.qrToken}`,
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