import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BottleQrCode from "@/components/liquors/BottleQrCode";
import { ChevronLeftIcon } from "@/components/ui/icons";

import PrintButton from "./PrintButton";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function LotQrPage({ params }: Props) {
  const { id } = await params;

  const lot = await prisma.lot.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      code: true,
      qrToken: true,
      agaveKg: true,
      totalLitersObtained: true,
      finishedAt: true,
    },
  });

  if (!lot) {
    notFound();
  }

  const isReady =
    lot.totalLitersObtained !== null && !!lot.qrToken;

  if (!isReady) {
    return (
      <main className="min-h-screen bg-background px-4 py-16 text-on-surface">
        <div className="mx-auto max-w-md text-center">
          <p className="font-mono text-sm uppercase tracking-[0.3em] text-on-surface-variant">
            MAESTRO
          </p>

          <h1 className="mt-3 text-2xl font-bold">
            Este lote aún no está listo
          </h1>

          <p className="mt-3 text-on-surface-variant">
            El código QR de trazabilidad se genera automáticamente
            al finalizar el lote {lot.code}.
          </p>

          <Link
            href={`/lots/${lot.id}`}
            className="mt-6 inline-flex items-center gap-1 rounded-xl bg-primary px-5 py-3 font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Volver al lote
          </Link>
        </div>
      </main>
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";

  const publicUrl = `${baseUrl}/q/lote/${lot.qrToken}`;

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8 print:min-h-0 print:bg-white print:p-0">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 print:block">
        <header className="flex flex-wrap items-center justify-center gap-3 print:hidden">
          <PrintButton />

          <Link
            href={`/lots/${lot.id}`}
            className="flex items-center gap-1 rounded-xl border border-neutral-300 bg-white px-5 py-3 font-bold text-neutral-800 transition duration-150 ease-out hover:scale-[1.04] hover:bg-neutral-50 active:scale-[0.97]"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Regresar
          </Link>
        </header>

        <section className="print-label-root w-full max-w-md rounded-2xl bg-white p-10 text-center shadow-xl print:m-0 print:rounded-none print:p-10 print:shadow-none">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-neutral-500">
            Destiladora del Norte · MAESTRO
          </p>

          <h1 className="mt-3 text-3xl font-black text-neutral-950">
            Lote {lot.code}
          </h1>

          <p className="mt-1 text-sm text-neutral-600">
            {formatNumber(lot.agaveKg)} kg de agave ·{" "}
            {formatNumber(lot.totalLitersObtained ?? 0)} L
            obtenidos
            {lot.finishedAt
              ? ` · ${formatDate(lot.finishedAt)}`
              : ""}
          </p>

          <div
            className="mx-auto mt-6 flex items-center justify-center"
            style={{ width: 260, height: 260 }}
          >
            <BottleQrCode value={publicUrl} size={260} />
          </div>

          <p className="mt-6 text-xs font-bold uppercase tracking-wide text-neutral-500">
            Escanea para consultar la trazabilidad
          </p>

          <p className="mt-1 break-all text-[10px] text-neutral-400">
            {publicUrl}
          </p>
        </section>
      </div>
    </main>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Mexico_City",
  }).format(value);
}
