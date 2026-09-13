"use client";

import { useState } from "react";
import { saveWeekAsTemplateAction } from "@/app/actions/scheduleTemplates";
import { useToast } from "@/components/ui/Toast";

type BranchLite = { id: string; name: string; color: string | null };

export default function SaveAsTemplateModal({
  weekStart,
  branches,
  onClose,
  onSaved,
}: {
  weekStart: string;
  branches: BranchLite[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [branchId, setBranchId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) {
      setError("Ponle un nombre a la plantilla.");
      return;
    }

    setSaving(true);
    setError(null);

    const result = await saveWeekAsTemplateAction({
      weekStart,
      name,
      description,
      branchId: branchId || undefined,
    });

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    showToast(`Plantilla "${name}" guardada con ${result.count ?? 0} turno(s).`);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-surface-dim/80 p-3 sm:p-6">
      <div className="w-full max-w-md rounded-3xl border border-outline-variant bg-surface-container p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-on-surface">Guardar semana como plantilla</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Copia esta semana (empleados, sucursales, horarios y descansos) como plantilla
          reutilizable. Los turnos de eventos puntuales no se incluyen.
        </p>

        <div className="mt-5 space-y-4">
          {error && (
            <div className="rounded-xl border border-error/40 bg-error/10 p-3 text-sm text-error">
              {error}
            </div>
          )}

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-on-surface-variant">Nombre</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Horario normal Centro"
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
              className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-on-surface-variant">
              Sucursal principal (opcional, solo informativo)
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

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary transition hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar plantilla"}
            </button>
            <button
              onClick={onClose}
              className="rounded-xl border border-outline-variant px-5 py-2.5 text-sm font-semibold text-on-surface-variant transition hover:border-primary/40 hover:text-on-surface"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
