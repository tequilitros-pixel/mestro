"use client";

import { useEffect, useMemo, useState } from "react";
import {
  applyTemplateAction,
  getScheduleTemplateDetail,
} from "@/app/actions/scheduleTemplates";
import { mondayOfWeek } from "@/lib/dateOnly";
import { useToast } from "@/components/ui/Toast";

type Employee = { id: string; name: string };

export default function ApplyTemplateModal({
  templateId,
  templateName,
  employees,
  defaultWeekStart,
  onClose,
  onApplied,
}: {
  templateId: string;
  templateName: string;
  employees: Employee[];
  defaultWeekStart: string;
  onClose: () => void;
  onApplied: () => void;
}) {
  const { showToast } = useToast();

  const [weekStart, setWeekStart] = useState(mondayOfWeek(defaultWeekStart));
  const [loading, setLoading] = useState(true);
  const [templateEmployeeIds, setTemplateEmployeeIds] = useState<string[]>([]);
  const [substitutions, setSubstitutions] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      const result = await getScheduleTemplateDetail(templateId);
      if (!active) return;

      if ("error" in result) {
        setError(result.error ?? "No se pudo cargar la plantilla.");
        setLoading(false);
        return;
      }

      const ids = Array.from(
        new Set(result.template.shifts.map((s) => s.userId).filter((id): id is string => Boolean(id))),
      );
      setTemplateEmployeeIds(ids);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [templateId]);

  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e.name])), [employees]);

  function setSubstitute(fromUserId: string, toUserId: string) {
    setSubstitutions((prev) => {
      const next = { ...prev };
      if (!toUserId || toUserId === fromUserId) {
        delete next[fromUserId];
      } else {
        next[fromUserId] = toUserId;
      }
      return next;
    });
  }

  async function handleApply() {
    if (!weekStart) {
      setError("Selecciona la semana destino.");
      return;
    }

    setApplying(true);
    setError(null);

    const result = await applyTemplateAction({
      templateId,
      weekStart,
      substitutions,
    });

    setApplying(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    showToast(
      result.skipped
        ? `Plantilla aplicada: ${result.created} turno(s) creados, ${result.skipped} sin empleado se saltaron.`
        : `Plantilla aplicada: ${result.created} turno(s) creados.`,
    );
    onApplied();
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-surface-dim/80 p-3 sm:p-6">
      <div className="flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-outline-variant bg-surface-container shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-outline-variant px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-on-surface">Aplicar plantilla</h2>
            <p className="text-sm text-on-surface-variant">{templateName}</p>
          </div>
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

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-on-surface-variant">Semana destino</span>
              <input
                type="date"
                value={weekStart}
                onChange={(e) => {
                  if (e.target.value) setWeekStart(mondayOfWeek(e.target.value));
                }}
                className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
              />
              <span className="block text-xs text-on-surface-variant">
                Se ajusta siempre al lunes de esa semana.
              </span>
            </label>

            {loading ? (
              <p className="text-sm text-on-surface-variant">Cargando plantilla...</p>
            ) : templateEmployeeIds.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-on-surface">
                  Sustituir empleados (opcional)
                </p>
                <p className="text-xs text-on-surface-variant">
                  Por defecto se aplica al mismo empleado de la plantilla. Cambia el destino si
                  alguien ya no está o quieres reasignar su turno.
                </p>

                <div className="space-y-2">
                  {templateEmployeeIds.map((fromId) => (
                    <div key={fromId} className="flex items-center gap-2">
                      <span className="w-1/2 truncate text-sm text-on-surface-variant">
                        {employeeById.get(fromId) ?? "Empleado eliminado"}
                      </span>
                      <span className="text-on-surface-variant">→</span>
                      <select
                        value={substitutions[fromId] ?? fromId}
                        onChange={(e) => setSubstitute(fromId, e.target.value)}
                        className="w-1/2 rounded-xl border border-outline-variant bg-background px-3 py-2 text-sm text-on-surface outline-none transition focus:border-primary"
                      >
                        <option value={fromId}>{employeeById.get(fromId) ?? "(mismo)"}</option>
                        {employees
                          .filter((e) => e.id !== fromId)
                          .map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant">
                Esta plantilla no tiene empleados asignados todavía.
              </p>
            )}

            <div className="flex flex-wrap gap-3 border-t border-outline-variant pt-5">
              <button
                onClick={handleApply}
                disabled={applying || loading}
                className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100"
              >
                {applying ? "Aplicando..." : "Aplicar plantilla"}
              </button>

              <button
                onClick={onClose}
                className="rounded-xl border border-outline-variant px-6 py-3 text-sm font-semibold text-on-surface-variant transition hover:border-primary/40 hover:text-on-surface"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
