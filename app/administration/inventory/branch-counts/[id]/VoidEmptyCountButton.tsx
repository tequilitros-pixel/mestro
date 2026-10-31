"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { voidEmptyInventoryCountAction, type ActionResult } from "../actions";
import { useToast } from "@/components/ui/Toast";

export default function VoidEmptyCountButton({
  countId,
  nextHref,
}: {
  countId: string;
  nextHref: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  async function handleVoid() {
    setSaving(true);
    const response = await voidEmptyInventoryCountAction(countId);
    setSaving(false);
    setResult(response);
    if (response.success) {
      showToast(response.message);
      router.replace(nextHref);
      router.refresh();
    }
  }

  return (
    <div className="mt-8 border-t border-outline-variant pt-5">
      {result && !result.success && (
        <p className="mb-3 rounded-xl border border-error/40 bg-error/10 p-3 text-sm text-error">
          {result.error}
        </p>
      )}
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-sm font-semibold text-error underline underline-offset-4 hover:opacity-80"
        >
          Anular este conteo vacío
        </button>
      ) : (
        <div className="rounded-xl border border-error/30 bg-error/10 p-4 text-sm text-on-surface">
          <p className="font-semibold">¿Anular este conteo vacío?</p>
          <p className="mt-1 text-on-surface-variant">
            Se conservará como anulado en el historial. No se borrará ni modificará inventario.
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={handleVoid}
              className="rounded-lg bg-error px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              {saving ? "Anulando..." : "Sí, anular"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setConfirming(false)}
              className="text-xs font-semibold text-on-surface-variant hover:text-on-surface"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
