"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { closeInventoryCountAction, type ActionResult } from "../actions";
import { useToast } from "@/components/ui/Toast";

export default function CloseCountButton({ countId, operationId }: { countId: string; operationId: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleClose() {
    setSaving(true);
    const response = await closeInventoryCountAction(countId, operationId);
    setResult(response);
    setSaving(false);

    if (response.success) {
      setSubmitted(true);
      showToast("Inventario enviado correctamente.");
    }
  }

  return (
    <div className="space-y-3">
      {result && !result.success && (
        <div className="rounded-xl border border-error/40 bg-error/10 p-3 text-sm text-error">
          {result.error}
        </div>
      )}

      {submitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-dim/70 p-4" role="presentation">
          <div className="w-full max-w-md rounded-2xl border border-outline-variant bg-surface-container-high p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="inventory-submitted-title" aria-describedby="inventory-submitted-description">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-tertiary-fixed-dim/20 text-tertiary-fixed-dim"><span className="text-3xl" aria-hidden="true">✓</span></div>
            <h2 id="inventory-submitted-title" className="mt-5 text-center text-xl font-bold text-on-surface">Inventario enviado correctamente</h2>
            <p id="inventory-submitted-description" className="mt-2 text-center text-sm text-on-surface-variant">El conteo quedó registrado y ya no se puede editar.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => router.push("/pospress")} className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary">Volver a punto de ventas</button>
              <button type="button" onClick={() => router.push("/administration/inventory")} className="rounded-xl border border-outline-variant px-4 py-3 text-sm font-semibold text-on-surface">Volver a inventario</button>
            </div>
          </div>
        </div>
      )}

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="rounded-xl bg-tertiary-fixed-dim px-5 py-3 font-semibold text-on-surface transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
        >
          Cerrar conteo y calcular consumo
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <span className="text-sm text-on-surface-variant">
            ¿Confirmas cerrar? Ya no podrás editar cantidades.
          </span>
          <button
            onClick={handleClose}
            disabled={saving}
            className="rounded-xl bg-tertiary-fixed-dim px-4 py-2 text-sm font-semibold text-on-surface transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100"
          >
            {saving ? "Cerrando..." : "Sí, cerrar"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="text-sm text-on-surface-variant hover:text-on-surface-variant"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
