"use client";

import { useState } from "react";
import { removeEventPackageItemAction } from "../actions";
import { useToast } from "@/components/ui/Toast";

export default function RemoveItemButton({
  itemId,
  packageId,
}: {
  itemId: string;
  packageId: string;
}) {
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  return (
    <button
      onClick={async () => {
        setLoading(true);
        await removeEventPackageItemAction(itemId, packageId);
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
