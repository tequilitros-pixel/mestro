"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markRecountFulfilledAction } from "../actions";
import { CheckIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";

export default function MarkFulfilledButton({
  recountId,
  eventId,
}: {
  recountId: string;
  eventId: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);

  async function handleClick() {
    setSaving(true);
    await markRecountFulfilledAction(recountId, eventId);
    setSaving(false);
    router.refresh();
    showToast("Reconteo marcado como surtido.");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={saving}
      className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 print:hidden"
    >
      <CheckIcon className="h-4 w-4" />
      {saving ? "Guardando..." : "Marcar como surtido"}
    </button>
  );
}
