"use client";

import { useState } from "react";
import { removeEquipmentKitItemAction } from "../actions";

export default function RemoveKitItemButton({
  itemId,
  kitId,
}: {
  itemId: string;
  kitId: string;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <button
      onClick={async () => {
        setLoading(true);
        await removeEquipmentKitItemAction(itemId, kitId);
        setLoading(false);
      }}
      disabled={loading}
      className="text-sm text-error hover:text-error disabled:opacity-50"
    >
      {loading ? "Quitando..." : "Quitar"}
    </button>
  );
}
