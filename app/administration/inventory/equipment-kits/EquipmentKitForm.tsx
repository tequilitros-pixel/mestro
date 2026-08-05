"use client";

import { useState } from "react";
import { createEquipmentKitAction, type ActionResult } from "./actions";

export default function EquipmentKitForm() {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setResult(null);

    const response = await createEquipmentKitAction(formData);

    setResult(response);
    setSaving(false);

    if (response.success) {
      const form = document.getElementById(
        "equipment-kit-form",
      ) as HTMLFormElement | null;
      form?.reset();
    }
  }

  return (
    <form
      id="equipment-kit-form"
      action={handleSubmit}
      className="space-y-6 rounded-2xl border border-outline-variant bg-surface-container p-6"
    >
      <div>
        <h2 className="text-xl font-bold text-on-surface">Nueva modalidad</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Ej. Toldo, Remolque, o una nueva forma de trabajar.
        </p>
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

      <label className="space-y-2 block">
        <span className="text-sm font-semibold text-on-surface-variant">Nombre</span>
        <input
          name="name"
          required
          placeholder="Ej. Toldo"
          className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
        />
      </label>

      <label className="space-y-2 block">
        <span className="text-sm font-semibold text-on-surface-variant">Descripción</span>
        <textarea
          name="description"
          rows={3}
          placeholder="Cuándo se usa esta modalidad"
          className="resize-none w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
        />
      </label>

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
      >
        {saving ? "Guardando..." : "Guardar modalidad"}
      </button>
    </form>
  );
}
