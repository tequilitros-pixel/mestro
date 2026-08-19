"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateReturnedQuantityAction, updateSentQuantityAction } from "../actions";
import { CheckIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";

export type EventChecklistItem = {
  id: string;
  productName: string;
  unit: string;
  plannedQuantity: number;
  sentQuantity: number | null;
  returnedQuantity: number | null;
  damagedQuantity: number;
  returnedOpenQuantity: number | null;
  checkedOut: boolean;
  checkedIn: boolean;
  isCustom: boolean;
  handlingUnit: string | null;
  contentPerUnit: number | null;
  contentUnit: string | null;
  itemType: string;
};

const CONTENT_LABEL: Record<string, string> = {
  ML: "ml",
  L: "L",
  G: "g",
  KG: "kg",
  PIECES: "piezas",
};

const HANDLING_LABEL: Record<string, string> = {
  BOTELLA: "botella",
  GARRAFA: "garrafa",
  CAJA: "caja",
  PAQUETE: "paquete",
  PIEZA: "pieza",
  COSTAL: "costal",
  KILOGRAMO: "kilogramo",
  LITRO: "litro",
  OTRA: "unidad",
};

function quantityLabel(quantity: number, unit: string) {
  const normalized = unit.toLocaleLowerCase("es-MX");
  if (quantity === 1) return `${quantity} ${normalized.endsWith("s") ? normalized.slice(0, -1) : normalized}`;
  if (normalized.endsWith("s")) return `${quantity} ${normalized}`;
  if (normalized.endsWith("z")) return `${quantity} ${normalized.slice(0, -1)}ces`;
  if (normalized.endsWith("l") || normalized.endsWith("n") || normalized.endsWith("r")) return `${quantity} ${normalized}es`;
  return `${quantity} ${normalized}s`;
}

function baseContent(content: number, unit: string | null) {
  return unit === "L" || unit === "KG" ? content * 1000 : content;
}

function baseUnit(unit: string | null) {
  if (unit === "L" || unit === "ML") return "ml";
  if (unit === "KG" || unit === "G") return "g";
  return "piezas";
}

export default function ChecklistItemRow({
  item,
  eventId,
  phase,
  locked = false,
}: {
  item: EventChecklistItem;
  eventId: string;
  phase: "salida" | "regreso";
  locked?: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [sentValue, setSentValue] = useState(item.sentQuantity ?? item.plannedQuantity);
  const [returnedValue, setReturnedValue] = useState(item.returnedQuantity ?? 0);
  const [openValue, setOpenValue] = useState(item.returnedOpenQuantity ?? 0);
  const [damagedValue, setDamagedValue] = useState(item.damagedQuantity ?? 0);

  const isReturn = phase === "regreso";
  const reviewed = isReturn ? item.checkedIn : item.checkedOut;
  const canReview = !isReturn || item.checkedOut;
  const handlingUnit = HANDLING_LABEL[item.handlingUnit ?? ""] ?? item.unit.toLocaleLowerCase("es-MX");
  const quantity = isReturn ? returnedValue : sentValue;
  const presentation =
    item.contentPerUnit !== null
      ? `${handlingUnit[0].toLocaleUpperCase("es-MX")}${handlingUnit.slice(1)} de ${item.contentPerUnit} ${CONTENT_LABEL[item.contentUnit ?? ""] ?? ""}`
      : "Presentación sin configurar";
  const sent = item.sentQuantity ?? item.plannedQuantity;
  const difference = isReturn ? sent - returnedValue - damagedValue : sentValue - item.plannedQuantity;
  const hasOpenRemainder = item.contentPerUnit !== null && item.itemType !== "EQUIPMENT";
  const consumedBase = hasOpenRemainder
    ? Math.max(
        (sent - returnedValue) * baseContent(item.contentPerUnit ?? 0, item.contentUnit) - openValue,
        0,
      )
    : Math.max(sent - returnedValue - damagedValue, 0);
  const presentationBase = hasOpenRemainder
    ? baseContent(item.contentPerUnit ?? 0, item.contentUnit)
    : 0;
  const consumedClosedUnits = presentationBase > 0 ? Math.floor(consumedBase / presentationBase) : 0;
  const consumedRemainder = presentationBase > 0 ? consumedBase - consumedClosedUnits * presentationBase : 0;
  const friendlyConsumption = hasOpenRemainder
    ? consumedRemainder > 0
      ? `${quantityLabel(consumedClosedUnits, handlingUnit)} + ${consumedRemainder.toLocaleString("es-MX")} ${baseUnit(item.contentUnit)}`
      : quantityLabel(consumedClosedUnits, handlingUnit)
    : null;

  async function save(next?: { sent?: number; returned?: number; open?: number; damaged?: number }) {
    const nextSent = next?.sent ?? sentValue;
    const nextReturned = next?.returned ?? returnedValue;
    const nextOpen = next?.open ?? openValue;
    const nextDamaged = next?.damaged ?? damagedValue;
    setSaving(true);
    const result = isReturn
      ? await updateReturnedQuantityAction(item.id, eventId, nextReturned, nextDamaged, nextOpen)
      : await updateSentQuantityAction(item.id, eventId, nextSent);
    setSaving(false);
    if (!result.success) {
      showToast(result.error);
      return;
    }
    router.refresh();
  }

  function changeQuantity(delta: number) {
    const next = Math.max(0, quantity + delta);
    if (isReturn) {
      setReturnedValue(next);
      void save({ returned: next });
    } else {
      setSentValue(next);
      void save({ sent: next });
    }
  }

  const status = locked
    ? "Confirmado"
    : reviewed
      ? Math.abs(difference) < 0.001
        ? "Revisado"
        : "Con diferencia"
      : "Pendiente";
  const statusClass =
    status === "Confirmado" || status === "Revisado"
      ? "bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim"
      : status === "Con diferencia"
        ? "bg-secondary/20 text-secondary"
        : "bg-surface-container-high text-on-surface-variant";

  return (
    <article className="grid min-h-14 gap-3 border-b border-outline-variant px-3 py-3 last:border-b-0 transition-colors hover:bg-on-surface/[0.035] md:grid-cols-[2.5rem_minmax(13rem,1.8fr)_minmax(9rem,1fr)_7rem_12rem_8rem_7rem_6.5rem_2rem] md:items-center md:gap-2 md:py-2">
      <div className="order-1 flex items-center md:order-none">
        <button
          type="button"
          aria-label={`Marcar ${item.productName} como revisado`}
          onClick={() => void save()}
          disabled={saving || !canReview || locked}
          className={`flex h-8 w-8 items-center justify-center rounded-md border transition ${
            reviewed
              ? "border-tertiary-fixed-dim bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim"
              : "border-outline-variant text-on-surface-variant hover:border-on-surface-variant"
          } disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {reviewed && <CheckIcon className="h-4 w-4" />}
        </button>
      </div>

      <div className="order-2 min-w-0 md:order-none">
        <p className="truncate text-sm font-medium text-on-surface">{item.productName}</p>
        {item.isCustom && <span className="text-xs text-on-surface-variant">Producto adicional</span>}
      </div>

      <p className="order-3 text-xs text-on-surface-variant md:order-none md:text-sm">{presentation}</p>
      <p className="order-4 text-sm text-on-surface-variant md:order-none">{isReturn ? quantityLabel(sent, handlingUnit) : quantityLabel(item.plannedQuantity, handlingUnit)}</p>

      <div className="order-5 flex items-center gap-1.5 md:order-none">
        <button type="button" onClick={() => changeQuantity(-1)} disabled={saving || locked || !canReview} className="h-8 w-8 rounded-md border border-outline-variant text-lg leading-none hover:bg-surface-container-high disabled:opacity-40">−</button>
        <input
          aria-label={isReturn ? "Unidades cerradas que regresan" : "Cantidad realmente cargada"}
          type="number"
          min="0"
          step="0.001"
          value={quantity}
          disabled={saving || locked || !canReview}
          onChange={(event) => isReturn ? setReturnedValue(Number(event.target.value)) : setSentValue(Number(event.target.value))}
          onBlur={() => void save()}
          className="h-8 w-16 rounded-md border border-outline-variant bg-background px-1 text-center text-sm font-semibold text-on-surface outline-none focus:border-on-surface"
        />
        <button type="button" onClick={() => changeQuantity(1)} disabled={saving || locked || !canReview} className="h-8 w-8 rounded-md border border-outline-variant text-lg leading-none hover:bg-surface-container-high disabled:opacity-40">+</button>
        <span className="text-xs text-on-surface-variant">{handlingUnit}</span>
      </div>

      <div className="order-6 text-xs text-on-surface-variant md:order-none">
        {isReturn && hasOpenRemainder ? (
          <label className="flex items-center gap-1">
            <span className="sr-only">Remanente abierto</span>
            <input type="number" min="0" step="0.001" value={openValue} disabled={saving || locked || !canReview} onChange={(event) => setOpenValue(Number(event.target.value))} onBlur={() => void save()} className="h-8 w-16 rounded-md border border-outline-variant bg-background px-1 text-center text-sm text-on-surface outline-none focus:border-on-surface" />
            <span>{baseUnit(item.contentUnit)}</span>
          </label>
        ) : isReturn ? (
          <span>—</span>
        ) : (
          <span>{difference === 0 ? "Sin diferencia" : `${difference > 0 ? "+" : ""}${difference.toFixed(2)} ${handlingUnit}`}</span>
        )}
      </div>

      <div className="order-7 text-xs text-on-surface-variant md:order-none">
        {isReturn ? (
          <span title={hasOpenRemainder ? `${consumedBase.toLocaleString("es-MX")} ${baseUnit(item.contentUnit)}` : undefined}>{friendlyConsumption ?? quantityLabel(consumedBase, handlingUnit)}</span>
        ) : (
          <span>—</span>
        )}
      </div>

      <span className={`order-8 inline-flex w-fit items-center rounded-full px-2 py-1 text-xs font-medium md:order-none ${statusClass}`}>{status}</span>
      <button type="button" onClick={() => void save()} disabled={saving || locked || !canReview} className="order-9 h-8 rounded-md px-2 text-xs text-on-surface-variant hover:bg-surface-container-high disabled:opacity-40 md:order-none" aria-label={`Guardar ${item.productName}`}>{saving ? "…" : "⋯"}</button>

      {isReturn && item.itemType !== "EQUIPMENT" && (
        <label className="order-10 col-span-full flex items-center gap-2 text-xs text-on-surface-variant md:hidden">
          Dañado
          <input type="number" min="0" step="0.001" value={damagedValue} disabled={saving || locked || !canReview} onChange={(event) => setDamagedValue(Number(event.target.value))} onBlur={() => void save()} className="h-8 w-16 rounded-md border border-outline-variant bg-background px-1 text-center text-sm text-on-surface" />
        </label>
      )}
    </article>
  );
}
