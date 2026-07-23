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

export default async function BottleLabelPage({ params }: Props) {
  const { id } = await params;

  const bottle = await prisma.liquorBottle.findUnique({
    where: {
      id,
    },
    include: {
      bottling: {
        include: {
          batch: {
            include: {
              product: true,
            },
          },
          _count: {
            select: {
              bottles: true,
            },
          },
        },
      },
    },
  });

  if (!bottle) {
    notFound();
  }

  const bottling = bottle.bottling;
  const batch = bottling.batch;
  const product = batch.product;

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://maestro-destiladora.space"
  ).replace(/\/$/, "");

  const totalBottles = Math.max(
    bottling.producedBottles,
    bottling._count.bottles,
    bottle.serialNumber,
    1
  );

  const alcohol =
    batch.finalAlcohol ??
    product.defaultAlcohol ??
    batch.initialAlcohol ??
    null;

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8 print:min-h-0 print:bg-white print:p-0">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 print:block">
        <header className="flex flex-wrap items-center justify-center gap-3 print:hidden">
          <PrintButton />

          <Link
            href={`/liquors/bottles/${bottle.id}`}
            className="rounded-xl border border-neutral-300 bg-white px-5 py-3 font-bold text-neutral-800 transition hover:bg-neutral-50"
          >
            ← Regresar
          </Link>
        </header>

        <section className="print-label-root rounded-2xl bg-white p-8 shadow-xl print:m-0 print:rounded-none print:p-0 print:shadow-none">
          <div className="mb-6 text-center print:hidden">
            <p className="text-sm font-bold uppercase tracking-wide text-neutral-500">
              Vista previa
            </p>

            <h1 className="mt-1 text-2xl font-black text-neutral-950">
              {product.name}
            </h1>

            <p className="mt-1 text-neutral-600">
              {batch.code} · Botella{" "}
              {bottle.serialNumber.toString().padStart(3, "0")} de{" "}
              {totalBottles.toString().padStart(3, "0")}
            </p>
          </div>

          <div className="flex justify-center print:block">
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
        </section>
      </div>
    </main>
  );
}