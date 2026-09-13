"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ServiceEventStatus } from "@prisma/client";
import { updateEventStatusAction } from "../actions";
import { useToast } from "@/components/ui/Toast";

const statusLabels: Record<ServiceEventStatus, string> = {
  DRAFT: "Borrador",
  PREPARING: "Preparando",
  READY: "Listo",
  IN_PROGRESS: "En curso",
  RETURN_PENDING: "Pendiente de regreso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

export default function EventStatusSelector({
  eventId,
  currentStatus,
}: {
  eventId: string;
  currentStatus: ServiceEventStatus;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [status, setStatus] = useState(currentStatus);
  const [isPending, startTransition] = useTransition();

  function handleChange(newStatus: ServiceEventStatus) {
    setStatus(newStatus);
    startTransition(async () => {
      await updateEventStatusAction(eventId, newStatus);
      router.refresh();
      showToast(`Estado actualizado a "${statusLabels[newStatus]}".`);
    });
  }

  return (
    <select
      value={status}
      disabled={isPending}
      onChange={(e) => handleChange(e.target.value as ServiceEventStatus)}
      className="rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary disabled:opacity-60"
    >
      {Object.entries(statusLabels).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
