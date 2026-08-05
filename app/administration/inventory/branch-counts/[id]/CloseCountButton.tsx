"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { closeInventoryCountAction, type ActionResult } from "../actions";

export default function CloseCountButton({ countId }: { countId: string }) {
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleClose() {
    setSaving(true);
    const response = await closeInventoryCountAction(countId);
    setResult(response);
    setSaving(false);

    if (response.success) {
      router.refresh();
    }
  }

  return (
    <div className="space-y-3">
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
