"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getBranchScheduleTemplates,
  upsertBranchScheduleTemplateAction,
  clearBranchScheduleTemplateAction,
} from "@/app/actions/schedule";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";
import { ToolboxIcon, TrashIcon } from "@/components/ui/icons";

type Branch = { id: string; name: string };
type Template = {
  id: string;
  branchId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

const DAY_LABELS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

export default function TemplatesEditor() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeBranch, setActiveBranch] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Valores en edición por sucursal + día (mientras no se guarden).
  // Se guarda con clave "branchId-dayOfWeek" para que, al cambiar
  // de sucursal, no se arrastren valores sin guardar de otra.
  const [drafts, setDrafts] = useState<
    Record<string, { start: string; end: string }>
  >({});

  async function load() {
    setLoading(true);
    setError(null);

    const result = await getBranchScheduleTemplates();

    if ("error" in result) {
      setError(result.error ?? "Error");
      setLoading(false);
      return;
    }

    setBranches(result.branches);
    setTemplates(result.templates as unknown as Template[]);
    setActiveBranch((prev) => prev || result.branches[0]?.id || "");
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  function templateFor(dayOfWeek: number) {
    return templates.find(
      (t) => t.branchId === activeBranch && t.dayOfWeek === dayOfWeek
    );
  }

  function draftKey(dayOfWeek: number) {
    return `${activeBranch}-${dayOfWeek}`;
  }

  function draftFor(dayOfWeek: number) {
    const existing = templateFor(dayOfWeek);

    return (
      drafts[draftKey(dayOfWeek)] ?? {
        start: existing?.startTime ?? "09:00",
        end: existing?.endTime ?? "18:00",
      }
    );
  }

  function setDraft(dayOfWeek: number, field: "start" | "end", value: string) {
    setDrafts((prev) => ({
      ...prev,
      [draftKey(dayOfWeek)]: {
        ...draftFor(dayOfWeek),
        [field]: value,
      },
    }));
  }

  async function handleSave(dayOfWeek: number) {
    if (!activeBranch) return;

    const draft = draftFor(dayOfWeek);
    const key = `${activeBranch}-${dayOfWeek}`;
    setSavingKey(key);
    setError(null);

    const result = await upsertBranchScheduleTemplateAction({
      branchId: activeBranch,
      dayOfWeek,
      startTime: draft.start,
      endTime: draft.end,
    });

    setSavingKey(null);

    if (result.error) {
      setError(result.error);
      return;
    }

    setDrafts((prev) => {
      const next = { ...prev };
      delete next[draftKey(dayOfWeek)];
      return next;
    });

    await load();
  }

  async function handleClear(dayOfWeek: number) {
    if (!activeBranch) return;

    const key = `${activeBranch}-${dayOfWeek}`;
    setSavingKey(key);
    setError(null);

    const result = await clearBranchScheduleTemplateAction({
      branchId: activeBranch,
      dayOfWeek,
    });

    setSavingKey(null);

    if (result.error) {
      setError(result.error);
      return;
    }

    setDrafts((prev) => {
      const next = { ...prev };
      delete next[draftKey(dayOfWeek)];
      return next;
    });

    await load();
  }

  const activeBranchName = branches.find((b) => b.id === activeBranch)?.name;

  const configuredCount = useMemo(
    () => templates.filter((t) => t.branchId === activeBranch).length,
    [templates, activeBranch]
  );

  if (loading) {
    return (
      <p className="text-center text-on-surface-variant">Cargando...</p>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-primary/25 bg-surface-container">
        <div className="border-b border-outline-variant bg-primary/[0.06] p-6 sm:p-8">
          <p className="font-mono text-xs font-black uppercase tracking-[0.3em] text-on-surface-variant">
            Plantillas de sucursal
          </p>

          <h2 className="mt-2 text-2xl font-bold text-on-surface">
            Horario estándar por sucursal
          </h2>

          <p className="mt-1 text-sm text-on-surface-variant">
            Horario de entrada y salida por sucursal y día. Se usa
            para autocompletar los turnos nuevos.
          </p>
        </div>

        <div className="p-6 sm:p-8">
          {branches.length === 0 ? (
            <p className="text-sm text-outline">
              No hay sucursales activas registradas.
            </p>
          ) : (
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-on-surface-variant">
                Sucursal
              </span>

              <div className="flex flex-wrap gap-2">
                {branches.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setActiveBranch(b.id)}
                    className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                      activeBranch === b.id
                        ? "bg-primary text-on-primary"
                        : "border border-outline-variant text-on-surface-variant hover:border-primary/40 hover:text-on-surface"
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </label>
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-error/40 bg-error/10 p-4 text-sm text-error">
          {error}
        </div>
      )}

      {activeBranch && (
        <>
          <section className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Card highlight>
              <CardLabel>Días configurados</CardLabel>
              <CardValue>{configuredCount}/7</CardValue>
            </Card>

            <Card>
              <CardLabel>Días sin horario</CardLabel>
              <CardValue>{7 - configuredCount}</CardValue>
            </Card>
          </section>

          <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container">
            <div className="flex items-center gap-2 border-b border-outline-variant bg-surface-container-high px-6 py-4">
              <ToolboxIcon className="h-5 w-5 text-on-surface-variant" />
              <p className="font-bold text-on-surface">
                Plantilla de {activeBranchName}
              </p>
            </div>

            <div className="divide-y divide-outline-variant">
              {DAY_LABELS.map((label, dayOfWeek) => {
                const existing = templateFor(dayOfWeek);
                const draft = draftFor(dayOfWeek);
                const key = `${activeBranch}-${dayOfWeek}`;
                const isSaving = savingKey === key;

                return (
                  <div
                    key={dayOfWeek}
                    className="flex flex-wrap items-center justify-between gap-3 p-4"
                  >
                    <div className="flex w-32 shrink-0 items-center gap-2.5">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          existing ? "bg-tertiary-fixed-dim" : "bg-outline"
                        }`}
                      />
                      <div>
                        <p className="font-semibold text-on-surface">{label}</p>
                        <p className="text-xs text-on-surface-variant">
                          {existing ? "Con plantilla" : "Sin horario"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="time"
                        value={draft.start}
                        onChange={(e) =>
                          setDraft(dayOfWeek, "start", e.target.value)
                        }
                        className="rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                      />

                      <span className="text-on-surface-variant">–</span>

                      <input
                        type="time"
                        value={draft.end}
                        onChange={(e) =>
                          setDraft(dayOfWeek, "end", e.target.value)
                        }
                        className="rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                      />

                      <button
                        onClick={() => handleSave(dayOfWeek)}
                        disabled={isSaving}
                        className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition hover:opacity-90 disabled:opacity-60"
                      >
                        {isSaving ? "Guardando..." : "Guardar"}
                      </button>

                      {existing && (
                        <button
                          onClick={() => handleClear(dayOfWeek)}
                          disabled={isSaving}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface-variant transition hover:border-error hover:text-error disabled:opacity-60"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                          {isSaving ? "Eliminando..." : "Eliminar"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
