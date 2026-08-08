"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  toggleNotificationRuleAction,
  deleteNotificationRuleAction,
} from "@/app/actions/notificationRules";

export default function RuleActions({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleToggle() {
    setSaving(true);
    await toggleNotificationRuleAction(id, !active);
    setSaving(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("¿Eliminar esta regla de notificación?")) return;
    setSaving(true);
    await deleteNotificationRuleAction(id);
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={saving}
        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition duration-150 ease-out hover:scale-[1.04] active:scale-[0.97] disabled:opacity-60 ${
          active
            ? "bg-tertiary-fixed-dim/20 text-tertiary-fixed-dim"
            : "bg-surface-container-high text-on-surface-variant"
        }`}
      >
        {active ? "Activa" : "Inactiva"}
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={saving}
        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-error transition duration-150 ease-out hover:scale-[1.04] active:scale-[0.97] disabled:opacity-60"
      >
        Eliminar
      </button>
    </div>
  );
}
