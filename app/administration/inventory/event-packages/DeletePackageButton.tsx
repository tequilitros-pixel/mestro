"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteEventPackageAction } from "./actions";
import { useToast } from "@/components/ui/Toast";

export default function DeletePackageButton({ packageId }: { packageId: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDeleting(true);
    setError(null);

    const response = await deleteEventPackageAction(packageId);

    if (response.success) {
      router.refresh();
      showToast("Paquete eliminado correctamente.");
    } else {
      setError(response.error);
      setDeleting(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div
        onClick={(e) => e.preventDefault()}
        className="flex items-center gap-2 text-xs"
      >
        <span className="text-error">¿Eliminar?</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-lg bg-error px-2.5 py-1 font-semibold text-on-surface transition hover:opacity-90 disabled:opacity-60"
        >
          {deleting ? "..." : "Sí"}
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setConfirming(false);
          }}
          className="text-on-surface-variant hover:text-on-surface"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setConfirming(true);
        }}
        className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-semibold text-error transition hover:border-error/40 hover:bg-error/10"
      >
        Eliminar
      </button>
      {error && <span className="text-xs text-error">{error}</span>}
    </div>
  );
}
