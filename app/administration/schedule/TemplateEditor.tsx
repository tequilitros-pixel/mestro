"use client";

import { useEffect, useState } from "react";
import {
  getScheduleTemplateDetail,
  renameTemplateAction,
} from "@/app/actions/scheduleTemplates";
import { fallbackBranchColor } from "@/lib/branchColors";
import { useToast } from "@/components/ui/Toast";
import { ChevronLeftIcon, PlusIcon } from "@/components/ui/icons";
import TemplateShiftModal from "./TemplateShiftModal";

type Employee = { id: string; name: string };
type BranchLite = { id: string; name: string; color: string | null };

type TemplateShift = {
  id: string;
  dayOfWeek: number;
  userId: string | null;
  branchId: string | null;
  type: "TURNO" | "DESCANSO";
  startTime: string | null;
  endTime: string | null;
  position: string | null;
  notes: string | null;
  user: { id: string; name: string } | null;
  branch: { id: string; name: string; color: string | null } | null;
};

type TemplateDetail = {
  id: string;
  name: string;
  description: string | null;
  branchId: string | null;
  shifts: TemplateShift[];
};

const DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function formatTime12(time: string) {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
  const period = h >= 12 ? "p.m." : "a.m.";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

type ModalState =
  | { mode: "create"; dayOfWeek: number }
  | { mode: "edit"; shift: TemplateShift };

export default function TemplateEditor({
  templateId,
  employees,
  branches,
  onBack,
}: {
  templateId: string;
  employees: Employee[];
  branches: BranchLite[];
  onBack: () => void;
}) {
  const { showToast } = useToast();
  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);

  const [editingMeta, setEditingMeta] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [branchId, setBranchId] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);

    const result = await getScheduleTemplateDetail(templateId);

    if ("error" in result) {
      setError(result.error ?? "No se pudo cargar la plantilla.");
      setLoading(false);
      return;
    }

    setTemplate(result.template as TemplateDetail);
    setName(result.template.name);
    setDescription(result.template.description ?? "");
    setBranchId(result.template.branchId ?? "");
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  async function handleSaveMeta() {
    if (!name.trim()) {
      setError("Ponle un nombre a la plantilla.");
      return;
    }

    setSavingMeta(true);
    const result = await renameTemplateAction({
      templateId,
      name,
      description,
      branchId: branchId || null,
    });
    setSavingMeta(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    showToast("Plantilla actualizada.");
    setEditingMeta(false);
    load();
  }

  if (loading) {
    return <p className="p-6 text-sm text-on-surface-variant">Cargando plantilla...</p>;
  }

  if (!template) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-on-surface"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Volver a plantillas
        </button>
        <div className="rounded-xl border border-error/40 bg-error/10 p-4 text-sm text-error">
          {error ?? "Plantilla no encontrada."}
        </div>
      </div>
    );
  }

  const shiftsByDay: Record<number, TemplateShift[]> = {};
  for (let i = 0; i < 7; i++) shiftsByDay[i] = [];
  for (const s of template.shifts) shiftsByDay[s.dayOfWeek]?.push(s);

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-on-surface"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Volver a plantillas
      </button>

      {error && (
        <div className="rounded-xl border border-error/40 bg-error/10 p-4 text-sm text-error">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
        {!editingMeta ? (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-on-surface">{template.name}</h2>
              {template.description && (
                <p className="mt-1 text-sm text-on-surface-variant">{template.description}</p>
              )}
            </div>
            <button
              onClick={() => setEditingMeta(true)}
              className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface-variant transition hover:border-primary/40 hover:text-on-surface"
            >
              Renombrar / editar
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-on-surface-variant">Nombre</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
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
            <div className="flex gap-3">
              <button
                onClick={handleSaveMeta}
                disabled={savingMeta}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary transition hover:opacity-90 disabled:opacity-60"
              >
                {savingMeta ? "Guardando..." : "Guardar"}
              </button>
              <button
                onClick={() => setEditingMeta(false)}
                className="rounded-xl border border-outline-variant px-5 py-2.5 text-sm font-semibold text-on-surface-variant transition hover:border-primary/40 hover:text-on-surface"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {DAY_LABELS.map((label, dayIndex) => (
          <div
            key={dayIndex}
            className="space-y-2 rounded-2xl border border-outline-variant bg-surface-container p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-on-surface">{label}</p>
              <button
                onClick={() => setModal({ mode: "create", dayOfWeek: dayIndex })}
                aria-label={`Agregar turno el ${label}`}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-dashed border-outline-variant/60 text-outline transition hover:border-primary/40 hover:text-primary"
              >
                <PlusIcon className="h-3.5 w-3.5" />
              </button>
            </div>

            {shiftsByDay[dayIndex].length === 0 && (
              <p className="text-xs text-on-surface-variant/70">Sin turnos</p>
            )}

            {shiftsByDay[dayIndex].map((s) => {
              if (s.type === "DESCANSO") {
                return (
                  <button
                    key={s.id}
                    onClick={() => setModal({ mode: "edit", shift: s })}
                    className="w-full rounded-lg bg-[#3a3a3d] px-2.5 py-2 text-center text-[10px] font-black uppercase tracking-widest text-white/90 transition hover:brightness-110"
                  >
                    Descanso{s.user ? ` · ${s.user.name}` : ""}
                  </button>
                );
              }

              const color = s.branch?.color || fallbackBranchColor(s.branchId ?? s.id);

              return (
                <button
                  key={s.id}
                  onClick={() => setModal({ mode: "edit", shift: s })}
                  className="w-full rounded-lg px-2.5 py-2 text-left transition hover:brightness-110"
                  style={{ backgroundColor: color, border: "1px solid rgba(255,255,255,0.25)" }}
                >
                  <p className="text-xs font-black leading-tight text-white">
                    {s.startTime ? formatTime12(s.startTime) : "—"}
                    {" – "}
                    {s.endTime ? formatTime12(s.endTime) : "—"}
                  </p>
                  <p className="truncate text-[11px] font-semibold leading-tight text-white/90">
                    {s.user?.name ?? "Sin asignar"}
                  </p>
                  <p className="truncate text-[10px] leading-tight text-white/75">
                    {s.branch?.name ?? "Sin sucursal"}
                  </p>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {modal && (
        <TemplateShiftModal
          employees={employees}
          branches={branches}
          initial={
            modal.mode === "edit"
              ? {
                  id: modal.shift.id,
                  templateId,
                  dayOfWeek: modal.shift.dayOfWeek,
                  userId: modal.shift.userId ?? "",
                  type: modal.shift.type,
                  branchId: modal.shift.branchId ?? branches[0]?.id ?? "",
                  startTime: modal.shift.startTime ?? "",
                  endTime: modal.shift.endTime ?? "",
                  position: modal.shift.position ?? "",
                  notes: modal.shift.notes ?? "",
                }
              : {
                  templateId,
                  dayOfWeek: modal.dayOfWeek,
                  userId: "",
                  type: "TURNO",
                  branchId: branches[0]?.id ?? "",
                  startTime: "",
                  endTime: "",
                  position: "",
                  notes: "",
                }
          }
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}
