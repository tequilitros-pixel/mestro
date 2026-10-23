import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  dateForDisplay,
  emptyPayload,
  isVisible,
  parseBatchCodeDate,
  publicMapUrl,
  type PublicQrPayload,
  type PublicQrVisibility,
} from "@/lib/publicQr";

type Props = { params: Promise<{ id: string }> };

export default async function PublicLiquorQrPage({ params }: Props) {
  const { id } = await params;
  const profile = await prisma.publicQrProfile.findUnique({
    where: { publicId: id },
    select: {
      publicId: true,
      batchId: true,
      productName: true,
      lotCode: true,
      payload: true,
      visibility: true,
      status: true,
      batch: {
        select: {
          productionDate: true,
          finalAlcohol: true,
          expirationDate: true,
          product: { select: { name: true, defaultAlcohol: true } },
        },
      },
    },
  });

  if (!profile || profile.status !== "PUBLICADO" || !profile.batchId) notFound();

  const payload = mergePayload(profile.payload as unknown as Partial<PublicQrPayload>);
  const visibility = profile.visibility as unknown as PublicQrVisibility;
  const productName = payload.product.commercialName || profile.productName;
  const lotCode = profile.lotCode || payload.identification.lotCode;
  const elaborationDate =
    parseBatchCodeDate(lotCode) ||
    payload.identification.elaborationDate ||
    profile.batch?.productionDate?.toISOString().slice(0, 10) ||
    "";
  const preferredBefore = addMonths(elaborationDate, 48);
  const alcohol =
    payload.product.alcoholPercent ||
    (profile.batch?.finalAlcohol ?? profile.batch?.product.defaultAlcohol)?.toString() ||
    "";
  const presentation = payload.product.presentation || "1 L";
  const place = payload.origin.place || "Colotlán, Jalisco";
  const introduction =
    payload.consumer.introduction ||
    `Licor elaborado por ${payload.origin.producer || "Casa Destiladora del Norte"} en ${place}.`;

  const detailRows = [
    ["Producto", productName, "commercialName"],
    ["Tipo", payload.product.type, "productType"],
    ["Clase", payload.product.className, "productClass"],
    ["Lote", lotCode, "lotCode"],
    ["Fecha de elaboración", dateForDisplay(elaborationDate), "elaborationDate"],
    ["Fecha de envasado", dateForDisplay(payload.identification.bottlingDate), "bottlingDate"],
    ["Presentación", presentation, "presentation"],
    ["% Alc. Vol.", alcohol ? `${alcohol}%` : "", "alcoholPercent"],
    ["Consumo preferente antes de", dateForDisplay(preferredBefore), "preferredBefore"],
  ].filter(([, value, key]) => value && (key === "preferredBefore" || isVisible(visibility, key)));

  const originRows = [
    ["Ubicación", place, "place"],
    ["Productor", payload.origin.producer, "producer"],
    ["Origen del agave", payload.origin.agaveOrigin, "agaveOrigin"],
    ["Región", payload.origin.region, "region"],
    ["Variedad de agave", payload.origin.agaveVariety, "agaveVariety"],
    ["Año/cosecha", payload.origin.harvestYear, "harvestYear"],
  ].filter(([, value, key]) => value && isVisible(visibility, key));

  const processRows = [
    ["Método de cocción", payload.process.cookingMethod, "cookingMethod"],
    ["Fecha de cocción", dateForDisplay(payload.process.cookingDate), "cookingDate"],
    ["Molienda", payload.process.milling, "milling"],
    ["Fermentación", payload.process.fermentation, "fermentation"],
    ["Duración de fermentación", payload.process.fermentationDuration, "fermentationDuration"],
    ["Destilaciones", payload.process.distillations, "distillations"],
    ["Fecha de destilación", dateForDisplay(payload.process.distillationDate), "distillationDate"],
    ["Graduación obtenida", payload.process.obtainedAlcohol, "obtainedAlcohol"],
    ["Agua de ajuste", payload.process.adjustmentWater, "adjustmentWater"],
  ].filter(([, value, key]) => value && isVisible(visibility, key));

  const barrelRows = [
    ["Tipo", payload.process.barrelType, "barrelType"],
    ["Material", payload.process.barrelMaterial, "barrelMaterial"],
    ["Procedencia", payload.process.barrelOrigin, "barrelOrigin"],
    ["Tiempo", payload.process.maturationTime, "maturationTime"],
    ["Entrada", dateForDisplay(payload.process.barrelEntryDate), "barrelEntryDate"],
    ["Salida", dateForDisplay(payload.process.barrelExitDate), "barrelExitDate"],
  ].filter(([, value, key]) => value && isVisible(visibility, key));

  const traceRows = [
    ["NOM", payload.traceability.nom, "nom"],
    ["Productor autorizado", payload.traceability.authorizedProducer, "authorizedProducer"],
    ["Certificado", payload.traceability.certificateNumber, "certificateNumber"],
    ["Referencia", payload.traceability.certificationReference, "certificationReference"],
    ["Código interno", payload.traceability.internalCode, "internalCode"],
    ["Contacto", payload.traceability.contact, "contact"],
    ["Página web", payload.traceability.website, "website"],
  ].filter(([, value, key]) => value && isVisible(visibility, key));

  const mapUrl = publicMapUrl(place);

  return (
    <main className="min-h-screen bg-[#071714] px-4 py-6 text-[#f5f7ef] sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <header className="overflow-hidden rounded-[2rem] border border-[#789b78]/30 bg-[radial-gradient(circle_at_top_right,_#315c45,_#102c25_48%,_#0a1d19)] p-6 shadow-2xl sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#c7a55a]">Casa Destiladora del Norte</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-6xl">{productName}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#d0ded1]">{introduction}</p>
        </header>

        <section className="mt-4 rounded-[1.5rem] border border-[#789b78]/20 bg-[#102c25] p-5 sm:p-7">
          <h2 className="text-xl font-semibold">Ficha del producto</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {detailRows.map(([label, value]) => <InfoRow key={label} label={label} value={value} />)}
          </div>
        </section>

        {originRows.length > 0 && <section className="mt-4 rounded-[1.5rem] border border-[#789b78]/20 bg-[#102c25] p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Origen</h2>
            {isVisible(visibility, "place") && <a className="text-sm font-semibold text-[#f4d88d] underline" href={mapUrl} target="_blank" rel="noreferrer">Ver ubicación en Google Maps</a>}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">{originRows.map(([label, value]) => <InfoRow key={label} label={label} value={value} />)}</div>
        </section>}

        {isVisible(visibility, "process") && processRows.length > 0 && <RowsSection title="Proceso" rows={processRows} />}
        {isVisible(visibility, "barrel") && barrelRows.length > 0 && <RowsSection title="Maduración y barrica" rows={barrelRows} />}
        {isVisible(visibility, "description") && payload.consumer.description && <TextSection title="Descripción" text={payload.consumer.description} />}
        {(["aroma", "flavor", "body", "finish"] as const).some((key) => isVisible(visibility, key) && payload.consumer[key]) && <section className="mt-4 grid gap-3 sm:grid-cols-2">{([["Aroma", payload.consumer.aroma, "aroma"], ["Sabor", payload.consumer.flavor, "flavor"], ["Cuerpo", payload.consumer.body, "body"], ["Final", payload.consumer.finish, "finish"]] as const).filter(([, value, key]) => value && isVisible(visibility, key)).map(([label, value]) => <TextSection key={label} title={label} text={value} />)}</section>}
        {isVisible(visibility, "tastingNotes") && payload.consumer.tastingNotes && <TextSection title="Notas de cata" text={payload.consumer.tastingNotes} />}
        {isVisible(visibility, "recommendation") && payload.consumer.recommendation && <TextSection title="Recomendación de consumo" text={payload.consumer.recommendation} />}
        {(isVisible(visibility, "temperature") && payload.consumer.temperature || isVisible(visibility, "pairing") && payload.consumer.pairing) && <RowsSection title="Sugerencias" rows={[["Temperatura", payload.consumer.temperature], ["Maridaje", payload.consumer.pairing]].filter(([, value]) => value)} />}
        {traceRows.length > 0 && <RowsSection title="Datos de trazabilidad" rows={traceRows} />}

        <footer className="px-2 py-8 text-center text-xs text-[#a9c0ad]">Ficha pública · ID {profile.publicId}</footer>
      </div>
    </main>
  );
}

function mergePayload(value: Partial<PublicQrPayload>): PublicQrPayload {
  const base = emptyPayload();
  return {
    ...base,
    ...value,
    product: { ...base.product, ...(value.product ?? {}) },
    identification: { ...base.identification, ...(value.identification ?? {}) },
    origin: { ...base.origin, ...(value.origin ?? {}) },
    process: { ...base.process, ...(value.process ?? {}) },
    consumer: { ...base.consumer, ...(value.consumer ?? {}) },
    traceability: { ...base.traceability, ...(value.traceability ?? {}) },
  };
}

function addMonths(value: string, months: number) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function InfoRow({ label, value }: { label: unknown; value: unknown }) {
  return <div className="rounded-xl border border-[#789b78]/20 bg-[#173b32]/70 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[#a9c0ad]">{String(label)}</p><p className="mt-1 text-sm font-semibold text-[#f5f7ef]">{String(value)}</p></div>;
}

function RowsSection({ title, rows }: { title: string; rows: unknown[][] }) {
  return <section className="mt-4 rounded-[1.5rem] border border-[#789b78]/20 bg-[#102c25] p-5 sm:p-7"><h2 className="text-xl font-semibold">{title}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{rows.map(([label, value]) => <InfoRow key={String(label)} label={label} value={value} />)}</div></section>;
}

function TextSection({ title, text }: { title: string; text: string }) {
  return <section className="mt-4 rounded-[1.5rem] border border-[#789b78]/20 bg-[#102c25] p-5 sm:p-7"><h2 className="text-xl font-semibold">{title}</h2><p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#d0ded1]">{text}</p></section>;
}
