"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCountItemQuantityAction } from "../actions";
import { CheckIcon } from "@/components/ui/icons";

type Item = {
  id: string;
  productName: string;
  unit: string;
  previousQuantity: number;
  quantityCounted: number;
  entriesQuantity: number | null;
  quantityConsumed: number | null;
  costTotal: number | null;
};

export default function CountItemRow({
  item,
  countId,
  editable,
}: {
  item: Item;
  countId: string;
  editable: boolean;
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(item.quantityCounted);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await updateCountItemQuantityAction(item.id, countId, quantity);
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="grid gap-3 border-b border-outline-variant p-4 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr] md:items-center">
      <p className="font-medium text-on-surface">{item.productName}</p>

      <div>
        <span className="block text-xs text-on-surface-variant">Anterior</span>
        <p className="text-sm text-on-surface-variant">
          {item.previousQuantity} {item.unit}
        </p>
      </div>

      {editable ? (
        <div className="flex gap-1">
          <input
            type="number"
            min="0"
            step="0.001"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center rounded-lg bg-surface-container-high px-2 text-on-surface-variant hover:bg-surface-container-highest"
          >
            <CheckIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div>
          <span className="block text-xs text-on-surface-variant">Contado</span>
          <p className="text-sm text-on-surface-variant">
            {item.quantityCounted} {item.unit}
          </p>
        </div>
      )}

      <div>
        <span className="block text-xs text-on-surface-variant">Entradas</span>
        <p className="text-sm text-on-surface-variant">
          {item.entriesQuantity !== null ? item.entriesQuantity : "—"}
        </p>
      </div>

      <div>
        <span className="block text-xs text-on-surface-variant">Consumido</span>
        <p className="text-sm font-semibold text-on-surface">
          {item.quantityConsumed !== null ? item.quantityConsumed : "—"}
        </p>
      </div>

      <div>
        <span className="block text-xs text-on-surface-variant">Costo</span>
        <p className="text-sm text-tertiary-fixed-dim">
          {item.costTotal !== null ? `$${item.costTotal.toFixed(2)}` : "—"}
        </p>
      </div>
    </div>
  );
}

