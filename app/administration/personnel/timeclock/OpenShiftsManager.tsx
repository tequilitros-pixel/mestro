"use client";

import { useState } from "react";
import { closeShiftManuallyAction } from "@/app/actions/timeclock";

type OpenShift = {
  id: string;
  clockIn: string;
  user: { id: string; name: string };
  branch: { id: string; name: string };
};

function toDatetimeLocal(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function OpenShiftsManager({
  initialShifts,
}: {
  initialShifts: OpenShift[];
}) {
  const [shifts, setShifts] = useState(initialShifts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [clockOutValue, setClockOutValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startClosing(shift: OpenShift) {
    setEditingId(shift.id);
    setClockOutValue(toDatetimeLocal(new Date()));
    setError(null);
  }

  async function confirmClose(shiftId: string) {
    setSaving(true);
    setError(null);

    const result = await closeShiftManuallyAction(shiftId, clockOutValue);

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setShifts((prev) => prev.filter((s) => s.id !== shiftId));
    setEditingId(null);
  }

  if (shifts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-outline-variant p-8 text-center text-on-surface-variant">
        No hay turnos abiertos. Todos los empleados tienen su checador
        al día.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {shifts.map((shift) => {
        const isEditing = editingId === shift.id;

        return (
          <div
            key={shift.id}
            className="rounded-2xl border border-secondary/30 bg-surface-container p-5"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-on-surface">
                  {shift.user.name}
                </p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {shift.branch.name} · entrada{" "}
                  {new Date(shift.clockIn).toLocaleString("es-MX", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>

              {!isEditing && (
                <button
                  onClick={() => startClosing(shift)}
                  className="shrink-0 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition hover:border-secondary/50 hover:text-on-surface"
                >
                  Cerrar turno
                </button>
              )}
            </div>

            {isEditing && (
              <div className="mt-4 space-y-3 border-t border-outline-variant pt-4">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-on-surface-variant">
                    Hora de salida
                  </span>
                  <input
                    type="datetime-local"
                    value={clockOutValue}
                    onChange={(e) => setClockOutValue(e.target.value)}
                    className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                  />
                </label>

                {error && (
                  <p className="text-sm text-error">{error}</p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => confirmClose(shift.id)}
                    disabled={saving}
                    className="flex-1 rounded-xl bg-primary py-3 font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100"
                  >
                    {saving ? "Guardando..." : "Confirmar cierre"}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-xl border border-outline-variant px-4 py-3 text-on-surface-variant hover:border-outline-variant"
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
  );
}
