"use client";

import { useEffect, useState } from "react";
import { getScheduleTemplates } from "@/app/actions/scheduleTemplates";

type BranchLite = { id: string; name: string; color: string | null };
type Employee = { id: string; name: string };

export type TemplateSummary = {
  id: string;
  name: string;
  description: string | null;
  branch: BranchLite | null;
  shiftCount: number;
  employeeCount: number;
  unassignedCount: number;
};

/** Modal para elegir una plantilla guardada y pasar a aplicarla. */
export default function UseTemplateModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (template: TemplateSummary, employees: Employee[]) => void;
}) {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const result = await getScheduleTemplates();
      if ("error" in result) {
        setError(result.error ?? "No se pudieron cargar las plantillas.");
        setLoading(false);
        return;
      }
      setTemplates(result.templates);
      setEmployees(result.employees);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-surface-dim/80 p-3 sm:p-6">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-outline-variant bg-surface-container shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-outline-variant px-6 py-5">
          <h2 className="text-xl font-bold text-on-surface">Usar plantilla</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg px-2 py-1 text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {error && (
            <div className="mb-4 rounded-xl border border-error/40 bg-error/10 p-3 text-sm text-error">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-on-surface-variant">Cargando plantillas...</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-on-surface-variant">
              Todavía no tienes plantillas guardadas. Ve a la pestaña &quot;Plantillas&quot; para
              crear una, o guarda una semana ya armada desde ahí.
            </p>
          ) : (
            <div className="space-y-3">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onPick(t, employees)}
                  className="w-full rounded-2xl border border-outline-variant bg-background p-4 text-left transition hover:border-primary/40"
                >
                  <p className="font-bold text-on-surface">{t.name}</p>
                  {t.description && (
                    <p className="mt-0.5 text-sm text-on-surface-variant">{t.description}</p>
                  )}
                  <div className="mt-2 flex gap-4 text-xs text-on-surface-variant">
                    <span>{t.shiftCount} turno{t.shiftCount === 1 ? "" : "s"}</span>
                    <span>{t.employeeCount} empleado{t.employeeCount === 1 ? "" : "s"}</span>
                    {t.branch && <span>{t.branch.name}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
