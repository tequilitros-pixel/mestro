"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteServiceEventAction, archiveServiceEventAction } from "../actions";
import { XIcon, AlertIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";

export default function DeleteEventModal({
  eventId,
  eventName,
  onClose,
}: {
  eventId: string;
  eventName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const result = await deleteServiceEventAction(eventId);
      if (result.success) {
        showToast(result.message);
        router.push("/administration/inventory/events");
      } else {
        showToast(result.error);
      }
    } catch {
      showToast("Error inesperado al eliminar el evento.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      const result = await archiveServiceEventAction(eventId);
      if (result.success) {
        showToast(result.message);
        router.push("/administration/inventory/events");
      } else {
        showToast(result.error);
      }
    } catch {
      showToast("Error inesperado al archivar el evento.");
    } finally {
      setArchiving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl border border-error/30 bg-surface-container p-6 shadow-2xl space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-error/15 text-error">
              <AlertIcon className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-on-surface">¿Eliminar evento?</h2>
              <p className="text-xs text-on-surface-variant font-medium">{eventName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-on-surface-variant hover:text-on-surface"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-on-surface-variant">
          Esta acción eliminará de forma permanente el evento y su checklist de insumos. Solo se recomienda si el evento se creó por error o duplicado y aún no tiene cortes de caja asociados.
        </p>

        <div className="rounded-xl border border-outline-variant bg-background/60 p-3 text-xs text-on-surface-variant">
          <strong className="text-on-surface">Alternativa recomendada:</strong> Si deseas conservar el registro histórico de lo planificado, puedes <strong>archivar/cancelar</strong> el evento en lugar de borrarlo.
        </div>

        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={deleting || archiving}
            onClick={onClose}
            className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container-high transition"
          >
            Atrás
          </button>
          <button
            type="button"
            disabled={deleting || archiving}
            onClick={handleArchive}
            className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/20 transition"
          >
            {archiving ? "Archivando..." : "Archivar / Cancelar"}
          </button>
          <button
            type="button"
            disabled={deleting || archiving}
            onClick={handleDelete}
            className="rounded-xl bg-error px-4 py-2 text-sm font-bold text-white hover:bg-error/90 active:scale-95 disabled:opacity-50 transition"
          >
            {deleting ? "Eliminando..." : "Eliminar definitivamente"}
          </button>
        </div>
      </div>
    </div>
  );
}
