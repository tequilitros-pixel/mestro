"use client";

import { useState } from "react";
import { updateDiscountLimitsAction, type PosSettingsActionResult } from "@/app/actions/posSettings";
import { useToast } from "@/components/ui/Toast";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  GERENTE: "Gerente",
  ENCARGADO: "Encargado",
};

export default function DiscountLimitsForm({
  initialLimits,
}: {
  initialLimits: Record<string, number | null>;
}) {
  const [result, setResult] = useState<PosSettingsActionResult | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setResult(null);

    const response = await updateDiscountLimitsAction(formData);

    setResult(response);
    setSaving(false);

    if (response.success) {
      showToast("Límites guardados correctamente.");
    }
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-6 rounded-2xl border border-outline-variant bg-surface-container p-6"
    >
      <div>
        <h2 className="text-lg font-bold text-on-surface">Límites de descuento por rol</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Si un cajero intenta aplicar un descuento o cortesía por encima de su límite, MAESTRO
          pide que un gerente o administrador lo autorice con su PIN en el mismo dispositivo.
          Deja el campo vacío para no restringir a ese rol.
        </p>
      </div>

      {result && !result.success && (
        <div className="rounded-xl border border-error/40 bg-error/10 p-4 text-sm text-error">
          {result.error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {Object.entries(ROLE_LABELS).map(([role, label]) => (
          <label key={role} className="block space-y-2">
            <span className="text-sm font-semibold text-on-surface-variant">{label}</span>
            <div className="relative">
              <input
                name={`limit_${role}`}
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="Sin límite"
                defaultValue={initialLimits[role] ?? ""}
                className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 pr-8 text-sm text-on-surface outline-none transition focus:border-primary"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-on-surface-variant">
                %
              </span>
            </div>
          </label>
        ))}
      </div>

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
      >
        {saving ? "Guardando..." : "Guardar límites"}
      </button>
    </form>
  );
}
