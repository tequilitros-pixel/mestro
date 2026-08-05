"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createInventoryCountAction, type ActionResult } from "../actions";

type Branch = { id: string; name: string };

export default function NewCountForm({ branches }: { branches: Branch[] }) {
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setResult(null);

    const response = await createInventoryCountAction(formData);

    setResult(response);
    setSaving(false);

    if (response.success && response.id) {
      router.push(`/administration/inventory/branch-counts/${response.id}`);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

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

      <label className="space-y-2 block">
        <span className="text-sm font-semibold text-on-surface-variant">Sucursal</span>
        <select
          name="branchId"
          required
          defaultValue=""
          className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
        >
          <option value="" disabled>
            Selecciona una sucursal
          </option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-2 block">
        <span className="text-sm font-semibold text-on-surface-variant">Fecha del conteo</span>
        <input
          name="countDate"
          type="date"
          required
          defaultValue={today}
          className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
        />
      </label>

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100"
      >
        {saving ? "Creando..." : "Crear conteo"}
      </button>
    </form>
  );
}
