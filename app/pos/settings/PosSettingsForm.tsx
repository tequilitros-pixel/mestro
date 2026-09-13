"use client";

import { useState } from "react";
import { updatePosSettingsAction, type PosSettingsActionResult } from "@/app/actions/posSettings";
import { useToast } from "@/components/ui/Toast";

export default function PosSettingsForm({
  initialValues,
}: {
  initialValues: { employeeDiscountPercent: number; employeeBottleMonthlyLimit: number };
}) {
  const [result, setResult] = useState<PosSettingsActionResult | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setResult(null);

    const response = await updatePosSettingsAction(formData);

    setResult(response);
    setSaving(false);

    if (response.success) {
      showToast("Configuración guardada correctamente.");
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

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-on-surface-variant">
          Descuento genérico de empleado (%)
        </span>
        <input
          name="employeeDiscountPercent"
          type="number"
          min="0"
          max="100"
          step="0.01"
          required
          defaultValue={initialValues.employeeDiscountPercent}
          className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
        />
        <p className="text-xs text-on-surface-variant">
          Se aplica cuando un producto no tiene precio especial de empleado configurado.
        </p>
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-on-surface-variant">
          Límite mensual de botellas por empleado
        </span>
        <input
          name="employeeBottleMonthlyLimit"
          type="number"
          min="0"
          step="1"
          required
          defaultValue={initialValues.employeeBottleMonthlyLimit}
          className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
        />
        <p className="text-xs text-on-surface-variant">
          Aplica a los productos marcados como &quot;botella&quot; en el catálogo.
        </p>
      </label>

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
      >
        {saving ? "Guardando..." : "Guardar configuración"}
      </button>
    </form>
  );
}
