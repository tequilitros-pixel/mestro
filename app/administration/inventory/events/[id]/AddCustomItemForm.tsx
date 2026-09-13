"use client";

import { useState } from "react";
import { addCustomEventItemAction, type ActionResult } from "../actions";
import { useToast } from "@/components/ui/Toast";

type Product = { id: string; name: string; unit: string };

export default function AddCustomItemForm({
  eventId,
  products,
  title,
}: {
  eventId: string;
  products: Product[];
  title: string;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setResult(null);

    const response = await addCustomEventItemAction(formData);

    setResult(response);
    setSaving(false);

    if (response.success) {
      const form = document.getElementById(
        `add-custom-item-${title}`,
      ) as HTMLFormElement | null;
      form?.reset();
      showToast(`${title} agregado correctamente.`);
    }
  }

  return (
    <form
      id={`add-custom-item-${title}`}
      action={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-2xl border border-dashed border-outline-variant bg-surface-container/50 p-4"
    >
      <input type="hidden" name="eventId" value={eventId} />

      {result && !result.success && (
        <div className="w-full rounded-lg border border-error/40 bg-error/10 p-2 text-xs text-error">
          {result.error}
        </div>
      )}

      <label className="space-y-1">
        <span className="block text-sm font-semibold text-on-surface-variant">Producto</span>
        <select
          name="productId"
          required
          defaultValue=""
          className="rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
        >
          <option value="" disabled>
            Selecciona
          </option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.unit})
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1">
        <span className="block text-sm font-semibold text-on-surface-variant">Cantidad</span>
        <input
          name="plannedQuantity"
          type="number"
          min="0"
          step="0.001"
          required
          className="w-28 rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
        />
      </label>

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100"
      >
        {saving ? "Agregando..." : `+ ${title}`}
      </button>
    </form>
  );
}
