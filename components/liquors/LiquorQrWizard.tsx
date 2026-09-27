"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { publishPublicQrAction, savePublicQrAction } from "@/app/actions/publicQr";
import {
  DEFAULT_VISIBILITY,
  emptyPayload,
  formatIsoDate,
  type PublicQrPayload,
  type PublicQrRecord,
  type PublicQrVisibility,
  VISIBILITY_LABELS,
} from "@/lib/publicQr";
import { PublicQrPreview } from "@/components/liquors/PublicQrWizard";

type LiquorBatchOption = {
  id: string;
  code: string;
  productName: string;
  productionDate: string;
  finalAlcohol: number | null;
  defaultAlcohol: number | null;
};

type Props = {
  liquorBatches: LiquorBatchOption[];
  initial?: PublicQrRecord | null;
};

const steps = ["Producto", "Lote", "Origen", "Proceso", "Información", "Trazabilidad", "Publicación", "Vista previa"];
const productFields = [
  ["commercialName", "Nombre comercial", "text"],
  ["type", "Tipo de licor", "select"],
  ["className", "Variedad / sabor", "text"],
  ["presentation", "Presentación", "select"],
  ["alcoholPercent", "% Alc. Vol.", "number"],
] as const;
const originFields = [
  ["place", "Lugar de elaboración"],
  ["producer", "Productor"],
  ["agaveOrigin", "Origen de ingredientes"],
  ["region", "Región"],
  ["agaveVariety", "Ingrediente principal"],
  ["harvestYear", "Año / temporada"],
] as const;
const processFields = [
  ["cookingMethod", "Método de preparación"],
  ["cookingDate", "Fecha de preparación", "date"],
  ["milling", "Molienda / preparación de fruta"],
  ["fermentation", "Fermentación"],
  ["fermentationDuration", "Duración de fermentación"],
  ["distillations", "Destilaciones"],
  ["distillationDate", "Fecha de destilación", "date"],
  ["obtainedAlcohol", "Graduación obtenida"],
  ["adjustmentWater", "Agua utilizada para ajuste"],
] as const;
const consumerFields = [
  ["introduction", "Introducción breve"],
  ["description", "Descripción del producto"],
  ["aroma", "Aroma"],
  ["flavor", "Sabor"],
  ["body", "Cuerpo"],
  ["finish", "Final"],
  ["tastingNotes", "Notas de cata"],
  ["recommendation", "Recomendación de consumo"],
  ["temperature", "Temperatura recomendada"],
  ["pairing", "Maridaje"],
] as const;
const traceFields = [
  ["nom", "NOM"],
  ["authorizedProducer", "Productor autorizado"],
  ["certificateNumber", "Número de certificado"],
  ["certificationReference", "Registro o referencia"],
  ["internalCode", "Código interno"],
  ["contact", "Contacto"],
  ["website", "Página web"],
] as const;
const liquorVisibilityKeys = [
  "productType", "productClass", "presentation", "lotCode", "elaborationDate", "bottlingDate", "alcoholPercent",
  "place", "producer", "agaveOrigin", "region", "agaveVariety", "harvestYear", "process", "introduction", "description",
  "aroma", "flavor", "body", "finish", "tastingNotes", "recommendation", "temperature", "pairing", "nom", "authorizedProducer",
  "certificateNumber", "certificationReference", "internalCode", "contact", "website",
] as const;

function liquorPayload(value?: Partial<PublicQrPayload> | null): PublicQrPayload {
  const base = emptyPayload();
  base.product.type = "Licor";
  base.product.className = "";
  base.product.presentation = "1 L";
  base.consumer.introduction = "Licor elaborado por Casa Destiladora del Norte en Colotlán, Jalisco.";
  return {
    ...base,
    ...value,
    product: { ...base.product, ...(value?.product ?? {}) },
    identification: { ...base.identification, ...(value?.identification ?? {}) },
    origin: { ...base.origin, ...(value?.origin ?? {}), place: value?.origin?.place || base.origin.place, producer: value?.origin?.producer || base.origin.producer },
    process: { ...base.process, ...(value?.process ?? {}) },
    consumer: { ...base.consumer, ...(value?.consumer ?? {}) },
    traceability: { ...base.traceability, ...(value?.traceability ?? {}) },
  };
}

export default function LiquorQrWizard({ liquorBatches, initial }: Props) {
  const [step, setStep] = useState(0);
  const [payload, setPayload] = useState<PublicQrPayload>(() => liquorPayload(initial?.payload));
  const [visibility, setVisibility] = useState<PublicQrVisibility>(() => ({ ...DEFAULT_VISIBILITY, ...(initial?.visibility ?? {}) }));
  const [batchId, setBatchId] = useState(initial?.batchId ?? "");
  const [recordId, setRecordId] = useState(initial?.id ?? "");
  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const selectedBatch = liquorBatches.find((batch) => batch.id === batchId);

  const update = (section: keyof PublicQrPayload, key: string, value: string) => {
    setPayload((current) => ({ ...current, [section]: { ...current[section], [key]: value } }));
  };

  function selectBatch(value: string) {
    setBatchId(value);
    const batch = liquorBatches.find((item) => item.id === value);
    if (!batch) return;
    setPayload((current) => ({
      ...current,
      product: { ...current.product, commercialName: current.product.commercialName || batch.productName, alcoholPercent: current.product.alcoholPercent || String(batch.finalAlcohol ?? batch.defaultAlcohol ?? "") },
      identification: { ...current.identification, lotCode: batch.code, elaborationDate: current.identification.elaborationDate || formatIsoDate(batch.productionDate) },
    }));
  }

  function save(publish = false) {
    setMessage("");
    if (!batchId) {
      setMessage("Selecciona un lote de elaboración antes de guardar la ficha.");
      return;
    }
    startTransition(async () => {
      try {
        const input = JSON.stringify({ id: recordId || undefined, lotId: null, batchId: batchId || null, payload, visibility });
        const result = publish ? await publishPublicQrAction(input) : await savePublicQrAction(input);
        setRecordId(result.id);
        setPublicId(result.publicId);
        setMessage(publish ? "Publicado. La URL del QR quedó permanente." : "Borrador guardado.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "No fue posible guardar la ficha.");
      }
    });
  }

  return <div className="space-y-5">
    <div className="flex gap-1 overflow-x-auto pb-1" aria-label="Pasos del editor de QR de licor">{steps.map((label, index) => <button key={label} type="button" onClick={() => setStep(index)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${step === index ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"}`}>{index + 1}. {label}</button>)}</div>
    {step === 0 && <WizardCard title="Paso 1 · Producto" description="Información comercial del licor. No modifica la receta ni el lote."><div className="grid gap-3 sm:grid-cols-2">{productFields.map(([key, label, type]) => <Field key={key} label={label} value={payload.product[key]} type={type} options={key === "type" ? ["Licor", "Licor de frutas", "Sangría", "Otro"] : key === "presentation" ? ["250 ml", "500 ml", "750 ml", "1 L", "Otra"] : undefined} onChange={(value) => update("product", key, value)} />)}</div></WizardCard>}
    {step === 1 && <WizardCard title="Paso 2 · Lote de licor" description="Selecciona una elaboración existente para conservar su relación original."><div className="space-y-3"><label className="block text-sm font-medium text-on-surface">Lote de elaboración<select className="compact-field mt-1 w-full border border-outline-variant bg-surface text-on-surface" value={batchId} onChange={(event) => selectBatch(event.target.value)} disabled={Boolean(recordId)}><option value="">Selecciona un lote…</option>{liquorBatches.map((batch) => <option key={batch.id} value={batch.id}>{batch.code} · {batch.productName}</option>)}</select></label>{selectedBatch && <p className="rounded-lg bg-tertiary-fixed-dim/10 px-3 py-2 text-xs text-on-surface-variant">Los datos del lote se precargaron y la relación queda bloqueada al publicar.</p>}<div className="grid gap-3 sm:grid-cols-2"><Field label="Lote" value={payload.identification.lotCode} onChange={(value) => update("identification", "lotCode", value)} disabled={Boolean(selectedBatch) || Boolean(recordId)} /><Field label="Fecha de elaboración" value={payload.identification.elaborationDate} type="date" onChange={(value) => update("identification", "elaborationDate", value)} disabled={Boolean(selectedBatch) || Boolean(recordId)} /><Field label="Fecha de envasado" value={payload.identification.bottlingDate} type="date" onChange={(value) => update("identification", "bottlingDate", value)} /><Field label="Número de botella (opcional)" value={payload.identification.bottleNumber} onChange={(value) => update("identification", "bottleNumber", value)} /><Field label="Total de botellas (opcional)" value={payload.identification.totalBottles} type="number" onChange={(value) => update("identification", "totalBottles", value)} /></div></div></WizardCard>}
    {step === 2 && <WizardCard title="Paso 3 · Origen" description="Edita lo que el cliente podrá conocer del origen del producto."><div className="grid gap-3 sm:grid-cols-2">{originFields.map(([key, label]) => <Field key={key} label={label} value={payload.origin[key]} onChange={(value) => update("origin", key, value)} />)}</div></WizardCard>}
    {step === 3 && <WizardCard title="Paso 4 · Proceso" description="Publica sólo los datos que quieras compartir; no incluye costos ni recetas internas."><div className="grid gap-3 sm:grid-cols-2">{processFields.map(([key, label, type]) => <Field key={key} label={label} value={payload.process[key]} type={type ?? "text"} onChange={(value) => update("process", key, value)} />)}</div></WizardCard>}
    {step === 4 && <WizardCard title="Paso 5 · Información para el consumidor"><div className="grid gap-3 sm:grid-cols-2">{consumerFields.map(([key, label]) => <Field key={key} label={label} value={payload.consumer[key]} multiline={key === "description" || key === "tastingNotes" || key === "recommendation"} onChange={(value) => update("consumer", key, value)} />)}</div></WizardCard>}
    {step === 5 && <WizardCard title="Paso 6 · Trazabilidad / etiqueta" description="Deja vacíos los datos que no estén confirmados."><div className="grid gap-3 sm:grid-cols-2">{traceFields.map(([key, label]) => <Field key={key} label={label} value={payload.traceability[key]} type={key === "website" ? "url" : "text"} onChange={(value) => update("traceability", key, value)} />)}</div></WizardCard>}
    {step === 6 && <WizardCard title="Paso 7 · Qué verá el cliente" description="Activa u oculta campos sin tocar el lote ni el QR."><div className="grid gap-2 sm:grid-cols-2">{liquorVisibilityKeys.map((key) => <label key={key} className="flex items-center justify-between rounded-lg border border-outline-variant px-3 py-2 text-sm"><span>{liquorLabel(key)}</span><input type="checkbox" checked={visibility[key] !== false} onChange={(event) => setVisibility((current) => ({ ...current, [key]: event.target.checked }))} /></label>)}</div></WizardCard>}
    {step === 7 && <WizardCard title="Paso 8 · Vista previa" description="Así se verá la ficha del licor al escanear el QR."><div className="mx-auto max-w-sm"><PublicQrPreview payload={payload} visibility={visibility} /></div></WizardCard>}
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant pt-4"><button type="button" className="compact-action" disabled={step === 0 || pending} onClick={() => setStep((value) => Math.max(0, value - 1))}>Atrás</button><div className="flex flex-wrap gap-2"><button type="button" className="compact-action" disabled={pending} onClick={() => save(false)}>{pending ? "Guardando…" : "Guardar borrador"}</button>{step < steps.length - 1 ? <button type="button" className="compact-action bg-primary text-on-primary" onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}>Siguiente</button> : <button type="button" className="compact-action bg-primary text-on-primary" disabled={pending || !batchId} onClick={() => save(true)}>Publicar y crear QR</button>}</div></div>
    {message && <p className="rounded-lg bg-surface-container px-3 py-2 text-sm text-on-surface-variant">{message}{publicId && <> {" "}<Link className="font-semibold text-primary underline" href={`/q/licor/${publicId}`} target="_blank">Abrir ficha pública</Link></>}</p>}
    {recordId && <p className="text-xs text-on-surface-variant">ID estable: {publicId || recordId}</p>}
  </div>;
}

function liquorLabel(key: string) {
  const custom: Record<string, string> = { productType: "Tipo de licor", productClass: "Variedad / sabor", agaveOrigin: "Origen de ingredientes", agaveVariety: "Ingrediente principal", process: "Proceso" };
  return custom[key] ?? VISIBILITY_LABELS[key] ?? key;
}

function Field({ label, value, onChange, type = "text", options, multiline, disabled }: { label: string; value: string; onChange: (value: string) => void; type?: string; options?: readonly string[]; multiline?: boolean; disabled?: boolean }) {
  const control = "compact-field mt-1 w-full border border-outline-variant bg-surface text-on-surface";
  return <label className="block text-sm font-medium text-on-surface">{label}{options ? <select className={control} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}><option value="">Selecciona…</option>{options.map((option) => <option key={option}>{option}</option>)}</select> : multiline ? <textarea className={`${control} min-h-24 p-2`} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} /> : <input className={control} type={type} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} />}</label>;
}

function WizardCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-outline-variant bg-surface-container p-4 sm:p-5"><h2 className="text-lg font-semibold text-on-surface">{title}</h2>{description && <p className="mt-1 text-sm text-on-surface-variant">{description}</p>}<div className="mt-4">{children}</div></section>;
}
