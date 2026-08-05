"use client";

import { useState } from "react";
import { removeEventPackageItemAction } from "../actions";

export default function RemoveItemButton({
  itemId,
  packageId,
}: {
  itemId: string;
  packageId: string;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <button
      onClick={async () => {
        setLoading(true);
        await removeEventPackageItemAction(itemId, packageId);
        setLoading(false);
      }}
      disabled={loading}
      className="text-sm text-error hover:text-error disabled:opacity-50"
    >
      {loading ? "Quitando..." : "Quitar"}
    </button>
  );
}
