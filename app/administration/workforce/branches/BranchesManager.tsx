"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createWorkforceBranchAction,
  reviewGeolocationEvidenceAction,
  saveWorkforceScheduleTemplateAction,
  updateBranchGeofenceAction,
  updateWorkforceBranchAction,
} from "@/app/actions/workforceBranches";
import { useToast } from "@/components/ui/Toast";
import { MapPinIcon, PlusIcon, UsersIcon, ClockIcon } from "@/components/ui/icons";

type Template = { id: string; name: string; branchId: string | null; active: boolean; shifts: { id: string; dayOfWeek: number; startTime: string | null; endTime: string | null; breakMinutes: number }[] };
type Branch = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  active: boolean;
  color: string | null;
  timezone: string | null;
  geofenceEnabled: boolean;
  templateApplyMode: "ASK_BEFORE_APPLY" | "AUTO_CREATE_DRAFT" | "DO_NOT_APPLY";
  defaultScheduleTemplateId: string | null;
  defaultScheduleTemplate: { id: string; name: string; active: boolean } | null;
  geofence: { id: string; name: string; latitude: number; longitude: number; radius: number } | null;
  workforceAssignments: { type: "HOME" | "ALLOWED"; employment: { id: string; employee: { id: string; displayName: string | null; active: boolean } } }[];
  _count: { workforceClockEvents: number; workforceShifts: number };
};
type Settings = {
  requireGeolocationClockIn: boolean;
  requireGeolocationClockOut: boolean;
  geofenceOutsideBehavior: "BLOCK" | "ALLOW_WITH_EXCEPTION";
  requireOutsideGeofenceReview: boolean;
  maximumGpsAccuracyMeters: number;
};
type Evidence = {
  id: string;
  result: string;
  distanceMeters: number | null;
  accuracyMeters: number | null;
  checkedAt: Date | string;
  clockEvent: { type: "CLOCK_IN" | "BREAK_START" | "BREAK_END" | "CLOCK_OUT"; employment: { employee: { displayName: string | null } }; branch: { name: string } } | null;
};

const fieldClass = "h-10 w-full rounded-lg border border-outline-variant bg-background px-3 text-sm text-on-surface outline-none focus:border-primary";

export default function BranchesManager({
  initialBranches,
  templates,
  initialSettings,
  initialPendingEvidence,
}: {
  initialBranches: Branch[];
  templates: Template[];
  initialSettings: Settings;
  initialPendingEvidence: Evidence[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [selected, setSelected] = useState<Branch | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh(message: string) {
    showToast(message);
    setSelected(null);
    setCreating(false);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-outline-variant pb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Workforce</p>
          <h1 className="mt-1 text-2xl font-bold">Sucursales</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Ubicación, personal, horario predeterminado y geozona.</p>
        </div>
        <button onClick={() => setCreating(true)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-bold text-on-primary">
          <PlusIcon className="h-4 w-4" /> Nueva sucursal
        </button>
      </header>

      {error && <div className="rounded-lg border border-error/40 bg-error/10 p-3 text-sm text-error">{error}</div>}

      <section className="overflow-hidden rounded-lg border border-outline-variant">
        <div className="hidden grid-cols-[1.5fr_100px_120px_1fr_120px] gap-3 border-b border-outline-variant bg-surface-container-high px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant md:grid">
          <span>Sucursal</span><span>Estado</span><span>Empleados</span><span>Configuración</span><span />
        </div>
        {initialBranches.map((branch) => (
          <div key={branch.id} className="grid gap-3 border-b border-outline-variant bg-surface-container px-4 py-3 last:border-b-0 md:grid-cols-[1.5fr_100px_120px_1fr_120px] md:items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: branch.color ?? "#8e8e93" }} />
                <strong className="text-sm">{branch.name}</strong>
                <span className="font-mono text-[10px] text-on-surface-variant">{branch.code}</span>
              </div>
              <p className="mt-1 truncate text-xs text-on-surface-variant">{branch.address || "Sin dirección"} · {branch.timezone}</p>
            </div>
            <span className={branch.active ? "text-xs font-semibold text-tertiary" : "text-xs font-semibold text-outline"}>{branch.active ? "Activa" : "Inactiva"}</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-on-surface-variant"><UsersIcon className="h-3.5 w-3.5" /> {branch.workforceAssignments.filter((item) => item.employment.employee.active).length}</span>
            <div className="space-y-1 text-xs text-on-surface-variant">
              <p><MapPinIcon className="mr-1 inline h-3.5 w-3.5" />{branch.geofenceEnabled && branch.geofence ? `Geozona ${branch.geofence.radius} m` : "Geozona desactivada"}</p>
              <p><ClockIcon className="mr-1 inline h-3.5 w-3.5" />{branch.defaultScheduleTemplate?.name ?? "Sin plantilla predeterminada"}</p>
            </div>
            <button onClick={() => setSelected(branch)} className="h-8 rounded-md border border-outline-variant px-3 text-xs font-semibold hover:border-outline">Configurar</button>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-outline-variant bg-surface-container p-4">
          <h2 className="text-base font-bold">Clock / ubicación</h2>
          <p className="mt-1 text-xs text-on-surface-variant">La ubicación se solicita sólo al checar; nunca se rastrea continuamente.</p>
          <div className="mt-4 space-y-2 text-sm"><p>Entrada: <strong>{initialSettings.requireGeolocationClockIn ? "requerida" : "opcional"}</strong></p><p>Salida: <strong>{initialSettings.requireGeolocationClockOut ? "requerida" : "opcional"}</strong></p><p>Fuera de geozona: <strong>{initialSettings.geofenceOutsideBehavior === "BLOCK" ? "bloquear" : "permitir con excepción"}</strong></p><p>Precisión máxima: <strong>{initialSettings.maximumGpsAccuracyMeters} m</strong></p><a href="/administration/workforce/settings" className="inline-flex h-9 items-center rounded-lg border border-outline-variant px-3 text-sm font-bold text-primary">Editar política versionada</a></div>
        </div>

        <div className="rounded-lg border border-outline-variant bg-surface-container p-4">
          <h2 className="text-base font-bold">Excepciones pendientes</h2>
          <div className="mt-3 space-y-2">
            {initialPendingEvidence.length === 0 && <p className="text-sm text-on-surface-variant">No hay excepciones por revisar.</p>}
            {initialPendingEvidence.filter((evidence) => evidence.clockEvent).map((evidence) => (
              <div key={evidence.id} className="rounded-md border border-outline-variant bg-background p-3 text-xs">
                <div className="flex flex-wrap justify-between gap-2"><strong>{evidence.clockEvent?.employment.employee.displayName ?? "Empleado"}</strong><span className="text-on-surface-variant">{new Date(evidence.checkedAt).toLocaleString("es-MX")}</span></div>
                <p className="mt-1 text-on-surface-variant">{evidence.clockEvent?.type === "CLOCK_IN" ? "Entrada" : "Salida"} · {evidence.clockEvent?.branch.name} · {evidence.result}{evidence.distanceMeters !== null ? ` · ${evidence.distanceMeters} m` : ""}</p>
                <div className="mt-2 flex gap-2"><ReviewButton evidenceId={evidence.id} decision="APPROVED" onDone={() => router.refresh()} /><ReviewButton evidenceId={evidence.id} decision="REJECTED" onDone={() => router.refresh()} /></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {(creating || selected) && (
        <BranchPanel
          branch={selected}
          templates={templates}
          onClose={() => { setCreating(false); setSelected(null); }}
          onSaved={refresh}
          onError={setError}
          onRefresh={() => router.refresh()}
        />
      )}
    </div>
  );
}

function ReviewButton({ evidenceId, decision, onDone }: { evidenceId: string; decision: "APPROVED" | "REJECTED"; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  return <button disabled={busy} onClick={async () => { setBusy(true); const result = await reviewGeolocationEvidenceAction(evidenceId, decision); setBusy(false); if (!result.error) onDone(); }} className="rounded border border-outline-variant px-2 py-1 disabled:opacity-60">{decision === "APPROVED" ? "Aprobar" : "Rechazar"}</button>;
}

function BranchPanel({ branch, templates, onClose, onSaved, onError, onRefresh }: { branch: Branch | null; templates: Template[]; onClose: () => void; onSaved: (message: string) => void; onError: (message: string | null) => void; onRefresh: () => void }) {
  const [name, setName] = useState(branch?.name ?? "");
  const [code, setCode] = useState(branch?.code ?? "");
  const [address, setAddress] = useState(branch?.address ?? "");
  const [timezone, setTimezone] = useState(branch?.timezone ?? "America/Mexico_City");
  const [active, setActive] = useState(branch?.active ?? true);
  const [templateId, setTemplateId] = useState(branch?.defaultScheduleTemplateId ?? "");
  const [applyMode, setApplyMode] = useState(branch?.templateApplyMode ?? "ASK_BEFORE_APPLY");
  const [geoEnabled, setGeoEnabled] = useState(branch?.geofenceEnabled ?? false);
  const [latitude, setLatitude] = useState(branch?.geofence?.latitude.toString() ?? "");
  const [longitude, setLongitude] = useState(branch?.geofence?.longitude.toString() ?? "");
  const [radius, setRadius] = useState(branch?.geofence?.radius.toString() ?? "100");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); onError(null);
    const result = branch
      ? await updateWorkforceBranchAction({ branchId: branch.id, name, code, address, timezone, active, templateApplyMode: applyMode, defaultScheduleTemplateId: templateId || null })
      : await createWorkforceBranchAction({ name, code, address, timezone });
    if (result.error) { setBusy(false); onError(result.error); return; }
    if (branch && (!geoEnabled || (latitude && longitude))) {
      const geo = await updateBranchGeofenceAction({ branchId: branch.id, enabled: geoEnabled, latitude: Number(latitude), longitude: Number(longitude), radius: Number(radius) });
      if (geo.error) { setBusy(false); onError(geo.error); return; }
    }
    setBusy(false); onSaved(branch ? "Sucursal actualizada." : "Sucursal creada.");
  }

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-surface-dim/70" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-outline-variant bg-surface-container p-5" role="dialog" aria-modal="true">
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{branch ? branch.name : "Nueva sucursal"}</h2><button onClick={onClose} aria-label="Cerrar" className="p-2 text-xl leading-none">×</button></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Nombre"><input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Código"><input className={fieldClass} value={code} onChange={(e) => setCode(e.target.value)} /></Field>
          <div className="sm:col-span-2"><Field label="Dirección"><input className={fieldClass} value={address} onChange={(e) => setAddress(e.target.value)} /></Field></div>
          <Field label="Timezone IANA"><input className={fieldClass} value={timezone} onChange={(e) => setTimezone(e.target.value)} /></Field>
          {branch && <Field label="Estado"><select className={fieldClass} value={active ? "active" : "inactive"} onChange={(e) => setActive(e.target.value === "active")}><option value="active">Activa</option><option value="inactive">Inactiva</option></select></Field>}
        </div>

        {branch && <>
          <section className="mt-6 border-t border-outline-variant pt-5"><h3 className="font-bold">Horario predeterminado</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Plantilla"><select className={fieldClass} value={templateId} onChange={(e) => setTemplateId(e.target.value)}><option value="">Sin plantilla</option>{templates.filter((t) => !t.branchId || t.branchId === branch.id).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field><Field label="Al asignar empleado"><select className={fieldClass} value={applyMode} onChange={(e) => setApplyMode(e.target.value as Branch["templateApplyMode"])}><option value="ASK_BEFORE_APPLY">Preguntar antes</option><option value="AUTO_CREATE_DRAFT">Crear borrador</option><option value="DO_NOT_APPLY">No aplicar</option></select></Field></div></section>
          <section className="mt-6 border-t border-outline-variant pt-5"><h3 className="font-bold">Geozona</h3><p className="mt-1 text-xs text-on-surface-variant">El empleado debe estar aproximadamente dentro del radio al checar. El GPS puede variar.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="sm:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={geoEnabled} onChange={(e) => setGeoEnabled(e.target.checked)} /> Geozona activada</label><Field label="Latitud"><input className={fieldClass} inputMode="decimal" value={latitude} onChange={(e) => setLatitude(e.target.value)} /></Field><Field label="Longitud"><input className={fieldClass} inputMode="decimal" value={longitude} onChange={(e) => setLongitude(e.target.value)} /></Field><Field label="Radio (metros)"><input className={fieldClass} type="number" min="10" max="10000" value={radius} onChange={(e) => setRadius(e.target.value)} /></Field><div className="flex items-end gap-1">{[50, 100, 150, 200].map((value) => <button key={value} onClick={() => setRadius(String(value))} className="h-10 flex-1 rounded-lg border border-outline-variant text-xs">{value} m</button>)}</div></div></section>
          <TemplateEditor branch={branch} templates={templates.filter((item) => item.branchId === branch.id)} onError={onError} onSaved={onRefresh} />
          <section className="mt-6 border-t border-outline-variant pt-5"><h3 className="font-bold">Empleados asignados</h3><div className="mt-2 flex flex-wrap gap-2">{branch.workforceAssignments.length === 0 ? <span className="text-sm text-on-surface-variant">Sin empleados asignados.</span> : branch.workforceAssignments.map((item) => <span key={`${item.employment.id}-${item.type}`} className="rounded-full border border-outline-variant px-2.5 py-1 text-xs">{item.employment.employee.displayName ?? "Sin nombre"}{item.type === "HOME" ? " · principal" : ""}</span>)}</div></section>
        </>}
        <div className="mt-6 flex justify-end gap-2 border-t border-outline-variant pt-4"><button onClick={onClose} className="h-9 rounded-lg border border-outline-variant px-3 text-sm">Cancelar</button><button onClick={save} disabled={busy} className="h-9 rounded-lg bg-primary px-3 text-sm font-bold text-on-primary disabled:opacity-60">{busy ? "Guardando..." : "Guardar"}</button></div>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-on-surface-variant">{label}</span>{children}</label>;
}

const weekdayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function TemplateEditor({ branch, templates, onError, onSaved }: { branch: Branch; templates: Template[]; onError: (message: string | null) => void; onSaved: () => void }) {
  type Block = { dayOfWeek: number; startTime: string; endTime: string; breakMinutes: number };
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const selected = templates.find((item) => item.id === templateId);
  const [name, setName] = useState(selected?.name ?? "Horario normal");
  const [blocks, setBlocks] = useState<Block[]>(selected?.shifts.filter((item) => item.startTime && item.endTime).map((item) => ({ dayOfWeek: item.dayOfWeek, startTime: item.startTime!, endTime: item.endTime!, breakMinutes: item.breakMinutes })) ?? []);
  const [busy, setBusy] = useState(false);
  function choose(id: string) {
    setTemplateId(id);
    const template = templates.find((item) => item.id === id);
    setName(template?.name ?? "Horario normal");
    setBlocks(template?.shifts.filter((item) => item.startTime && item.endTime).map((item) => ({ dayOfWeek: item.dayOfWeek, startTime: item.startTime!, endTime: item.endTime!, breakMinutes: item.breakMinutes })) ?? []);
  }
  function update(index: number, patch: Partial<Block>) {
    setBlocks(blocks.map((block, current) => current === index ? { ...block, ...patch } : block));
  }
  async function save() {
    setBusy(true); onError(null);
    const result = await saveWorkforceScheduleTemplateAction({ templateId: templateId || undefined, branchId: branch.id, name, active: true, blocks });
    setBusy(false);
    if (result.error) return onError(result.error);
    onSaved();
  }
  return <section className="mt-6 border-t border-outline-variant pt-5">
    <div className="flex items-center justify-between gap-2"><div><h3 className="font-bold">Plantillas de horario</h3><p className="text-xs text-on-surface-variant">Patrones para crear turnos DRAFT; no modifican semanas existentes.</p></div><button type="button" onClick={() => choose("")} className="rounded-md border border-outline-variant px-2 py-1 text-xs">Nueva</button></div>
    {templates.length > 0 && <select aria-label="Plantilla a editar" className={`${fieldClass} mt-3`} value={templateId} onChange={(event) => choose(event.target.value)}><option value="">Nueva plantilla</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select>}
    <input aria-label="Nombre de plantilla" className={`${fieldClass} mt-2`} value={name} onChange={(event) => setName(event.target.value)} placeholder="Horario normal" />
    <div className="mt-3 space-y-2">{blocks.map((block, index) => <div key={`${block.dayOfWeek}-${index}`} className="grid grid-cols-[1fr_90px_90px_70px_auto] gap-1"><select aria-label="Día" className={fieldClass} value={block.dayOfWeek} onChange={(event) => update(index, { dayOfWeek: Number(event.target.value) })}>{weekdayNames.map((day, dayIndex) => <option key={day} value={dayIndex}>{day}</option>)}</select><input aria-label="Entrada" type="time" className={fieldClass} value={block.startTime} onChange={(event) => update(index, { startTime: event.target.value })} /><input aria-label="Salida" type="time" className={fieldClass} value={block.endTime} onChange={(event) => update(index, { endTime: event.target.value })} /><input aria-label="Descanso" type="number" min="0" max="720" className={fieldClass} value={block.breakMinutes} onChange={(event) => update(index, { breakMinutes: Number(event.target.value) })} /><button type="button" aria-label="Quitar bloque" onClick={() => setBlocks(blocks.filter((_, current) => current !== index))} className="px-2 text-error">×</button></div>)}</div>
    <div className="mt-3 flex gap-2"><button type="button" onClick={() => setBlocks([...blocks, { dayOfWeek: 0, startTime: "09:00", endTime: "17:00", breakMinutes: 30 }])} className="h-9 rounded-lg border border-outline-variant px-3 text-xs font-bold">Agregar bloque</button><button type="button" disabled={busy || !blocks.length} onClick={save} className="h-9 rounded-lg bg-primary px-3 text-xs font-bold text-on-primary disabled:opacity-50">{busy ? "Guardando..." : "Guardar plantilla"}</button></div>
  </section>;
}
