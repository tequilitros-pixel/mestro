"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  copyWorkforcePreviousWeekAction,
  deleteWorkforceShiftAction,
  ensureWorkforceSchedulePeriodAction,
  publishWorkforceScheduleAction,
  saveWorkforceCoverageAction,
  saveWorkforceShiftAction,
} from "@/app/actions/workforceScheduling";
import {
  canCopyPreviousWeek,
  canPublishSchedule,
  scheduleWarningLabel,
} from "@/lib/workforce/scheduling/presentation";

type Shift = { id: string; periodId: string; employmentId: string | null; employeeName: string | null; date: string; start: string; end: string; breakMinutes: number; version: number; cancelled: boolean; warnings: string[]; revisions: { id: string; reason: string; by: string; at: string }[] };
export type ScheduleViewModel = {
  branchId: string; branches: { id: string; name: string }[]; weekStart: string; weekEnd: string; selectedDay: string;
  timezone: string; threshold: number; notice: string | null; error: string | null;
  period: { id: string; published: boolean; lastPublishedAt: string | null } | null;
  employments: { id: string; name: string; hours: number }[]; shifts: Shift[];
  availability: { key: string; state: "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN"; startTime: string | null; endTime: string | null }[];
  coverage: { id: string; date: string; start: string; end: string; required: number; scheduled: number; gap: number; status: string }[];
  blockers: string[]; warningCount: number;
  previousWeek: { weekStart: string; shifts: { id: string; employeeName: string; dayOffset: number; start: string; end: string }[] };
};

const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const field = "w-full rounded-xl border border-outline-variant bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const primary = "inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45";
const secondary = "inline-flex min-h-10 items-center justify-center rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm font-semibold transition-colors hover:bg-surface-container";

function addDays(value: string, days: number) { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function currentWeekStart() { const now = new Date(); const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); utc.setUTCDate(utc.getUTCDate() - ((utc.getUTCDay() + 6) % 7)); return utc.toISOString().slice(0, 10); }
function href(branch: string, week: string, day = week) { return `/administration/workforce/schedule?branch=${encodeURIComponent(branch)}&week=${week}&day=${day}`; }
function dateLabel(value: string, options?: Intl.DateTimeFormatOptions) { return new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", ...options }).format(new Date(`${value}T12:00:00Z`)); }
function Icon({ name }: { name: "left" | "right" | "plus" | "copy" | "publish" | "close" | "more" }) {
  const paths = { left: "M15 18l-6-6 6-6", right: "M9 18l6-6-6-6", plus: "M12 5v14M5 12h14", copy: "M8 8h11v11H8zM5 16V5h11", publish: "M12 16V4m0 0L7 9m5-5 5 5M5 15v4h14v-4", close: "M6 6l12 12M18 6L6 18", more: "M5 12h.01M12 12h.01M19 12h.01" };
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}

export function ScheduleExperience({ model }: { model: ScheduleViewModel }) {
  const dates = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(model.weekStart, index)), [model.weekStart]);
  const [selectedDay, setSelectedDay] = useState(dates.includes(model.selectedDay) ? model.selectedDay : model.weekStart);
  const [editor, setEditor] = useState<{ shift?: Shift; employmentId: string; date: string; duplicate?: boolean } | null>(null);
  const [confirm, setConfirm] = useState<"copy" | "publish" | null>(null);
  const [emptyEmployeeHelp, setEmptyEmployeeHelp] = useState(false);
  const [setupHelp, setSetupHelp] = useState(false);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const availability = useMemo(() => new Map(model.availability.map((item) => [item.key, item])), [model.availability]);
  const activeShifts = model.shifts.filter((shift) => !shift.cancelled);
  const unassigned = activeShifts.filter((shift) => !shift.employmentId);
  const target = href(model.branchId, model.weekStart, selectedDay);

  function openNew(employmentId: string | null, date: string) { if (model.period) setEditor({ employmentId: employmentId ?? "", date }); }
  function openEdit(shift: Shift) { setEditor({ shift, employmentId: shift.employmentId ?? "", date: shift.date }); }
  function openGlobalNew() {
    if (!model.employments.length) setEmptyEmployeeHelp(true);
    else if (!model.period) setSetupHelp(true);
    else openNew(null, selectedDay);
  }
  const actionableBlockers = model.blockers.filter((blocker) => blocker !== "NO_SHIFTS");

  return <section className="mx-auto max-w-[1600px] space-y-4 pb-24 lg:pb-8">
    {(model.notice || model.error) && <div role={model.error ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${model.error ? "border-error/30 bg-error/10 text-error" : "border-primary/30 bg-primary/10"}`}>{model.error ?? model.notice}</div>}

    <header className="sticky top-0 z-20 -mx-2 border-b border-outline-variant bg-surface/95 px-2 py-3 backdrop-blur lg:static lg:mx-0 lg:rounded-2xl lg:border lg:px-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-48">
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Programar horarios</h1>
          <p className="text-sm text-on-surface-variant">{dateLabel(model.weekStart, { day: "numeric", month: "short" })} – {dateLabel(model.weekEnd, { day: "numeric", month: "short", year: "numeric" })}</p>
        </div>
        <a aria-label="Semana anterior" className={secondary} href={href(model.branchId, addDays(model.weekStart, -7))}><Icon name="left" /></a>
        <a className={`${secondary} hidden sm:inline-flex`} href={href(model.branchId, currentWeekStart())}>Esta semana</a>
        <a aria-label="Semana siguiente" className={secondary} href={href(model.branchId, addDays(model.weekStart, 7))}><Icon name="right" /></a>
        <form className="contents">
          <input type="hidden" name="week" value={model.weekStart} />
          <select aria-label="Sucursal" name="branch" defaultValue={model.branchId} onChange={(event) => event.currentTarget.form?.requestSubmit()} className={`${field} w-auto min-w-40`}>
            {model.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </form>
        <button className={primary} onClick={openGlobalNew}><Icon name="plus" /><span className="ml-2">Nuevo turno</span></button>
        {model.period && <>
          <button className={`${secondary} hidden md:inline-flex`} onClick={() => setConfirm("copy")} disabled={!canCopyPreviousWeek({ published: model.period.published, currentShiftCount: activeShifts.length, previousShiftCount: model.previousWeek.shifts.length })}><Icon name="copy" /><span className="ml-2">Copiar semana anterior</span></button>
          <button title={!activeShifts.length ? "Agrega al menos un turno antes de publicar." : undefined} className={primary} onClick={() => setConfirm("publish")} disabled={!canPublishSchedule({ published: model.period.published, blockers: model.blockers, shiftCount: activeShifts.length })}><Icon name="publish" /><span className="ml-2">{model.period.published ? "Horario publicado" : "Publicar horario"}</span></button>
        </>}
      </div>
      {model.period && !activeShifts.length && <p className="mt-2 text-xs font-medium text-on-surface-variant">Agrega al menos un turno antes de publicar.</p>}
      {model.period?.published && <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">El equipo ya puede consultar este horario{model.period.lastPublishedAt ? ` · publicado ${dateLabel(model.period.lastPublishedAt.slice(0,10), { day: "numeric", month: "short" })}` : ""}.</p>}
    </header>

    {!model.period ? (model.employments.length ? <EmptyWeek model={model} target={target} /> : <EmptyEmployees model={model} />) : <>
      <nav aria-label="Días de la semana" className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
        {dates.map((date, index) => <button key={date} onClick={() => setSelectedDay(date)} aria-current={selectedDay === date ? "date" : undefined} className={`min-w-[64px] rounded-xl border px-3 py-2 text-center text-xs font-bold ${selectedDay === date ? "border-primary bg-primary text-on-primary" : "border-outline-variant bg-surface"}`}>{dayNames[index]}<span className="block text-lg">{new Date(`${date}T00:00:00Z`).getUTCDate()}</span></button>)}
      </nav>
      {canCopyPreviousWeek({ published: model.period.published, currentShiftCount: activeShifts.length, previousShiftCount: model.previousWeek.shifts.length }) && <button className={`${secondary} w-full md:hidden`} onClick={() => setConfirm("copy")}><Icon name="copy" /><span className="ml-2">Copiar {model.previousWeek.shifts.length} turnos de la semana anterior</span></button>}

      {!model.employments.length ? <EmptyEmployees model={model} /> : <div className="hidden overflow-auto rounded-2xl border border-outline-variant bg-surface shadow-sm lg:block">
        <div className="min-w-[1120px]">
          <div className="sticky top-0 z-10 grid grid-cols-[15rem_repeat(7,minmax(7.5rem,1fr))] border-b border-outline-variant bg-surface-container-low text-xs font-bold">
            <div className="sticky left-0 z-20 bg-surface-container-low p-3">Equipo <span className="font-normal text-on-surface-variant">· horas semanales</span></div>
            {dates.map((date, index) => <div key={date} className="border-l border-outline-variant p-3">{dayNames[index]} <span className="text-on-surface-variant">{dateLabel(date, { day: "numeric", month: "short" })}</span></div>)}
          </div>
          {model.employments.map((employee) => <div key={employee.id} className="grid grid-cols-[15rem_repeat(7,minmax(7.5rem,1fr))] border-b border-outline-variant last:border-b-0">
            <div className="sticky left-0 z-[5] bg-surface p-3"><p className="truncate font-semibold">{employee.name}</p><p className={`text-xs ${employee.hours > model.threshold ? "font-bold text-error" : "text-on-surface-variant"}`}>{employee.hours.toFixed(1)} h esta semana</p><button type="button" onClick={() => openNew(employee.id, selectedDay)} className="mt-2 text-xs font-bold text-primary">+ Turno</button></div>
            {dates.map((date) => { const cellShifts = activeShifts.filter((shift) => shift.employmentId === employee.id && shift.date === date); const available = availability.get(`${employee.id}|${date}`); return <div key={date} onClick={() => openNew(employee.id, date)} className={`group min-h-24 cursor-pointer border-l border-outline-variant p-2 text-left transition-colors hover:bg-primary/5 ${available?.state === "UNAVAILABLE" ? "bg-error/[0.035]" : ""}`}>
              <div className="space-y-1.5">{cellShifts.map((shift) => <ShiftPill key={shift.id} shift={shift} onOpen={(event) => { event.stopPropagation(); openEdit(shift); }} />)}</div>
              {!cellShifts.length && available?.state === "UNAVAILABLE" && <span className="text-[11px] text-on-surface-variant">No disponible</span>}
              {!cellShifts.length && available?.state === "AVAILABLE" && available.startTime && <span className="text-[11px] text-on-surface-variant">Disponible {available.startTime}–{available.endTime}</span>}
              <button type="button" onClick={(event) => { event.stopPropagation(); openNew(employee.id, date); }} className="mt-2 w-full rounded-lg border border-primary/25 bg-primary/5 px-2 py-1.5 text-[11px] font-bold text-primary">+ Agregar turno</button>
            </div>; })}
          </div>)}
        </div>
      </div>}

      {model.employments.length > 0 && <div className="space-y-3 lg:hidden">
        <div className="flex items-center justify-between"><div><h2 className="font-bold">{dateLabel(selectedDay, { weekday: "long", day: "numeric", month: "long" })}</h2><p className="text-xs text-on-surface-variant">{activeShifts.filter((shift) => shift.date === selectedDay).length} turnos programados</p></div><button className={primary} onClick={() => openNew(null, selectedDay)}><Icon name="plus" /><span className="ml-1">Turno</span></button></div>
        {model.employments.map((employee) => { const employeeShifts = activeShifts.filter((shift) => shift.date === selectedDay && shift.employmentId === employee.id); const available = availability.get(`${employee.id}|${selectedDay}`); return <article key={employee.id} className="rounded-2xl border border-outline-variant bg-surface p-4">
          <button className="flex w-full items-start justify-between text-left" onClick={() => openNew(employee.id, selectedDay)}><span><strong>{employee.name}</strong><span className="block text-xs text-on-surface-variant">{employee.hours.toFixed(1)} h esta semana</span></span><Icon name="plus" /></button>
          <div className="mt-3 space-y-2">{employeeShifts.map((shift) => <ShiftPill key={shift.id} shift={shift} onOpen={() => openEdit(shift)} />)}{!employeeShifts.length && <p className="text-sm text-on-surface-variant">{available?.state === "UNAVAILABLE" ? "No está disponible este día" : "Sin turno"}</p>}<button type="button" onClick={() => openNew(employee.id, selectedDay)} className={`${secondary} w-full`}>+ Agregar turno</button></div>
        </article>; })}
      </div>}

      {unassigned.length > 0 && <details className="rounded-2xl border border-amber-300/60 bg-amber-50/50 p-4 dark:bg-amber-950/20"><summary className="cursor-pointer font-bold">{unassigned.length} {unassigned.length === 1 ? "turno necesita" : "turnos necesitan"} asignación</summary><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{unassigned.map((shift) => <ShiftPill key={shift.id} shift={shift} onOpen={() => openEdit(shift)} />)}</div></details>}
      {(model.warningCount > 0 || actionableBlockers.length > 0) && <aside className="rounded-2xl border border-outline-variant bg-surface p-4"><h2 className="font-bold">Antes de publicar</h2><p className="mt-1 text-sm text-on-surface-variant">{actionableBlockers.length ? `${actionableBlockers.length} cambios impiden publicar. Abre los turnos marcados para corregirlos.` : `${model.warningCount} detalles merecen revisión, pero puedes publicar cuando estés listo.`}</p></aside>}

      <section className="rounded-2xl border border-outline-variant bg-surface"><button className="flex w-full items-center justify-between p-4 text-left font-bold" onClick={() => setCoverageOpen(!coverageOpen)} aria-expanded={coverageOpen}>Cobertura del equipo <span className="text-sm font-normal text-on-surface-variant">{coverageOpen ? "Ocultar" : "Revisar"}</span></button>{coverageOpen && <Coverage model={model} target={target} />}</section>
    </>}

    {editor && model.period && <ShiftDialog editor={editor} model={model} target={target} onClose={() => setEditor(null)} onDuplicate={(shift) => setEditor({ shift, employmentId: shift.employmentId ?? "", date: shift.date, duplicate: true })} />}
    {emptyEmployeeHelp && <NoEmployeesDialog model={model} onClose={() => setEmptyEmployeeHelp(false)} />}
    {setupHelp && <SetupWeekDialog model={model} target={target} onClose={() => setSetupHelp(false)} />}
    {confirm && model.period && <ConfirmDialog kind={confirm} model={model} target={target} onClose={() => setConfirm(null)} />}
  </section>;
}

function EmptyEmployees({ model }: { model: ScheduleViewModel }) {
  const branch = model.branches.find((item) => item.id === model.branchId)?.name ?? "esta sucursal";
  return <div className="rounded-2xl border border-dashed border-outline-variant bg-surface p-8 text-center"><h2 className="text-lg font-bold">No hay empleados disponibles para programar</h2><p className="mx-auto mt-2 max-w-lg text-sm text-on-surface-variant">{branch} todavía no tiene empleados activos asignados. Agrega una asignación HOME o ALLOWED desde Empleados, o cambia de sucursal.</p><a href="/administration/workforce" className={`${primary} mt-5`}>Administrar empleados</a></div>;
}

function ShiftPill({ shift, onOpen }: { shift: Shift; onOpen: (event: React.MouseEvent<HTMLButtonElement>) => void }) {
  return <button type="button" onClick={onOpen} className={`block w-full rounded-lg border px-2.5 py-2 text-left text-xs transition-colors hover:border-primary ${shift.warnings.length ? "border-amber-400 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100" : "border-primary/25 bg-primary/10"}`}><span className="flex items-center justify-between gap-1"><strong>{shift.start}–{shift.end}</strong><Icon name="more" /></span>{!shift.employmentId && <span className="block">Sin asignar</span>}{shift.warnings[0] && <span className="mt-1 block opacity-80">{scheduleWarningLabel(shift.warnings[0])}</span>}</button>;
}

function EmptyWeek({ model, target }: { model: ScheduleViewModel; target: string }) {
  return <div className="rounded-2xl border border-dashed border-outline-variant bg-surface p-8 text-center"><div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary"><Icon name="plus" /></div><h2 className="text-lg font-bold">Comienza el horario de esta semana</h2><p className="mx-auto mt-1 max-w-md text-sm text-on-surface-variant">Prepara la semana y agrega turnos directamente desde cada persona y día.</p><form action={ensureWorkforceSchedulePeriodAction} className="mt-5"><input type="hidden" name="branchId" value={model.branchId} /><input type="hidden" name="weekStart" value={model.weekStart} /><input type="hidden" name="returnTo" value={target} /><button className={primary}>Preparar semana</button></form></div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; ref.current?.focus(); const listener = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); if (event.key === "Tab" && ref.current) { const focusable = Array.from(ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])')); if (!focusable.length) return; const first = focusable[0], last = focusable[focusable.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } }; document.addEventListener("keydown", listener); document.body.style.overflow = "hidden"; return () => { document.removeEventListener("keydown", listener); document.body.style.overflow = ""; previous?.focus(); }; }, [onClose]);
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="schedule-dialog-title" className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl outline-none motion-safe:animate-[dialog-in_160ms_ease-out] sm:max-w-lg sm:rounded-3xl"><div className="mb-5 flex items-center justify-between"><h2 id="schedule-dialog-title" className="text-xl font-bold">{title}</h2><button aria-label="Cerrar" className={secondary} onClick={onClose}><Icon name="close" /></button></div>{children}</div></div>;
}

function NoEmployeesDialog({ model, onClose }: { model: ScheduleViewModel; onClose: () => void }) {
  const branch = model.branches.find((item) => item.id === model.branchId)?.name ?? "esta sucursal";
  return <Modal title="Primero necesitas un empleado" onClose={onClose}><p className="text-sm text-on-surface-variant">No hay empleados activos asignados a {branch}. Asigna una sucursal desde Empleados antes de crear un turno.</p><div className="mt-5 flex gap-2"><button type="button" className={`${secondary} flex-1`} onClick={onClose}>Cancelar</button><a href="/administration/workforce" className={`${primary} flex-1`}>Ir a Empleados</a></div></Modal>;
}

function SetupWeekDialog({ model, target, onClose }: { model: ScheduleViewModel; target: string; onClose: () => void }) {
  return <Modal title="Nuevo turno" onClose={onClose}><p className="text-sm text-on-surface-variant">Primero prepara la semana. Después podrás seleccionar empleado, fecha, horario y descanso.</p><form action={ensureWorkforceSchedulePeriodAction} onSubmit={onClose} className="mt-5"><input type="hidden" name="branchId" value={model.branchId} /><input type="hidden" name="weekStart" value={model.weekStart} /><input type="hidden" name="returnTo" value={target} /><button className={`${primary} w-full`}>Preparar semana</button></form></Modal>;
}

function ShiftDialog({ editor, model, target, onClose, onDuplicate }: { editor: { shift?: Shift; employmentId: string; date: string; duplicate?: boolean }; model: ScheduleViewModel; target: string; onClose: () => void; onDuplicate: (shift: Shift) => void }) {
  const shift = editor.shift; const isEdit = Boolean(shift && !editor.duplicate); const postPublish = model.period?.published;
  return <Modal title={isEdit ? "Editar turno" : editor.duplicate ? "Duplicar turno" : "Nuevo turno"} onClose={onClose}><form action={saveWorkforceShiftAction} onSubmit={onClose} className="space-y-4">
    <input type="hidden" name="periodId" value={model.period!.id} />{isEdit && <><input type="hidden" name="shiftId" value={shift!.id} /><input type="hidden" name="expectedVersion" value={shift!.version} /></>}<input type="hidden" name="returnTo" value={target} />
    <label className="block text-sm font-semibold">Empleado<select name="employmentId" defaultValue={editor.employmentId} className={`${field} mt-1`}><option value="">Sin asignar</option>{model.employments.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
    <label className="block text-sm font-semibold">Fecha<input required name="businessDate" type="date" min={model.weekStart} max={model.weekEnd} defaultValue={editor.date} className={`${field} mt-1`} /></label>
    <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Hora de entrada<input required name="startTime" type="time" defaultValue={shift?.start ?? "09:00"} className={`${field} mt-1`} /></label><label className="text-sm font-semibold">Hora de salida<input required name="endTime" type="time" defaultValue={shift?.end ?? "17:00"} className={`${field} mt-1`} /></label></div>
    <label className="block text-sm font-semibold">Descanso<input name="expectedBreakMinutes" type="number" min="0" max="480" defaultValue={shift?.breakMinutes ?? 30} className={`${field} mt-1`} /><span className="mt-1 block text-xs font-normal text-on-surface-variant">Minutos</span></label>
    {postPublish && <label className="block text-sm font-semibold">Motivo del cambio<input required name="reason" maxLength={200} placeholder="Ej. cambio solicitado por la persona" className={`${field} mt-1`} /><span className="mt-1 block text-xs font-normal text-on-surface-variant">El horario ya fue compartido; este motivo quedará en el historial.</span></label>}
    {shift?.warnings.length ? <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">{shift.warnings.map((warning) => <p key={warning}>{scheduleWarningLabel(warning)}</p>)}</div> : null}
    <div className="flex gap-2"><button type="button" className={`${secondary} flex-1`} onClick={onClose}>Cancelar</button><button className={`${primary} flex-1`}>{isEdit ? "Guardar cambios" : "Guardar turno"}</button></div>
  </form>
  {isEdit && <div className="mt-3 grid grid-cols-2 gap-2"><button className={secondary} onClick={() => onDuplicate(shift!)}><Icon name="copy" /><span className="ml-2">Duplicar</span></button><form action={deleteWorkforceShiftAction} onSubmit={onClose}><input type="hidden" name="shiftId" value={shift!.id} /><input type="hidden" name="expectedVersion" value={shift!.version} /><input type="hidden" name="returnTo" value={target} />{postPublish && <input required name="reason" aria-label="Motivo para retirar" placeholder="Motivo para retirar" className={`${field} mb-2`} />}<button className="min-h-10 w-full rounded-xl border border-error/30 px-3 py-2 text-sm font-bold text-error">{postPublish ? "Retirar turno" : "Eliminar"}</button></form></div>}
  {shift && shift.revisions.length > 0 && <details className="mt-5 border-t border-outline-variant pt-4 text-sm"><summary className="cursor-pointer font-semibold">Historial de cambios</summary><div className="mt-2 space-y-2 text-on-surface-variant">{shift.revisions.map((revision) => <p key={revision.id}>{revision.reason} · {revision.by}</p>)}</div></details>}
  </Modal>;
}

function ConfirmDialog({ kind, model, target, onClose }: { kind: "copy" | "publish"; model: ScheduleViewModel; target: string; onClose: () => void }) {
  const publish = kind === "publish"; const action = publish ? publishWorkforceScheduleAction : copyWorkforcePreviousWeekAction;
  return <Modal title={publish ? "Compartir horario con el equipo" : "Copiar semana anterior"} onClose={onClose}><p className="text-sm text-on-surface-variant">{publish ? `Se compartirán ${model.shifts.filter((shift) => !shift.cancelled).length} turnos. Las personas podrán consultarlos inmediatamente.` : `Encontramos ${model.previousWeek.shifts.length} turnos de la semana anterior. Podrás ajustarlos antes de compartirlos.`}</p>{!publish && model.previousWeek.shifts.length > 0 && <div className="mt-4 max-h-52 space-y-2 overflow-y-auto rounded-xl bg-surface-container p-3">{model.previousWeek.shifts.slice(0, 12).map((shift) => <p key={shift.id} className="flex justify-between gap-3 text-sm"><span className="truncate">{dayNames[shift.dayOffset]} · {shift.employeeName}</span><strong className="shrink-0">{shift.start}–{shift.end}</strong></p>)}{model.previousWeek.shifts.length > 12 && <p className="text-xs text-on-surface-variant">Y {model.previousWeek.shifts.length - 12} turnos más</p>}</div>}{model.warningCount > 0 && publish && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">Hay {model.warningCount} detalles para revisar. No impiden compartir el horario.</p>}<form action={action} onSubmit={onClose} className="mt-5 flex gap-2"><input type="hidden" name="periodId" value={model.period!.id} /><input type="hidden" name="returnTo" value={target} /><button type="button" className={`${secondary} flex-1`} onClick={onClose}>Volver</button><button disabled={!publish && model.previousWeek.shifts.length === 0} className={`${primary} flex-1`}>{publish ? "Compartir ahora" : "Copiar turnos"}</button></form></Modal>;
}

function Coverage({ model, target }: { model: ScheduleViewModel; target: string }) {
  return <div className="border-t border-outline-variant p-4"><form action={saveWorkforceCoverageAction} className="grid gap-2 sm:grid-cols-5"><input type="hidden" name="branchId" value={model.branchId} /><input type="hidden" name="returnTo" value={target} /><input aria-label="Día de cobertura" required name="businessDate" type="date" min={model.weekStart} max={model.weekEnd} defaultValue={model.selectedDay} className={field} /><input aria-label="Desde" required name="startTime" type="time" defaultValue="18:00" className={field} /><input aria-label="Hasta" required name="endTime" type="time" defaultValue="23:00" className={field} /><input aria-label="Personas necesarias" required name="requiredCount" type="number" min="1" defaultValue="1" className={field} /><button className={secondary}>Guardar necesidad</button></form><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{model.coverage.length ? model.coverage.map((item) => <div key={item.id} className="rounded-xl bg-surface-container p-3 text-sm"><strong>{dateLabel(item.date, { weekday: "short", day: "numeric" })} · {item.start}–{item.end}</strong><p className="text-on-surface-variant">{item.scheduled} de {item.required} personas · {item.gap > 0 ? `faltan ${item.gap}` : "cobertura completa"}</p></div>) : <p className="text-sm text-on-surface-variant">Aún no hay necesidades de cobertura definidas.</p>}</div></div>;
}
