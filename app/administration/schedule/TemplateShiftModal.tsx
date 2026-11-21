"use client";

import { useState } from "react";
import {
  upsertTemplateShiftAction,
  deleteTemplateShiftAction,
} from "@/app/actions/scheduleTemplates";
import { useToast } from "@/components/ui/Toast";
import { TrashIcon } from "@/components/ui/icons";

type Employee = { id: string; name: string };
type BranchLite = { id: string; name: string; color: string | null };

const DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export type TemplateShiftModalInitial = {
  id?: string;
  templateId: string;
  dayOfWeek: number;
  userId: string;
  type: "TURNO" | "DESCANSO";
  branchId: string;
  startTime: string;
  endTime: string;
  position: string;
  notes: string;
};

export default function TemplateShiftModal({
  employees,
  branches,
  initial,
  onClose,
  onSaved,
}: {
  employees: Employee[];
  branches: BranchLite[];
  initial: TemplateShiftModalInitial;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const isEditing = Boolean(initial.id);

  const [dayOfWeek, setDayOfWeek] = useState(initial.dayOfWeek);
  const [userId, setUserId] = useState(initial.userId);
  const [type, setType] = useState<"TURNO" | "DESCANSO">(initial.type);
  const [branchId, setBranchId] = useState(initial.branchId || branches[0]?.id || "");
  const [startTime, setStartTime] = useState(initial.startTime || "09:00");
  const [endTime, setEndTime] = useState(initial.endTime || "17:00");
  const [position, setPosition] = useState(initial.position);
  const [notes, setNotes] = useState(initial.notes);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (type === "TURNO" && (!startTime || !endTime)) {
      setError("Un turno necesita hora de entrada y hora de salida.");
      return;
    }

    setSaving(true);
    setError(null);

    const result = await upsertTemplateShiftAction({
      id: initial.id,
      templateId: initial.templateId,
      dayOfWeek,
      userId: userId || undefined,
      type,
      branchId: type === "TURNO" ? branchId : undefined,
      startTime: type === "TURNO" ? startTime : undefined,
      endTime: type === "TURNO" ? endTime : undefined,
      position,
      notes,
    });

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    showToast(isEditing ? "Turno de plantilla actualizado." : "Turno agregado a la plantilla.");
    onSaved();
  }

  async function handleDelete() {
    if (!initial.id) return;

    setDeleting(true);
    const result = await deleteTemplateShiftAction(initial.id);
    setDeleting(false);

    if (result.error) {
      setError(result.error);
      setConfirmingDelete(false);
      return;
    }

    showToast("Turno quitado de la plantilla.");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-surface-dim/80 p-3 sm:p-6">
      <div className="compact-modal-panel flex w-full max-w-lg flex-col overflow-hidden border border-outline-variant bg-surface-container">
        <header className="compact-modal-header flex shrink-0 items-center justify-between border-b border-outline-variant">
          <h2 className="text-xl font-bold text-on-surface">
            {isEditing ? "Editar turno de plantilla" : "Agregar turno a la plantilla"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg px-2 py-1 text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
          >
            ✕
          </button>
        </header>

        <div className="compact-modal-body min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-4">
            {error && (
              <div className="rounded-xl border border-error/40 bg-error/10 p-3 text-sm text-error">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType("TURNO")}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                  type === "TURNO"
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-outline-variant text-on-surface-variant hover:border-primary/40"
                }`}
              >
                Turno
              </button>
              <button
                type="button"
                onClick={() => setType("DESCANSO")}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                  type === "DESCANSO"
                    ? "border-secondary/40 bg-secondary/10 text-secondary"
                    : "border-outline-variant text-on-surface-variant hover:border-secondary/40"
                }`}
              >
                Descanso / día libre
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-on-surface-variant">Día de la semana</span>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(Number(e.target.value))}
                  className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                >
                  {DAY_LABELS.map((label, i) => (
                    <option key={i} value={i}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-on-surface-variant">Empleado (opcional)</span>
                <select
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                >
                  <option value="">— Sin asignar —</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {type === "TURNO" && (
              <>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-on-surface-variant">Sucursal</span>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-on-surface-variant">Entrada</span>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-on-surface-variant">Salida</span>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                    />
                  </label>
                </div>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-on-surface-variant">
                    Puesto / función (opcional)
                  </span>
                  <input
                    type="text"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="Ej. Bartender"
                    className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
                  />
                </label>
              </>
            )}

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-on-surface-variant">Notas (opcional)</span>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
              />
            </label>

            <div className="flex flex-wrap gap-3 border-t border-outline-variant pt-5">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100"
              >
                {saving ? "Guardando..." : isEditing ? "Guardar cambios" : "Agregar turno"}
              </button>

              <button
                onClick={onClose}
                className="rounded-xl border border-outline-variant px-6 py-3 text-sm font-semibold text-on-surface-variant transition hover:border-primary/40 hover:text-on-surface"
              >
                Cancelar
              </button>
            </div>

            {isEditing && (
              <div className="rounded-xl border border-error/40 bg-error/10 p-4">
                {!confirmingDelete ? (
                  <button
                    onClick={() => setConfirmingDelete(true)}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-error"
                  >
                    <TrashIcon className="h-4 w-4" />
                    Quitar de la plantilla
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm text-error">¿Confirmas quitarlo? No se puede deshacer.</span>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="rounded-xl bg-error px-4 py-2 text-sm font-semibold text-on-surface transition hover:opacity-90 disabled:opacity-60"
                    >
                      {deleting ? "Quitando..." : "Sí, quitar"}
                    </button>
                    <button
                      onClick={() => setConfirmingDelete(false)}
                      className="text-sm text-on-surface-variant hover:text-on-surface"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
