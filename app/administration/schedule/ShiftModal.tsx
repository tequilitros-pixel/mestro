"use client";

import { useEffect, useMemo, useState } from "react";
import {
  upsertScheduledShiftAction,
  deleteScheduledShiftAction,
  duplicateShiftAction,
} from "@/app/actions/schedule";
import { addDaysToDateOnly, weekdayOfDateOnly } from "@/lib/dateOnly";
import { useToast } from "@/components/ui/Toast";
import { TrashIcon, ClipboardIcon } from "@/components/ui/icons";

type Employee = { id: string; name: string };
type BranchLite = { id: string; name: string; color: string | null };
type Template = { branchId: string; dayOfWeek: number; startTime: string; endTime: string };

export type ShiftModalInitial = {
  id?: string;
  userId: string;
  date: string;
  type: "TURNO" | "DESCANSO";
  branchId: string;
  startTime: string;
  endTime: string;
  position: string;
  notes: string;
};

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** JS getUTCDay() es domingo=0…sábado=6; las plantillas usan lunes=0…domingo=6. */
function mondayIndexedWeekday(dateStr: string) {
  const jsDay = weekdayOfDateOnly(dateStr);
  return (jsDay + 6) % 7;
}

export default function ShiftModal({
  employees,
  branches,
  templates,
  weekDates,
  initial,
  onClose,
  onSaved,
}: {
  employees: Employee[];
  branches: BranchLite[];
  templates: Template[];
  weekDates: string[];
  initial: ShiftModalInitial;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const isEditing = Boolean(initial.id);

  const [userId, setUserId] = useState(initial.userId);
  const [date, setDate] = useState(initial.date);
  const [type, setType] = useState<"TURNO" | "DESCANSO">(initial.type);
  const [branchId, setBranchId] = useState(initial.branchId || branches[0]?.id || "");
  const [startTime, setStartTime] = useState(initial.startTime || "09:00");
  const [endTime, setEndTime] = useState(initial.endTime || "17:00");
  const [position, setPosition] = useState(initial.position);
  const [notes, setNotes] = useState(initial.notes);
  const [timeTouched, setTimeTouched] = useState(Boolean(initial.id));

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showDuplicate, setShowDuplicate] = useState(false);
  const [duplicateDates, setDuplicateDates] = useState<Set<string>>(new Set());
  const [duplicateNextWeek, setDuplicateNextWeek] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  // Autocompleta horas desde la plantilla de la sucursal para ese día,
  // mientras el usuario no las haya tocado a mano.
  useEffect(() => {
    if (timeTouched || type !== "TURNO" || !branchId || !date) return;

    const dayIndex = mondayIndexedWeekday(date);
    const template = templates.find((t) => t.branchId === branchId && t.dayOfWeek === dayIndex);

    if (template) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStartTime(template.startTime);
      setEndTime(template.endTime);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, date, type, templates]);

  const activeTemplate = useMemo(() => {
    if (!date || !branchId) return null;
    const dayIndex = mondayIndexedWeekday(date);
    return templates.find((t) => t.branchId === branchId && t.dayOfWeek === dayIndex) ?? null;
  }, [templates, branchId, date]);

  async function handleSave() {
    if (!userId || !date) {
      setError("Selecciona empleado y fecha.");
      return;
    }

    if (type === "TURNO" && (!branchId || !startTime || !endTime)) {
      setError("Un turno necesita sucursal, hora de entrada y hora de salida.");
      return;
    }

    setSaving(true);
    setError(null);

    const result = await upsertScheduledShiftAction({
      id: initial.id,
      userId,
      date,
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

    showToast(isEditing ? "Turno actualizado." : "Turno agregado.");
    onSaved();
  }

  async function handleDelete() {
    if (!initial.id) return;

    setDeleting(true);
    const result = await deleteScheduledShiftAction(initial.id);
    setDeleting(false);

    if (result.error) {
      setError(result.error);
      setConfirmingDelete(false);
      return;
    }

    showToast("Turno eliminado.");
    onSaved();
  }

  function toggleDuplicateDate(d: string) {
    setDuplicateDates((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  async function handleDuplicate() {
    if (!initial.id) return;

    const targets = new Set(duplicateDates);
    if (duplicateNextWeek) targets.add(addDaysToDateOnly(date, 7));

    if (targets.size === 0) {
      setError("Selecciona al menos un día destino para duplicar.");
      return;
    }

    setDuplicating(true);
    setError(null);

    const result = await duplicateShiftAction(initial.id, Array.from(targets));

    setDuplicating(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    showToast(`Turno duplicado a ${result.count ?? targets.size} día(s).`);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-surface-dim/80 p-3 sm:p-6">
      <div className="flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-outline-variant bg-surface-container shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-outline-variant px-6 py-5">
          <h2 className="text-xl font-bold text-on-surface">
            {isEditing ? "Editar turno" : "Agregar turno"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg px-2 py-1 text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-5">
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
                <span className="text-sm font-semibold text-on-surface-variant">Empleado</span>
                <select
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-on-surface-variant">Fecha</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setTimeTouched(false);
                  }}
                  className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                />
              </label>
            </div>

            {type === "TURNO" && (
              <>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-on-surface-variant">Sucursal</span>
                  <select
                    value={branchId}
                    onChange={(e) => {
                      setBranchId(e.target.value);
                      setTimeTouched(false);
                    }}
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
                      onChange={(e) => {
                        setStartTime(e.target.value);
                        setTimeTouched(true);
                      }}
                      className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-on-surface-variant">Salida</span>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => {
                        setEndTime(e.target.value);
                        setTimeTouched(true);
                      }}
                      className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                    />
                  </label>
                </div>

                {activeTemplate && !timeTouched && (
                  <p className="text-xs text-on-surface-variant">
                    Horas de la plantilla: {activeTemplate.startTime}–{activeTemplate.endTime}
                  </p>
                )}

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

              {isEditing && type === "TURNO" && (
                <button
                  onClick={() => setShowDuplicate((v) => !v)}
                  className="ml-auto inline-flex items-center gap-2 rounded-xl border border-outline-variant px-4 py-3 text-sm font-semibold text-on-surface-variant transition hover:border-primary/40 hover:text-on-surface"
                >
                  <ClipboardIcon className="h-4 w-4" />
                  Duplicar
                </button>
              )}
            </div>

            {isEditing && showDuplicate && (
              <div className="space-y-4 rounded-2xl border border-outline-variant bg-background p-5">
                <p className="text-sm font-semibold text-on-surface">Duplicar este turno a:</p>

                <div className="flex flex-wrap gap-2">
                  {weekDates.map((d, i) => {
                    const isSource = d === date;
                    const selected = duplicateDates.has(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        disabled={isSource}
                        onClick={() => toggleDuplicateDate(d)}
                        className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                          isSource
                            ? "cursor-not-allowed border-outline-variant/50 text-outline"
                            : selected
                              ? "border-primary/40 bg-primary/10 text-primary"
                              : "border-outline-variant text-on-surface-variant hover:border-primary/40"
                        }`}
                      >
                        {DAY_LABELS[i]}
                      </button>
                    );
                  })}
                </div>

                <label className="flex items-center gap-2 text-sm text-on-surface-variant">
                  <input
                    type="checkbox"
                    checked={duplicateNextWeek}
                    onChange={(e) => setDuplicateNextWeek(e.target.checked)}
                    className="h-4 w-4"
                  />
                  También el mismo día de la próxima semana
                </label>

                <button
                  onClick={handleDuplicate}
                  disabled={duplicating}
                  className="w-full rounded-xl bg-secondary/15 py-3 text-sm font-bold text-secondary transition duration-150 ease-out hover:opacity-90 hover:scale-[1.02] active:scale-[0.97] disabled:opacity-60"
                >
                  {duplicating ? "Duplicando..." : "Confirmar duplicado"}
                </button>
              </div>
            )}

            {isEditing && (
              <div className="rounded-2xl border border-error/40 bg-error/10 p-5">
                {!confirmingDelete ? (
                  <button
                    onClick={() => setConfirmingDelete(true)}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-error"
                  >
                    <TrashIcon className="h-4 w-4" />
                    Eliminar turno
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm text-error">¿Confirmas eliminar? No se puede deshacer.</span>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="rounded-xl bg-error px-4 py-2 text-sm font-semibold text-on-surface transition hover:opacity-90 disabled:opacity-60"
                    >
                      {deleting ? "Eliminando..." : "Sí, eliminar"}
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
