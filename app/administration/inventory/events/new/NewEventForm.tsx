"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createServiceEventAction, type ActionResult } from "../actions";

type EventPackage = { id: string; name: string };
type EquipmentKit = { id: string; name: string };

export default function NewEventForm({
  packages,
  kits,
}: {
  packages: EventPackage[];
  kits: EquipmentKit[];
}) {
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setResult(null);

    const response = await createServiceEventAction(formData);

    setResult(response);
    setSaving(false);

    if (response.success && response.id) {
      router.push(`/administration/inventory/events/${response.id}`);
    }
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-6 rounded-2xl border border-outline-variant bg-surface-container p-6"
    >
      {result && !result.success && (
        <div className="rounded-xl border border-error/40 bg-error/10 p-4 text-sm text-error">
          {result.error}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">Cliente</span>
          <input
            name="clientName"
            required
            placeholder="Ej. Ana y Luis"
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">Teléfono</span>
          <input
            name="clientPhone"
            placeholder="Opcional"
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">Ubicación</span>
          <input
            name="location"
            required
            placeholder="Ej. Salón Los Encinos"
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">Fecha del evento</span>
          <input
            name="eventDate"
            type="datetime-local"
            required
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">Número de invitados</span>
          <input
            name="guestCount"
            type="number"
            min="1"
            required
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">Monto de venta</span>
          <input
            name="saleAmount"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">Paquete</span>
          <select
            name="packageId"
            defaultValue=""
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          >
            <option value="">Sin paquete</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">Modalidad de equipo</span>
          <select
            name="equipmentKitId"
            defaultValue=""
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          >
            <option value="">Sin modalidad</option>
            {kits.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100"
      >
        {saving ? "Creando..." : "Crear evento"}
      </button>
    </form>
  );
}
