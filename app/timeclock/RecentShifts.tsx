"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestTimeClockEditAction } from "@/app/actions/timeclock";
import { PencilIcon, ClockIcon } from "@/components/ui/icons";

type EditRequest = {
  id: string;
  status: "PENDIENTE" | "APROBADO" | "RECHAZADO";
  requestedClockIn: string;
  requestedClockOut: string;
  reason: string | null;
};

type Shift = {
  id: string;
  clockIn: string;
  clockOut: string;
  branch: { id: string; name: string };
  latestEditRequest: EditRequest | null;
};

function toDatetimeLocal(iso: string) {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function formatShiftHours(clockIn: string, clockOut: string) {
  const hours = (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / (1000 * 60 * 60);
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RecentShifts({ shifts }: { shifts: Shift[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [clockInValue, setClockInValue] = useState("");
  const [clockOutValue, setClockOutValue] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (shifts.length === 0) return null;

  function startEditing(shift: Shift) {
    setEditingId(shift.id);
    setClockInValue(toDatetimeLocal(shift.clockIn));
    setClockOutValue(toDatetimeLocal(shift.clockOut));
    setReason("");
    setError(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setError(null);
  }

  async function submitEdit(shiftId: string) {
    setSaving(true);
    setError(null);

    const result = await requestTimeClockEditAction(
      shiftId,
      clockInValue,
      clockOutValue,
      reason,
    );

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setEditingId(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant">
        <ClockIcon className="h-4 w-4" />
        Tus últimos turnos
      </p>

      <div className="space-y-2">
        {shifts.map((shift) => {
          const isEditing = editingId === shift.id;
          const pending = shift.latestEditRequest?.status === "PENDIENTE" ? shift.latestEditRequest : null;
          const rejected = shift.latestEditRequest?.status === "RECHAZADO" ? shift.latestEditRequest : null;

          return (
            <div
              key={shift.id}
              className="rounded-2xl border border-outline-variant bg-surface-container p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-on-surface">{shift.branch.name}</p>
                  <p className="mt-0.5 text-xs text-on-surface-variant">
                    {formatDateTime(shift.clockIn)} — {new Date(shift.clockOut).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className="mt-1 text-xs font-medium text-on-surface-variant">
                    {formatShiftHours(shift.clockIn, shift.clockOut)}
                  </p>
                </div>

                {!isEditing && !pending && (
                  <button
                    onClick={() => startEditing(shift)}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition duration-150 ease-out hover:scale-[1.04] hover:border-primary/25 hover:text-on-surface active:scale-[0.97]"
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                    Corregir
                  </button>
                )}
              </div>

              {pending && (
                <div className="mt-3 rounded-xl border border-secondary/30 bg-secondary/10 p-3 text-xs text-secondary">
                  Pendiente de aprobación: {formatDateTime(pending.requestedClockIn)} —{" "}
                  {new Date(pending.requestedClockOut).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                  {pending.reason && <p className="mt-1 text-secondary/80">Motivo: {pending.reason}</p>}
                </div>
              )}

              {rejected && !pending && !isEditing && (
                <p className="mt-2 text-xs text-error">
                  Tu última solicitud de corrección fue rechazada. Puedes intentar de nuevo.
                </p>
              )}

              {isEditing && (
                <div className="mt-4 space-y-3 border-t border-outline-variant pt-4">
                  {error && (
                    <div className="rounded-lg border border-error/40 bg-error/10 p-2 text-xs text-error">
                      {error}
                    </div>
                  )}

                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-on-surface-variant">Entrada correcta</span>
                    <input
                      type="datetime-local"
                      value={clockInValue}
                      onChange={(e) => setClockInValue(e.target.value)}
                      className="w-full rounded-lg border border-outline-variant bg-background px-3 py-2 text-sm text-on-surface outline-none transition focus:border-primary"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-on-surface-variant">Salida correcta</span>
                    <input
                      type="datetime-local"
                      value={clockOutValue}
                      onChange={(e) => setClockOutValue(e.target.value)}
                      className="w-full rounded-lg border border-outline-variant bg-background px-3 py-2 text-sm text-on-surface outline-none transition focus:border-primary"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-on-surface-variant">Motivo (opcional)</span>
                    <input
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Ej. se me olvidó checar salida"
                      className="w-full rounded-lg border border-outline-variant bg-background px-3 py-2 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
                    />
                  </label>

                  <p className="text-xs text-on-surface-variant">
                    Esto no cambia tu turno de inmediato: se manda a un administrador para su aprobación.
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => submitEdit(shift.id)}
                      disabled={saving}
                      className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-on-primary transition duration-150 ease-out hover:opacity-90 hover:scale-[1.02] active:scale-[0.97] disabled:opacity-60"
                    >
                      {saving ? "Enviando..." : "Enviar a aprobación"}
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="rounded-xl border border-outline-variant px-4 py-2.5 text-sm text-on-surface-variant hover:text-on-surface"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
