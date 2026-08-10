"use client";

import { useEffect, useState } from "react";
import {
  createScheduleEventAction,
  updateScheduleEventAction,
  deleteScheduleEventAction,
  getScheduleEventDetail,
} from "@/app/actions/scheduleEvents";
import { useToast } from "@/components/ui/Toast";
import { TrashIcon, PartyIcon } from "@/components/ui/icons";

type Employee = { id: string; name: string };
type BranchLite = { id: string; name: string; color: string | null };

export default function EventModal({
  eventId,
  defaultDate,
  employees,
  branches,
  onClose,
  onSaved,
}: {
  /** Si viene, se edita ese evento; si no, se crea uno nuevo. */
  eventId?: string;
  defaultDate: string;
  employees: Employee[];
  branches: BranchLite[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const isEditing = Boolean(eventId);

  const [loading, setLoading] = useState(isEditing);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("23:00");
  const [location, setLocation] = useState("");
  const [branchId, setBranchId] = useState("");
  const [position, setPosition] = useState("");
  const [instructions, setInstructions] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [employeeIds, setEmployeeIds] = useState<Set<string>>(new Set());

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;

    (async () => {
      const result = await getScheduleEventDetail(eventId);
      if ("error" in result) {
        setError(result.error ?? "No se pudo cargar el evento.");
        setLoading(false);
        return;
      }

      const ev = result.event;
      setName(ev.name);
      setDescription(ev.description ?? "");
      setDate(new Date(ev.date).toISOString().slice(0, 10));
      setStartTime(ev.startTime);
      setEndTime(ev.endTime);
      setLocation(ev.location ?? "");
      setBranchId(ev.branchId ?? "");
      setPosition(ev.position ?? "");
      setInstructions(ev.instructions ?? "");
      setInternalNotes(ev.internalNotes ?? "");
      setEmployeeIds(new Set(ev.employees.map((e) => e.id)));
      setLoading(false);
    })();
  }, [eventId]);

  function toggleEmployee(id: string) {
    setEmployeeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    if (employeeIds.size === 0) {
      setError("Asigna al menos un empleado al evento.");
      return;
    }

    setSaving(true);
    setError(null);

    const input = {
      name,
      description,
      date,
      startTime,
      endTime,
      location,
      branchId: branchId || undefined,
      position,
      instructions,
      internalNotes,
      employeeIds: Array.from(employeeIds),
    };

    const result = isEditing
      ? await updateScheduleEventAction({ ...input, eventId: eventId! })
      : await createScheduleEventAction(input);

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    showToast(isEditing ? "Evento actualizado." : "Evento creado.");
    onSaved();
  }

  async function handleDelete() {
    if (!eventId) return;

    setDeleting(true);
    const result = await deleteScheduleEventAction(eventId);
    setDeleting(false);

    if (result.error) {
      setError(result.error);
      setConfirmingDelete(false);
      return;
    }

    showToast("Evento eliminado.");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-surface-dim/80 p-3 sm:p-6">
      <div className="flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-outline-variant bg-surface-container shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-outline-variant px-6 py-5">
          <h2 className="inline-flex items-center gap-2 text-xl font-bold text-on-surface">
            <PartyIcon className="h-5 w-5" />
            {isEditing ? "Editar evento" : "Nuevo evento"}
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
          {loading ? (
            <p className="text-sm text-on-surface-variant">Cargando evento...</p>
          ) : (
            <div className="space-y-5">
              {error && (
                <div className="rounded-xl border border-error/40 bg-error/10 p-3 text-sm text-error">
                  {error}
                </div>
              )}

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-on-surface-variant">Nombre del evento</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. XV años de Mariana"
                  autoFocus
                  className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-on-surface-variant">Descripción (opcional)</span>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej. Servicio de barra para 120 personas."
                  className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-on-surface-variant">Fecha</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                  />
                </label>
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
                <span className="text-sm font-semibold text-on-surface-variant">Lugar / ubicación (opcional)</span>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ej. Salón Los Arcos"
                  className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-on-surface-variant">
                    Sucursal responsable (opcional)
                  </span>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                  >
                    <option value="">— Sin definir —</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-on-surface-variant">
                    Puesto / trabajo (opcional)
                  </span>
                  <input
                    type="text"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="Ej. Bartender"
                    className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-on-surface-variant">
                  Instrucciones para el personal (opcional, visibles para ellos)
                </span>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={2}
                  placeholder="Ej. Presentarse 30 minutos antes con uniforme negro."
                  className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-on-surface-variant">
                  Notas internas (opcional, solo administración)
                </span>
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                />
              </label>

              <div>
                <p className="mb-2 text-sm font-semibold text-on-surface-variant">
                  Empleados asignados ({employeeIds.size})
                </p>
                <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                  {employees.map((emp) => {
                    const selected = employeeIds.has(emp.id);
                    return (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => toggleEmployee(emp.id)}
                        className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                          selected
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-outline-variant text-on-surface-variant hover:border-primary/40"
                        }`}
                      >
                        {emp.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 border-t border-outline-variant pt-5">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100"
                >
                  {saving ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear evento"}
                </button>
                <button
                  onClick={onClose}
                  className="rounded-xl border border-outline-variant px-6 py-3 text-sm font-semibold text-on-surface-variant transition hover:border-primary/40 hover:text-on-surface"
                >
                  Cancelar
                </button>
              </div>

              {isEditing && (
                <div className="rounded-2xl border border-error/40 bg-error/10 p-5">
                  {!confirmingDelete ? (
                    <button
                      onClick={() => setConfirmingDelete(true)}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-error"
                    >
                      <TrashIcon className="h-4 w-4" />
                      Eliminar evento
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm text-error">
                        ¿Confirmas eliminar? Se quitan los turnos de todos los empleados asignados.
                      </span>
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
          )}
        </div>
      </div>
    </div>
  );
}
