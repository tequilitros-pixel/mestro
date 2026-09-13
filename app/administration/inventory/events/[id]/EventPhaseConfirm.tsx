"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmEventCheckoutAction, confirmEventReturnAction } from "../actions";

export default function EventPhaseConfirm({
  eventId,
  phase,
  disabled,
}: {
  eventId: string;
  phase: "salida" | "regreso";
  disabled: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setSaving(true);
    setError("");
    const result =
      phase === "salida"
        ? await confirmEventCheckoutAction(eventId)
        : await confirmEventReturnAction(eventId);
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container/95 p-3 backdrop-blur">
      <p className="min-w-0 flex-1 text-xs text-error" role="alert">{error}</p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => router.refresh()} disabled={saving} className="compact-action border border-outline-variant bg-transparent text-on-surface hover:bg-surface-container-high disabled:opacity-50">
          Guardar avance
        </button>
        <button type="button" onClick={confirm} disabled={saving || disabled} className="compact-action bg-primary font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? "Confirmando…" : phase === "salida" ? "Confirmar salida" : "Confirmar regreso"}
        </button>
      </div>
    </div>
  );
}
