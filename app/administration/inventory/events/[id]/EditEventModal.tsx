"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateServiceEventAction } from "../actions";
import { XIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";

type EventPackage = { id: string; name: string };
type EquipmentKit = { id: string; name: string };

type EventData = {
  id: string;
  clientName: string;
  clientPhone: string | null;
  location: string;
  eventDate: Date | string;
  guestCount: number;
  saleAmount: number | null;
  packageId: string | null;
  equipmentKitId: string | null;
  notes: string | null;
  checkoutConfirmedAt: Date | string | null;
};

function toLocalDatetimeString(dateInput: Date | string) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditEventModal({
  event,
  packages,
  kits,
  onClose,
}: {
  event: EventData;
  packages: EventPackage[];
  kits: EquipmentKit[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [recalculateChecklist, setRecalculateChecklist] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState(event.packageId ?? "");
  const [selectedKitId, setSelectedKitId] = useState(event.equipmentKitId ?? "");
  const [guestCount, setGuestCount] = useState(event.guestCount);

  const canRecalculate = !event.checkoutConfirmedAt;
  const packageOrGuestsChanged =
    selectedPackageId !== (event.packageId ?? "") ||
    selectedKitId !== (event.equipmentKitId ?? "") ||
    guestCount !== event.guestCount;

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    formData.set("eventId", event.id);
    formData.set("recalculateChecklist", recalculateChecklist ? "true" : "false");

    try {
      const response = await updateServiceEventAction(formData);
      if (response.success) {
        showToast(response.message);
        router.refresh();
        onClose();
      } else {
        showToast(response.error);
      }
    } catch {
      showToast("Error inesperado al actualizar el evento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-outline-variant pb-4">
          <div>
            <h2 className="text-xl font-bold text-on-surface">Editar Evento</h2>
            <p className="mt-1 text-xs text-on-surface-variant">
              Modifica los detalles del evento, invitados, paquete de insumos y modalidad.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <form action={handleSubmit} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-on-surface-variant">Cliente *</span>
              <input
                name="clientName"
                defaultValue={event.clientName}
                required
                placeholder="Nombre del cliente o festejados"
                className="w-full rounded-xl border border-outline-variant bg-background px-3.5 py-2.5 text-sm text-on-surface outline-none transition focus:border-primary"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-on-surface-variant">Teléfono de contacto</span>
              <input
                name="clientPhone"
                defaultValue={event.clientPhone ?? ""}
                placeholder="Opcional"
                className="w-full rounded-xl border border-outline-variant bg-background px-3.5 py-2.5 text-sm text-on-surface outline-none transition focus:border-primary"
              />
            </label>

            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-semibold text-on-surface-variant">Ubicación / Salón *</span>
              <input
                name="location"
                defaultValue={event.location}
                required
                placeholder="Dirección o nombre del salón"
                className="w-full rounded-xl border border-outline-variant bg-background px-3.5 py-2.5 text-sm text-on-surface outline-none transition focus:border-primary"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-on-surface-variant">Fecha y hora del evento *</span>
              <input
                name="eventDate"
                type="datetime-local"
                defaultValue={toLocalDatetimeString(event.eventDate)}
                required
                className="w-full rounded-xl border border-outline-variant bg-background px-3.5 py-2.5 text-sm text-on-surface outline-none transition focus:border-primary"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-on-surface-variant">Número de invitados *</span>
              <input
                name="guestCount"
                type="number"
                min="1"
                value={guestCount}
                onChange={(e) => setGuestCount(Number(e.target.value))}
                required
                className="w-full rounded-xl border border-outline-variant bg-background px-3.5 py-2.5 text-sm text-on-surface outline-none transition focus:border-primary"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-on-surface-variant">Paquete de insumos</span>
              <select
                name="packageId"
                value={selectedPackageId}
                onChange={(e) => setSelectedPackageId(e.target.value)}
                className="w-full rounded-xl border border-outline-variant bg-background px-3.5 py-2.5 text-sm text-on-surface outline-none transition focus:border-primary"
              >
                <option value="">Sin paquete</option>
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-on-surface-variant">Modalidad / Kit de equipo</span>
              <select
                name="equipmentKitId"
                value={selectedKitId}
                onChange={(e) => setSelectedKitId(e.target.value)}
                className="w-full rounded-xl border border-outline-variant bg-background px-3.5 py-2.5 text-sm text-on-surface outline-none transition focus:border-primary"
              >
                <option value="">Sin kit de equipo</option>
                {kits.map((kit) => (
                  <option key={kit.id} value={kit.id}>
                    {kit.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-semibold text-on-surface-variant">Monto cobrado al cliente ($ MXN)</span>
              <input
                name="saleAmount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={event.saleAmount ?? ""}
                placeholder="0.00"
                className="w-full rounded-xl border border-outline-variant bg-background px-3.5 py-2.5 text-sm text-on-surface outline-none transition focus:border-primary"
              />
            </label>

            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-semibold text-on-surface-variant">Notas adicionales</span>
              <textarea
                name="notes"
                rows={2}
                defaultValue={event.notes ?? ""}
                placeholder="Instrucciones especiales, chofer, requerimientos..."
                className="w-full rounded-xl border border-outline-variant bg-background px-3.5 py-2.5 text-sm text-on-surface outline-none transition focus:border-primary resize-none"
              />
            </label>
          </div>

          {/* Opción de recálculo inteligente de checklist */}
          {canRecalculate && packageOrGuestsChanged && (
            <div className="rounded-xl border border-secondary/40 bg-secondary/10 p-3.5">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recalculateChecklist}
                  onChange={(e) => setRecalculateChecklist(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded text-primary focus:ring-primary"
                />
                <div className="text-xs text-on-surface">
                  <span className="font-bold text-secondary">
                    Recalcular checklist automáticamente
                  </span>
                  <p className="mt-0.5 text-on-surface-variant">
                    Actualiza las cantidades teóricas de bebidas e insumos según el nuevo número de invitados ({guestCount}) o paquete. Los artículos personalizados que hayas agregado se conservarán.
                  </p>
                </div>
              </label>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-outline-variant pt-4">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container-high transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-on-primary hover:opacity-90 active:scale-95 disabled:opacity-50 transition"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
