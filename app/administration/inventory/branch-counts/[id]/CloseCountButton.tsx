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
      {submitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-on-surface">Inventario enviado correctamente</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              El conteo quedó cerrado y el stock actual de la sucursal fue actualizado.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => router.push("/pospress")}
                className="rounded-xl bg-tertiary-fixed-dim px-4 py-2 font-semibold text-on-surface"
              >
                Volver a punto de ventas
              </button>
              <button
                onClick={() => router.push("/administration/inventory")}
                className="rounded-xl border border-outline-variant px-4 py-2 font-semibold text-on-surface"
              >
                Volver a inventario
              </button>
            </div>
          </div>
        </div>
      )}

      {result && !result.success && (
        <div className="rounded-xl border border-error/40 bg-error/10 p-3 text-sm text-error">
          {result.error}
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
