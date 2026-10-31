"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { archiveServiceEventAction, unarchiveServiceEventAction } from "../actions";
import EditEventModal from "./EditEventModal";
import DeleteEventModal from "./DeleteEventModal";
import EventStatusSelector from "./EventStatusSelector";
import { PencilIcon, TrashIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";
import type { ServiceEventStatus } from "@prisma/client";

type EventPackage = { id: string; name: string };
type EquipmentKit = { id: string; name: string };

type EventProps = {
  id: string;
  code: string;
  clientName: string;
  clientPhone: string | null;
  location: string;
  eventDate: Date | string;
  guestCount: number;
  saleAmount: number | null;
  packageId: string | null;
  equipmentKitId: string | null;
  notes: string | null;
  status: ServiceEventStatus;
  checkoutConfirmedAt: Date | string | null;
  returnConfirmedAt: Date | string | null;
};

export default function EventActionsBar({
  event,
  packages,
  kits,
  isAdmin,
}: {
  event: EventProps;
  packages: EventPackage[];
  kits: EquipmentKit[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [loadingArchive, setLoadingArchive] = useState(false);

  const isCancelled = event.status === "CANCELLED";
  const isCompleted = event.status === "COMPLETED";

  async function handleToggleArchive() {
    setLoadingArchive(true);
    try {
      const result = isCancelled
        ? await unarchiveServiceEventAction(event.id)
        : await archiveServiceEventAction(event.id);
      if (result.success) {
        showToast(result.message);
        router.refresh();
      } else {
        showToast(result.error);
      }
    } catch {
      showToast("Error al cambiar estado de archivado.");
    } finally {
      setLoadingArchive(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {/* Selector de estado */}
        <EventStatusSelector eventId={event.id} currentStatus={event.status} />

        {/* Botón Editar */}
        {!isCompleted && (
          <button
            type="button"
            onClick={() => setShowEditModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-high px-3.5 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container-highest transition active:scale-95"
            title="Editar nombre, invitados, paquete o modalidad"
          >
            <PencilIcon className="h-3.5 w-3.5" />
            <span>Editar</span>
          </button>
        )}

        {/* Botón Archivar / Restaurar */}
        <button
          type="button"
          disabled={loadingArchive}
          onClick={handleToggleArchive}
          className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-high px-3.5 py-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition disabled:opacity-50"
        >
          {isCancelled ? "Reactivar evento" : "Archivar"}
        </button>

        {/* Botón Eliminar (solo administradores y eventos no cerrados) */}
        {isAdmin && !event.returnConfirmedAt && (
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center gap-1 rounded-xl border border-error/30 bg-error/10 px-3 py-2 text-xs font-semibold text-error hover:bg-error/20 transition active:scale-95"
            title="Eliminar evento creado por error"
          >
            <TrashIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Eliminar</span>
          </button>
        )}
      </div>

      {showEditModal && (
        <EditEventModal
          event={event}
          packages={packages}
          kits={kits}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {showDeleteModal && (
        <DeleteEventModal
          eventId={event.id}
          eventName={`${event.clientName} (${event.code})`}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
    </>
  );
}
