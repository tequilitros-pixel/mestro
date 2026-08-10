"use client";

import { useState } from "react";
import { removeEquipmentKitItemAction } from "../actions";
import { useToast } from "@/components/ui/Toast";

export default function RemoveKitItemButton({
  itemId,
  kitId,
}: {
  itemId: string;
  kitId: string;
}) {
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  return (
    <button
      onClick={async () => {
        setLoading(true);
        await removeEquipmentKitItemAction(itemId, kitId);
        setLoading(false);
        showToast("Elemento quitado correctamente.");
      }}
      disabled={loading}
      className="text-sm text-error hover:text-error disabled:opacity-50"
    >
      {loading ? "Quitando..." : "Quitar"}
    </button>
  );
}
