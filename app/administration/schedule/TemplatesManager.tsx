"use client";

import { useEffect, useState } from "react";
import {
  getScheduleTemplates,
  createTemplateAction,
  duplicateTemplateAction,
  deleteTemplateAction,
} from "@/app/actions/scheduleTemplates";
import { useToast } from "@/components/ui/Toast";
import { PlusIcon, TrashIcon, ClipboardIcon, CalendarIcon } from "@/components/ui/icons";
import { mondayOfWeek, todayDateOnly } from "@/lib/dateOnly";
import TemplateEditor from "./TemplateEditor";
import ApplyTemplateModal from "./ApplyTemplateModal";

type Employee = { id: string; name: string };
type BranchLite = { id: string; name: string; color: string | null };

type TemplateSummary = {
  id: string;
  name: string;
  description: string | null;
  branch: BranchLite | null;
  shiftCount: number;
  employeeCount: number;
  unassignedCount: number;
};

export default function TemplatesManager() {
  const { showToast } = useToast();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<BranchLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [applyingTemplate, setApplyingTemplate] = useState<TemplateSummary | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newBranchId, setNewBranchId] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);

    const result = await getScheduleTemplates();

    if ("error" in result) {
      setError(result.error ?? "No se pudieron cargar las plantillas.");
      setLoading(false);
      return;
    }

    setTemplates(result.templates);
    setEmployees(result.employees);
    setBranches(result.branches);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function handleCreate() {
    if (!newName.trim()) {
      setError("Ponle un nombre a la plantilla.");
      return;
    }

    setCreating(true);
    setError(null);

    const result = await createTemplateAction({
      name: newName,
      description: newDescription,
      branchId: newBranchId || undefined,
    });

    setCreating(false);

    if (result.error || !result.templateId) {
      setError(result.error ?? "No se pudo crear la plantilla.");
      return;
    }

    showToast("Plantilla creada. Ahora agrégale turnos.");
    setShowCreate(false);
    setNewName("");
    setNewDescription("");
    setNewBranchId("");
    setEditingTemplateId(result.templateId);
  }

  async function handleDuplicate(templateId: string) {
    const result = await duplicateTemplateAction(templateId);

    if (result.error) {
      setError(result.error);
      return;
    }

    showToast("Plantilla duplicada.");
    load();
  }

  async function handleDelete(templateId: string) {
    setDeletingId(templateId);
    const result = await deleteTemplateAction(templateId);
    setDeletingId(null);
    setConfirmDeleteId(null);

    if (result.error) {
      setError(result.error);
      return;
    }

    showToast("Plantilla eliminada.");
    load();
  }

  if (editingTemplateId) {
    return (
      <TemplateEditor
        templateId={editingTemplateId}
        employees={employees}
        branches={branches}
        onBack={() => {
          setEditingTemplateId(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-on-surface">Plantillas de horario</h2>
          <p className="text-sm text-on-surface-variant">
            Semanas completas reutilizables. Guarda una semana ya armada desde Horario, o crea una
            nueva aquí.
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
        >
          <PlusIcon className="h-4 w-4" />
          Nueva plantilla
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-error/40 bg-error/10 p-4 text-sm text-error">
          {error}
        </div>
      )}

      {showCreate && (
        <div className="space-y-4 rounded-2xl border border-outline-variant bg-surface-container p-5">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-on-surface-variant">Nombre</span>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ej. Horario normal Centro"
              className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-on-surface-variant">Descripción (opcional)</span>
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-on-surface-variant">
              Sucursal principal (opcional, solo informativo)
            </span>
            <select
              value={newBranchId}
              onChange={(e) => setNewBranchId(e.target.value)}
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
          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary transition hover:opacity-90 disabled:opacity-60"
            >
              {creating ? "Creando..." : "Crear y agregar turnos"}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-xl border border-outline-variant px-5 py-2.5 text-sm font-semibold text-on-surface-variant transition hover:border-primary/40 hover:text-on-surface"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-on-surface-variant">Cargando plantillas...</p>
      ) : templates.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-outline-variant p-8 text-center text-sm text-on-surface-variant">
          Todavía no hay plantillas. Guarda una semana desde Horario o crea una nueva aquí.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-surface-container p-5"
            >
              <div>
                <p className="font-bold text-on-surface">{t.name}</p>
                {t.description && (
                  <p className="mt-0.5 text-sm text-on-surface-variant">{t.description}</p>
                )}
                {t.branch && (
                  <span
                    className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                    style={{ backgroundColor: t.branch.color ?? "#636E72" }}
                  >
                    {t.branch.name}
                  </span>
                )}
              </div>

              <div className="flex gap-4 text-xs text-on-surface-variant">
                <span>{t.shiftCount} turno{t.shiftCount === 1 ? "" : "s"}</span>
                <span>{t.employeeCount} empleado{t.employeeCount === 1 ? "" : "s"}</span>
                {t.unassignedCount > 0 && (
                  <span className="text-secondary">{t.unassignedCount} sin asignar</span>
                )}
              </div>

              <div className="mt-auto flex flex-wrap gap-2 border-t border-outline-variant pt-3">
                <button
                  onClick={() => setEditingTemplateId(t.id)}
                  className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition hover:border-primary/40 hover:text-on-surface"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDuplicate(t.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition hover:border-primary/40 hover:text-on-surface"
                >
                  <ClipboardIcon className="h-3.5 w-3.5" />
                  Duplicar
                </button>
                <button
                  onClick={() => setApplyingTemplate(t)}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary/15 px-3 py-1.5 text-xs font-bold text-primary transition hover:opacity-90"
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Aplicar
                </button>

                {confirmDeleteId === t.id ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDelete(t.id)}
                      disabled={deletingId === t.id}
                      className="rounded-lg bg-error px-3 py-1.5 text-xs font-semibold text-on-surface transition hover:opacity-90 disabled:opacity-60"
                    >
                      {deletingId === t.id ? "Eliminando..." : "Confirmar"}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs text-on-surface-variant hover:text-on-surface"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(t.id)}
                    className="ml-auto inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-error transition hover:bg-error/10"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {applyingTemplate && (
        <ApplyTemplateModal
          templateId={applyingTemplate.id}
          templateName={applyingTemplate.name}
          employees={employees}
          defaultWeekStart={mondayOfWeek(todayDateOnly())}
          onClose={() => setApplyingTemplate(null)}
          onApplied={() => {
            setApplyingTemplate(null);
          }}
        />
      )}
    </div>
  );
}
