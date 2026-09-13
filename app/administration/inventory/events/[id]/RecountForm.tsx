"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRecountAction } from "../actions";

type Item = { id: string; productName: string; unit: string };

export default function RecountForm({
  eventId,
  items,
  nextDayNumber,
}: {
  eventId: string;
  items: Item[];
  nextDayNumber: number;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setError(null);

    const result = await createRecountAction(formData);

    if (!result.success) {
      setSaving(false);
      setError(result.error);
      return;
    }

    router.push(`/administration/inventory/events/${eventId}/recount/${result.recountId}`);
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-outline-variant bg-surface-container p-6">
        <p className="text-sm text-on-surface-variant">
          Aún no hay insumos subidos a este evento (usa &ldquo;Lista para llevar&rdquo; primero)
          para poder recontarlos.
        </p>
      </div>
    );
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-5 rounded-2xl border border-outline-variant bg-surface-container p-6"
    >
      <input type="hidden" name="eventId" value={eventId} />

      <div>
        <h3 className="text-lg font-bold text-on-surface">Reconteo — día {nextDayNumber}</h3>
        <p className="mt-1 text-sm text-on-surface-variant">
          Captura cuánto queda hoy de cada insumo. Lo que falte para llegar a lo que se subió
          originalmente se convierte en la lista de resurtido.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-error/40 bg-error/10 p-4 text-sm text-error">
          {error}
        </div>
      )}

      <div className="divide-y divide-outline-variant">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-4 py-3">
            <span className="text-sm font-medium text-on-surface">{item.productName}</span>
            <label className="flex items-center gap-2">
              <input
                name={`qty_${item.id}`}
                type="number"
                min="0"
                step="0.001"
                placeholder="0"
                className="w-24 rounded-xl border border-outline-variant bg-background px-3 py-2 text-right text-sm text-on-surface outline-none transition focus:border-primary"
              />
              <span className="w-16 text-xs text-on-surface-variant">{item.unit}</span>
            </label>
          </div>
        ))}
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-on-surface-variant">Notas (opcional)</span>
        <textarea
          name="notes"
          rows={2}
          className="w-full resize-none rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
        />
      </label>

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
      >
        {saving ? "Guardando..." : "Guardar reconteo y ver lista de faltantes"}
      </button>
    </form>
  );
}
