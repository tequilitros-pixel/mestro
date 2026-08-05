"use client";

import { useState } from "react";
import { updateEventPackageAction, togglePackageActiveAction, type ActionResult } from "../actions";

type Package = {
  id: string;
  name: string;
  description: string | null;
  pricePerPerson: number | null;
  includedHours: number | null;
  minimumGuests: number | null;
  isActive: boolean;
};

export default function EditPackageForm({ pkg }: { pkg: Package }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState(pkg.isActive);
  const [togglingActive, setTogglingActive] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setResult(null);

    const response = await updateEventPackageAction(pkg.id, formData);

    setResult(response);
    setSaving(false);
  }

  async function handleToggleActive() {
    setTogglingActive(true);
    const newValue = !active;
    await togglePackageActiveAction(pkg.id, newValue);
    setActive(newValue);
    setTogglingActive(false);
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-6 rounded-2xl border border-outline-variant bg-surface-container p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-on-surface">Editar paquete</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Ajusta el nombre, precio y datos generales.
          </p>
        </div>

        <button
          type="button"
          onClick={handleToggleActive}
          disabled={togglingActive}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition duration-150 ease-out hover:scale-[1.04] active:scale-[0.97] ${
            active
              ? "bg-tertiary-fixed-dim/20 text-tertiary-fixed-dim hover:bg-error/20 hover:text-error"
              : "bg-surface-container-high text-on-surface-variant hover:bg-tertiary-fixed-dim/20 hover:text-tertiary-fixed-dim"
          }`}
        >
          {togglingActive ? "..." : active ? "Activo" : "Inactivo"}
        </button>
      </div>

      {result && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            result.success
              ? "border-tertiary-fixed-dim/40 bg-tertiary-fixed-dim/10 text-tertiary-fixed-dim"
              : "border-error/40 bg-error/10 text-error"
          }`}
        >
          {result.success ? result.message : result.error}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">Nombre</span>
          <input
            name="name"
            required
            defaultValue={pkg.name}
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">Precio por persona</span>
          <input
            name="pricePerPerson"
            type="number"
            min="0"
            step="0.01"
            defaultValue={pkg.pricePerPerson ?? ""}
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">Horas incluidas</span>
          <input
            name="includedHours"
            type="number"
            min="0"
            defaultValue={pkg.includedHours ?? ""}
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">Mínimo de invitados</span>
          <input
            name="minimumGuests"
            type="number"
            min="0"
            defaultValue={pkg.minimumGuests ?? ""}
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          />
        </label>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-on-surface-variant">Descripción</span>
        <textarea
          name="description"
          rows={3}
          defaultValue={pkg.description ?? ""}
          className="resize-none w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
        />
      </label>

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100"
      >
        {saving ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
