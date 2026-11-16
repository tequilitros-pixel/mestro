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

  function hasUnsavedChanges() {
    const dirtyRow = document.querySelector<HTMLElement>('[data-count-dirty="true"]');
    if (!dirtyRow) return false;
    setResult({
      success: false,
      error: "Guarda las cantidades modificadas antes de cerrar el conteo.",
    });
    dirtyRow.querySelector<HTMLInputElement>("input")?.focus();
    return true;
  }

  async function handleClose() {
    if (hasUnsavedChanges()) return;
    if (saving || submitted) return;
    setSaving(true);
    try {
      const response = await closeInventoryCountAction(countId, operationId);
      setResult(response);
      if (response.success) {
        setSubmitted(true);
        showToast("Conteo finalizado correctamente.");
        router.refresh();
      }
    } catch {
      setResult({ success: false, error: "No fue posible confirmar el cierre. Revisa tu conexión e inténtalo de nuevo." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {submitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-on-surface">Conteo finalizado correctamente</h2>
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
          onClick={() => {
            if (hasUnsavedChanges()) return;
            setResult(null);
            setConfirming(true);
          }}
          className="rounded-xl bg-tertiary-fixed-dim px-5 py-3 font-semibold text-on-surface transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
        >
          Finalizar conteo
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <span className="text-sm text-on-surface-variant">
            ¿Confirmas finalizar? Se actualizará el stock de la sucursal y ya no podrás editar cantidades.
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
            disabled={saving}
            className="text-sm text-on-surface-variant hover:text-on-surface-variant"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
