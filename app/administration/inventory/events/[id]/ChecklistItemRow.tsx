"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateSentQuantityAction,
  updateReturnedQuantityAction,
  removeEventItemAction,
} from "../actions";
import { CheckIcon } from "@/components/ui/icons";

type Item = {
  id: string;
  productName: string;
  unit: string;
  plannedQuantity: number;
  sentQuantity: number | null;
  returnedQuantity: number | null;
  damagedQuantity: number;
  checkedOut: boolean;
  checkedIn: boolean;
  isCustom: boolean;
};

export default function ChecklistItemRow({
  item,
  eventId,
  phase,
}: {
  item: Item;
  eventId: string;
  phase: "salida" | "regreso";
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [sentValue, setSentValue] = useState(item.sentQuantity ?? item.plannedQuantity);
  const [returnedValue, setReturnedValue] = useState(
    item.returnedQuantity ?? item.sentQuantity ?? item.plannedQuantity,
  );
  const [damagedValue, setDamagedValue] = useState(item.damagedQuantity ?? 0);

  const isDone = phase === "salida" ? item.checkedOut : item.checkedIn;
  const canCheck = phase === "salida" || item.checkedOut;

  async function handleCheck() {
    setSaving(true);

    if (phase === "salida") {
      await updateSentQuantityAction(item.id, eventId, sentValue);
    } else {
      await updateReturnedQuantityAction(item.id, eventId, returnedValue, damagedValue);
    }

    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  async function handleRemove() {
    setSaving(true);
    await removeEventItemAction(item.id, eventId);
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="border-b border-outline-variant p-4">
      <div className="flex items-center gap-3">
        <button
          onClick={handleCheck}
          disabled={saving || !canCheck || (isDone && !editing)}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition ${
            isDone
              ? "border-tertiary-fixed-dim bg-tertiary-fixed-dim/20 text-tertiary-fixed-dim"
              : canCheck
              ? "border-outline-variant hover:border-primary/40 hover:bg-on-surface-variant/10"
              : "border-outline-variant opacity-40"
          }`}
        >
          {isDone && <CheckIcon className="h-4 w-4" />}
        </button>

        <div className="flex-1">
          <p className={`font-medium ${isDone ? "text-on-surface-variant" : "text-on-surface"}`}>
            {item.productName}{" "}
            {item.isCustom && (
              <span className="ml-1 rounded-full bg-on-surface-variant/10 px-2 py-0.5 text-xs text-on-surface-variant">
                Extra
              </span>
            )}
          </p>
          <p className="text-xs text-on-surface-variant">
            Plan: {item.plannedQuantity} {item.unit}
            {phase === "salida" && item.checkedOut && (
              <> · Subido: {item.sentQuantity} {item.unit}</>
            )}
            {phase === "regreso" && !item.checkedOut && " · Aún no se ha subido"}
            {phase === "regreso" && item.checkedIn && (
              <>
                {" "}· Regresó: {item.returnedQuantity} {item.unit}
                {item.damagedQuantity > 0 && ` · Dañado: ${item.damagedQuantity}`}
              </>
            )}
          </p>
        </div>

        {canCheck && (
          <button
            onClick={() => setEditing((e) => !e)}
            className="text-xs text-on-surface-variant hover:text-primary"
          >
            {editing ? "Cerrar" : "Cantidad"}
          </button>
        )}

        {phase === "salida" && (
          <button
            onClick={handleRemove}
            disabled={saving}
            className="text-xs text-error hover:text-error"
          >
            Quitar
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-3 flex flex-wrap items-center gap-3 pl-10">
          {phase === "salida" ? (
            <label className="space-y-1">
              <span className="block text-sm font-semibold text-on-surface-variant">Cantidad subida</span>
              <input
                type="number"
                min="0"
                step="0.001"
                value={sentValue}
                onChange={(e) => setSentValue(Number(e.target.value))}
                className="w-28 rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
              />
            </label>
          ) : (
            <>
              <label className="space-y-1">
                <span className="block text-sm font-semibold text-on-surface-variant">Regresado</span>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={returnedValue}
                  onChange={(e) => setReturnedValue(Number(e.target.value))}
                  className="w-24 rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                />
              </label>
              <label className="space-y-1">
                <span className="block text-sm font-semibold text-on-surface-variant">Dañado</span>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={damagedValue}
                  onChange={(e) => setDamagedValue(Number(e.target.value))}
                  className="w-24 rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                />
              </label>
            </>
          )}

          <button
            onClick={handleCheck}
            disabled={saving}
            className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      )}
    </div>
  );
}
