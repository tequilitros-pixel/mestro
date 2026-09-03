"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  copyWorkforcePreviousWeekGroupAction,
  deleteWorkforceShiftAction,
  publishWorkforceScheduleAction,
  saveWorkforceCoverageAction,
  saveWorkforceShiftAction,
} from "@/app/actions/workforceScheduling";
import { scheduleWarningLabel } from "@/lib/workforce/scheduling/presentation";

type Branch = { id: string; name: string; color: string | null; timezone: string | null };
type Shift = {
  id: string; periodId: string; branchId: string; branchName: string; branchColor: string | null;
  employmentId: string | null; employeeName: string | null; date: string; start: string; end: string;
  breakMinutes: number; version: number; cancelled: boolean; warnings: string[];
  revisions: { id: string; reason: string; by: string; at: string }[];
};
type Employment = {
  id: string; name: string; hours: number;
  assignments: { branchId: string; branchName: string; type: string }[];
};
export type ScheduleViewModel = {
  selectedBranchId: string | null;
  branches: Branch[];
  weekStart: string; weekEnd: string; selectedDay: string; threshold: number;
  notice: string | null; error: string | null;
  periods: { id: string; branchId: string; published: boolean; lastPublishedAt: string | null; shiftCount: number }[];
  employments: Employment[];
  shifts: Shift[];
  availability: { key: string; state: "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN"; startTime: string | null; endTime: string | null }[];
  coverage: { id: string; branchId: string; branchName: string; date: string; start: string; end: string; required: number; scheduled: number; gap: number; status: string }[];
  previousWeek: { weekStart: string; branches: { branchId: string; shifts: { id: string; employeeName: string; dayOffset: number; start: string; end: string }[] }[] };
};

const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const field = "w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const primary = "inline-flex min-h-9 items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-bold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";
const secondary = "inline-flex min-h-9 items-center justify-center rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm font-semibold transition hover:bg-surface-container";
const branchTones = [
  "border-sky-400/60 bg-sky-50 text-sky-950 dark:bg-sky-950/45 dark:text-sky-100",
  "border-violet-400/60 bg-violet-50 text-violet-950 dark:bg-violet-950/45 dark:text-violet-100",
  "border-emerald-400/60 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/45 dark:text-emerald-100",
  "border-orange-400/60 bg-orange-50 text-orange-950 dark:bg-orange-950/45 dark:text-orange-100",
  "border-rose-400/60 bg-rose-50 text-rose-950 dark:bg-rose-950/45 dark:text-rose-100",
  "border-cyan-400/60 bg-cyan-50 text-cyan-950 dark:bg-cyan-950/45 dark:text-cyan-100",
];

function addDays(value: string, days: number) { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function currentWeekStart() { const now = new Date(); const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); utc.setUTCDate(utc.getUTCDate() - ((utc.getUTCDay() + 6) % 7)); return utc.toISOString().slice(0, 10); }
function href(branch: string | null, week: string, day = week) { return `/administration/workforce/schedule?branch=${encodeURIComponent(branch ?? "all")}&week=${week}&day=${day}`; }
function dateLabel(value: string, options?: Intl.DateTimeFormatOptions) { return new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", ...options }).format(new Date(`${value}T12:00:00Z`)); }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?"; }
function minutes(start: string, end: string) { const [sh, sm] = start.split(":").map(Number), [eh, em] = end.split(":").map(Number); let value = eh * 60 + em - sh * 60 - sm; if (value <= 0) value += 1440; return value; }
function branchTone(branchId: string, branches: Branch[]) { const index = Math.max(0, branches.findIndex((branch) => branch.id === branchId)); return branchTones[index % branchTones.length]; }
function Icon({ name }: { name: "left" | "right" | "plus" | "copy" | "publish" | "close" | "more" | "search" }) {
  const paths = { left: "M15 18l-6-6 6-6", right: "M9 18l6-6-6-6", plus: "M12 5v14M5 12h14", copy: "M8 8h11v11H8zM5 16V5h11", publish: "M12 16V4m0 0L7 9m5-5 5 5M5 15v4h14v-4", close: "M6 6l12 12M18 6L6 18", more: "M5 12h.01M12 12h.01M19 12h.01", search: "m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" };
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}

export function ScheduleExperience({ model }: { model: ScheduleViewModel }) {
  const dates = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(model.weekStart, index)), [model.weekStart]);
  const [selectedDay, setSelectedDay] = useState(dates.includes(model.selectedDay) ? model.selectedDay : model.weekStart);
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<{ shift?: Shift; employmentId: string; branchId: string; date: string; duplicate?: boolean } | null>(null);
  const [confirm, setConfirm] = useState<"copy" | "publish" | null>(null);
  const availability = useMemo(() => new Map(model.availability.map((item) => [item.key, item])), [model.availability]);
  const activeShifts = model.shifts.filter((shift) => !shift.cancelled);
  const visibleShifts = activeShifts.filter((shift) => !model.selectedBranchId || shift.branchId === model.selectedBranchId);
  const normalizedSearch = search.trim().toLocaleLowerCase("es-MX");
  const visibleEmployments = model.employments.filter((employment) => {
    const matchesSearch = !normalizedSearch || employment.name.toLocaleLowerCase("es-MX").includes(normalizedSearch);
    const matchesBranch = !model.selectedBranchId || employment.assignments.some((assignment) => assignment.branchId === model.selectedBranchId) || visibleShifts.some((shift) => shift.employmentId === employment.id);
    return matchesSearch && matchesBranch;
  });
  const assigned = visibleEmployments.filter((employment) => employment.assignments.length > 0);
  const withoutBranch = visibleEmployments.filter((employment) => employment.assignments.length === 0);
  const unassignedShifts = visibleShifts.filter((shift) => !shift.employmentId);
  const periodByBranch = new Map(model.periods.map((period) => [period.branchId, period]));
  const target = href(model.selectedBranchId, model.weekStart, selectedDay);
  const defaultBranch = (employment?: Employment) => model.selectedBranchId ?? employment?.assignments.find((item) => item.type === "HOME")?.branchId ?? employment?.assignments[0]?.branchId ?? model.branches[0]?.id ?? "";
  const publishablePeriods = model.periods.filter((period) => period.shiftCount > 0 && !period.published && (!model.selectedBranchId || period.branchId === model.selectedBranchId));
  const previousBranches = model.previousWeek.branches.filter((item) => item.shifts.length > 0 && (!model.selectedBranchId || item.branchId === model.selectedBranchId));

  function openNew(employmentId: string | null, date: string) {
    const employee = model.employments.find((item) => item.id === employmentId);
    setEditor({ employmentId: employmentId ?? "", branchId: defaultBranch(employee), date });
  }
  function openEdit(shift: Shift) { setEditor({ shift, employmentId: shift.employmentId ?? "", branchId: shift.branchId, date: shift.date }); }
  const totalHours = visibleShifts.reduce((sum, shift) => sum + Math.max(0, minutes(shift.start, shift.end) - shift.breakMinutes), 0) / 60;
  const publicationLabel = model.selectedBranchId
    ? (periodByBranch.get(model.selectedBranchId)?.published ? "Publicado" : "Sin publicar")
    : model.periods.length && model.periods.every((period) => period.published) ? "Publicado" : model.periods.some((period) => period.published) ? "Publicación parcial" : "Sin publicar";

  return <section className="-mx-2 space-y-2 pb-20 lg:-mx-4 lg:pb-4">
    {(model.notice || model.error) && <div role={model.error ? "alert" : "status"} className={`mx-2 rounded-lg border px-3 py-2 text-sm font-semibold lg:mx-4 ${model.error ? "border-error/30 bg-error/10 text-error" : "border-primary/30 bg-primary/10"}`}>{model.error ?? model.notice}</div>}

    <header className="sticky top-0 z-30 border-y border-outline-variant bg-surface/95 px-2 py-2 shadow-sm backdrop-blur lg:px-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto flex items-center gap-3"><div><h1 className="text-lg font-bold tracking-tight">Horario</h1><p className="text-xs text-on-surface-variant">{dateLabel(model.weekStart, { day: "numeric", month: "short" })} – {dateLabel(model.weekEnd, { day: "numeric", month: "short", year: "numeric" })}</p></div><span className="rounded-full bg-surface-container px-2 py-1 text-[11px] font-bold text-on-surface-variant">{publicationLabel}</span></div>
        <form className="contents"><input type="hidden" name="week" value={model.weekStart} /><select aria-label="Sucursal" name="branch" defaultValue={model.selectedBranchId ?? "all"} onChange={(event) => event.currentTarget.form?.requestSubmit()} className={`${field} w-auto min-w-44`}><option value="all">Todas las sucursales</option>{model.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></form>
        <div className="flex items-center rounded-lg border border-outline-variant bg-surface"><a aria-label="Semana anterior" className="p-2 hover:bg-surface-container" href={href(model.selectedBranchId, addDays(model.weekStart, -7))}><Icon name="left" /></a><a className="border-x border-outline-variant px-3 py-2 text-xs font-semibold hover:bg-surface-container" href={href(model.selectedBranchId, currentWeekStart())}>Esta semana</a><a aria-label="Semana siguiente" className="p-2 hover:bg-surface-container" href={href(model.selectedBranchId, addDays(model.weekStart, 7))}><Icon name="right" /></a></div>
        <button className={`${secondary} hidden xl:inline-flex`} disabled={!previousBranches.length} onClick={() => setConfirm("copy")}><Icon name="copy" /><span className="ml-2">Copiar anterior</span></button>
        <button className={primary} onClick={() => openNew(null, selectedDay)}><Icon name="plus" /><span className="ml-2">Nuevo turno</span></button>
        <button className={secondary} disabled={!publishablePeriods.length} onClick={() => setConfirm("publish")}><Icon name="publish" /><span className="ml-2">Publicar</span></button>
      </div>
      <div className="mt-2 flex items-center gap-2 lg:hidden"><label className="relative flex-1"><span className="sr-only">Buscar empleado</span><span className="pointer-events-none absolute left-3 top-2.5 text-on-surface-variant"><Icon name="search" /></span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar empleado" className={`${field} pl-9`} /></label></div>
    </header>

    {!model.employments.length ? <EmptyWorkforce /> : <>
      <nav aria-label="Días de la semana" className="flex gap-1 overflow-x-auto px-2 pb-1 lg:hidden">{dates.map((date, index) => <button key={date} onClick={() => setSelectedDay(date)} aria-current={selectedDay === date ? "date" : undefined} className={`min-w-[58px] rounded-lg border px-2 py-1.5 text-center text-[11px] font-bold ${selectedDay === date ? "border-primary bg-primary text-on-primary" : "border-outline-variant bg-surface"}`}>{dayNames[index]}<span className="block text-base">{new Date(`${date}T00:00:00Z`).getUTCDate()}</span></button>)}</nav>

      <div className="hidden max-h-[calc(100vh-12rem)] overflow-auto border-y border-outline-variant bg-surface shadow-sm lg:block">
        <div className="min-w-[1160px]">
          <div className="sticky top-0 z-20 grid grid-cols-[13rem_repeat(7,minmax(8.25rem,1fr))] border-b border-outline-variant bg-surface-container-low">
            <div className="sticky left-0 z-30 flex items-center gap-2 bg-surface-container-low p-2"><strong className="text-sm">Equipo</strong><label className="relative ml-auto w-28 xl:w-36"><span className="sr-only">Buscar empleado</span><span className="pointer-events-none absolute left-2 top-2 text-on-surface-variant"><Icon name="search" /></span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar" className="w-full rounded-md border border-outline-variant bg-surface py-1.5 pl-7 pr-2 text-xs outline-none focus:border-primary" /></label></div>
            {dates.map((date, index) => { const shifts = visibleShifts.filter((shift) => shift.date === date); const people = new Set(shifts.map((shift) => shift.employmentId).filter(Boolean)).size; const hours = shifts.reduce((sum, shift) => sum + Math.max(0, minutes(shift.start, shift.end) - shift.breakMinutes), 0) / 60; return <div key={date} className="border-l border-outline-variant p-2"><strong className="text-sm">{dayNames[index]} {dateLabel(date, { day: "numeric", month: "numeric" })}</strong><p className="text-[10px] text-on-surface-variant">{hours.toFixed(hours % 1 ? 1 : 0)} h · {people} {people === 1 ? "persona" : "personas"}</p></div>; })}
          </div>
          {[...assigned, ...withoutBranch].map((employee, index) => <EmployeeRow key={employee.id} employee={employee} dates={dates} shifts={visibleShifts} availability={availability} branches={model.branches} selectedDay={selectedDay} threshold={model.threshold} sectionStart={index === assigned.length && withoutBranch.length > 0} onAdd={openNew} onEdit={openEdit} />)}
          {!visibleEmployments.length && <div className="p-8 text-center text-sm text-on-surface-variant">No hay empleados que coincidan con este filtro.</div>}
        </div>
      </div>

      <div className="space-y-3 px-2 lg:hidden">
        <div className="flex items-center justify-between"><div><h2 className="font-bold capitalize">{dateLabel(selectedDay, { weekday: "long", day: "numeric", month: "long" })}</h2><p className="text-xs text-on-surface-variant">{visibleShifts.filter((shift) => shift.date === selectedDay).length} turnos</p></div><button className={primary} onClick={() => openNew(null, selectedDay)}><Icon name="plus" /><span className="ml-1">Turno</span></button></div>
        {model.branches.filter((branch) => !model.selectedBranchId || branch.id === model.selectedBranchId).map((branch) => { const branchShifts = visibleShifts.filter((shift) => shift.date === selectedDay && shift.branchId === branch.id); if (!branchShifts.length) return null; return <section key={branch.id}><h3 className="mb-1.5 text-xs font-black uppercase tracking-wide text-on-surface-variant">{branch.name}</h3><div className="space-y-2">{branchShifts.map((shift) => <MobileShift key={shift.id} shift={shift} branches={model.branches} onEdit={openEdit} />)}</div></section>; })}
        {visibleEmployments.filter((employee) => !visibleShifts.some((shift) => shift.date === selectedDay && shift.employmentId === employee.id)).map((employee) => <article key={employee.id} className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface p-3"><Avatar name={employee.name} /><div className="min-w-0 flex-1"><strong className="truncate text-sm">{employee.name}</strong><p className="text-xs text-on-surface-variant">Sin turno · {employee.hours.toFixed(1)} h semana</p></div><button className={secondary} onClick={() => openNew(employee.id, selectedDay)}>+ Agregar</button></article>)}
      </div>

      {unassignedShifts.length > 0 && <details className="mx-2 rounded-xl border border-amber-400/50 bg-amber-50/60 p-3 dark:bg-amber-950/20 lg:mx-4"><summary className="cursor-pointer text-sm font-bold">{unassignedShifts.length} turnos sin empleado</summary><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{unassignedShifts.map((shift) => <ShiftCard key={shift.id} shift={shift} branches={model.branches} onEdit={openEdit} />)}</div></details>}

      <footer className="sticky bottom-0 z-20 mx-2 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-outline-variant bg-surface/95 px-4 py-2 text-xs shadow-lg backdrop-blur lg:mx-4"><strong>{visibleEmployments.length} empleados</strong><span>{visibleShifts.length} turnos</span><span>{totalHours.toFixed(1)} h programadas</span>{withoutBranch.length > 0 && <Link href="/administration/workforce" className="ml-auto font-bold text-primary">{withoutBranch.length} sin sucursal · Asignar</Link>}</footer>
      <details className="mx-2 rounded-xl border border-outline-variant bg-surface lg:mx-4"><summary className="cursor-pointer px-4 py-2 text-xs font-bold">Cobertura del equipo</summary><Coverage model={model} target={target} /></details>
    </>}

    {editor && <ShiftDialog editor={editor} model={model} target={target} onClose={() => setEditor(null)} onDuplicate={(shift) => setEditor({ shift, employmentId: shift.employmentId ?? "", branchId: shift.branchId, date: shift.date, duplicate: true })} />}
    {confirm && <ConfirmDialog kind={confirm} model={model} target={target} periods={publishablePeriods} previousBranches={previousBranches} onClose={() => setConfirm(null)} />}
  </section>;
}

function Avatar({ name }: { name: string }) { return <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-black text-primary">{initials(name)}</span>; }

function EmployeeRow({ employee, dates, shifts, availability, branches, selectedDay, threshold, sectionStart, onAdd, onEdit }: { employee: Employment; dates: string[]; shifts: Shift[]; availability: Map<string, ScheduleViewModel["availability"][number]>; branches: Branch[]; selectedDay: string; threshold: number; sectionStart: boolean; onAdd: (employmentId: string | null, date: string) => void; onEdit: (shift: Shift) => void }) {
  return <>{sectionStart && <div className="sticky left-0 z-10 border-b border-t border-outline-variant bg-surface-container px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-on-surface-variant">Sin sucursal</div>}<div className="grid grid-cols-[13rem_repeat(7,minmax(8.25rem,1fr))] border-b border-outline-variant last:border-b-0">
    <div className="sticky left-0 z-10 flex min-h-[62px] items-center gap-2 bg-surface px-2 py-1.5"><Avatar name={employee.name} /><div className="min-w-0"><p className="truncate text-sm font-bold">{employee.name}</p><p className={`text-xs ${employee.hours >= threshold ? "font-bold text-error" : "text-on-surface-variant"}`}>{employee.hours.toFixed(1)} h {employee.hours >= threshold ? "⚠" : ""}</p>{!employee.assignments.length && <Link href="/administration/workforce" className="text-[10px] font-bold text-primary">Asignar sucursal</Link>}</div><button aria-label={`Agregar turno para ${employee.name}`} className="ml-auto rounded-md p-1.5 text-primary hover:bg-primary/10" onClick={() => onAdd(employee.id, selectedDay)}><Icon name="plus" /></button></div>
    {dates.map((date) => { const cellShifts = shifts.filter((shift) => shift.employmentId === employee.id && shift.date === date); const state = availability.get(`${employee.id}|${date}`); return <div key={date} className={`min-h-[62px] border-l border-outline-variant p-1 ${state?.state === "UNAVAILABLE" ? "bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,color-mix(in_srgb,currentColor_4%,transparent)_6px,color-mix(in_srgb,currentColor_4%,transparent)_12px)]" : ""}`}><div className="space-y-0.5">{cellShifts.map((shift) => <ShiftCard key={shift.id} shift={shift} branches={branches} onEdit={onEdit} />)}</div>{state?.state === "UNAVAILABLE" && !cellShifts.length && <p className="text-[9px] text-on-surface-variant">No disponible</p>}<button className="mt-0.5 flex w-full items-center justify-center rounded-md px-1 py-0.5 text-[9px] font-bold text-primary hover:bg-primary/10" onClick={() => onAdd(employee.id, date)}>+ Agregar</button></div>; })}
  </div></>;
}

function ShiftCard({ shift, branches, onEdit }: { shift: Shift; branches: Branch[]; onEdit: (shift: Shift) => void }) {
  const warning = shift.warnings[0] ? scheduleWarningLabel(shift.warnings[0]) : null;
  return <button type="button" onClick={() => onEdit(shift)} title={warning ?? undefined} className={`block w-full rounded-md border-l-[3px] px-1.5 py-0.5 text-left shadow-sm transition hover:-translate-y-px hover:shadow ${branchTone(shift.branchId, branches)}`}><span className="flex items-center gap-1"><span className="block min-w-0 flex-1 truncate text-[8px] font-black uppercase tracking-wide">{shift.branchName}</span>{warning && <span aria-label={warning} className="text-[9px] text-amber-600 dark:text-amber-300">⚠</span>}</span><span className="flex items-baseline gap-1 whitespace-nowrap text-[10px] font-bold leading-tight"><span>{shift.start}–{shift.end}</span>{shift.breakMinutes > 0 && <span className="text-[8px] font-medium opacity-70">{shift.breakMinutes}m</span>}</span></button>;
}

function MobileShift({ shift, branches, onEdit }: { shift: Shift; branches: Branch[]; onEdit: (shift: Shift) => void }) { return <button onClick={() => onEdit(shift)} className={`flex w-full items-center gap-3 rounded-xl border-l-4 p-3 text-left ${branchTone(shift.branchId, branches)}`}><Avatar name={shift.employeeName ?? "?"} /><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{shift.employeeName ?? "Sin asignar"}</strong><span className="text-xs font-bold">{shift.start}–{shift.end}</span>{shift.breakMinutes > 0 && <span className="ml-2 text-[10px] opacity-75">{shift.breakMinutes}m</span>}</span><Icon name="more" /></button>; }

function EmptyWorkforce() { return <div className="mx-2 rounded-xl border border-dashed border-outline-variant bg-surface p-10 text-center lg:mx-4"><h2 className="text-lg font-bold">Aún no hay empleados activos</h2><p className="mt-1 text-sm text-on-surface-variant">Crea el primer empleado para comenzar a construir el horario.</p><Link href="/administration/workforce/employees/new" className={`${primary} mt-4`}>Crear empleado</Link></div>; }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; ref.current?.focus(); const listener = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); if (event.key === "Tab" && ref.current) { const focusable = Array.from(ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])')); if (!focusable.length) return; const first = focusable[0], last = focusable[focusable.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } }; document.addEventListener("keydown", listener); document.body.style.overflow = "hidden"; return () => { document.removeEventListener("keydown", listener); document.body.style.overflow = ""; previous?.focus(); }; }, [onClose]);
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="schedule-dialog-title" className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-2xl outline-none sm:max-w-lg sm:rounded-2xl"><div className="mb-4 flex items-center justify-between"><h2 id="schedule-dialog-title" className="text-lg font-bold">{title}</h2><button aria-label="Cerrar" className={secondary} onClick={onClose}><Icon name="close" /></button></div>{children}</div></div>;
}

function ShiftDialog({ editor, model, target, onClose, onDuplicate }: { editor: { shift?: Shift; employmentId: string; branchId: string; date: string; duplicate?: boolean }; model: ScheduleViewModel; target: string; onClose: () => void; onDuplicate: (shift: Shift) => void }) {
  const shift = editor.shift; const isEdit = Boolean(shift && !editor.duplicate); const sourcePeriod = shift ? model.periods.find((period) => period.id === shift.periodId) : null; const selectedPeriod = model.periods.find((period) => period.branchId === editor.branchId); const postPublish = Boolean(sourcePeriod?.published || selectedPeriod?.published);
  return <Modal title={isEdit ? "Editar turno" : editor.duplicate ? "Duplicar turno" : "Nuevo turno"} onClose={onClose}><form action={saveWorkforceShiftAction} onSubmit={onClose} className="space-y-3">
    <input type="hidden" name="periodId" value={shift?.periodId ?? selectedPeriod?.id ?? ""} /><input type="hidden" name="weekStart" value={model.weekStart} />{isEdit && <><input type="hidden" name="shiftId" value={shift!.id} /><input type="hidden" name="expectedVersion" value={shift!.version} /></>}<input type="hidden" name="returnTo" value={target} />
    <label className="block text-sm font-semibold">Empleado<select name="employmentId" defaultValue={editor.employmentId} className={`${field} mt-1`}><option value="">Sin asignar</option>{model.employments.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
    <label className="block text-sm font-semibold">Sucursal<select name="branchId" defaultValue={editor.branchId} className={`${field} mt-1`}>{model.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
    <label className="block text-sm font-semibold">Fecha<input required name="businessDate" type="date" min={model.weekStart} max={model.weekEnd} defaultValue={editor.date} className={`${field} mt-1`} /></label>
    <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Hora de entrada<input required name="startTime" type="time" defaultValue={shift?.start ?? "09:00"} className={`${field} mt-1`} /></label><label className="text-sm font-semibold">Hora de salida<input required name="endTime" type="time" defaultValue={shift?.end ?? "17:00"} className={`${field} mt-1`} /></label></div>
    <label className="block text-sm font-semibold">Descanso<input name="expectedBreakMinutes" type="number" min="0" max="480" defaultValue={shift?.breakMinutes ?? 30} className={`${field} mt-1`} /><span className="mt-1 block text-xs font-normal text-on-surface-variant">Minutos</span></label>
    {postPublish && <label className="block text-sm font-semibold">Motivo del cambio<input required name="reason" maxLength={200} placeholder="Ej. cambio solicitado por la persona" className={`${field} mt-1`} /></label>}
    {shift?.warnings.length ? <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">{shift.warnings.map((warning) => <p key={warning}>{scheduleWarningLabel(warning)}</p>)}</div> : null}
    <div className="flex gap-2"><button type="button" className={`${secondary} flex-1`} onClick={onClose}>Cancelar</button><button className={`${primary} flex-1`}>{isEdit ? "Guardar cambios" : "Guardar turno"}</button></div>
  </form>{isEdit && <div className="mt-3 grid grid-cols-2 gap-2"><button className={secondary} onClick={() => onDuplicate(shift!)}><Icon name="copy" /><span className="ml-2">Duplicar</span></button><form action={deleteWorkforceShiftAction} onSubmit={onClose}><input type="hidden" name="shiftId" value={shift!.id} /><input type="hidden" name="expectedVersion" value={shift!.version} /><input type="hidden" name="returnTo" value={target} />{postPublish && <input required name="reason" aria-label="Motivo para retirar" placeholder="Motivo para retirar" className={`${field} mb-2`} />}<button className="min-h-9 w-full rounded-lg border border-error/30 px-3 py-2 text-sm font-bold text-error">{postPublish ? "Retirar turno" : "Eliminar"}</button></form></div>}</Modal>;
}

function ConfirmDialog({ kind, model, target, periods, previousBranches, onClose }: { kind: "copy" | "publish"; model: ScheduleViewModel; target: string; periods: ScheduleViewModel["periods"]; previousBranches: ScheduleViewModel["previousWeek"]["branches"]; onClose: () => void }) {
  const publish = kind === "publish"; const branches = publish ? periods.map((period) => ({ branchId: period.branchId, count: period.shiftCount })) : previousBranches.map((item) => ({ branchId: item.branchId, count: item.shifts.length }));
  return <Modal title={publish ? "Publicar horarios" : "Copiar semana anterior"} onClose={onClose}><p className="text-sm text-on-surface-variant">{publish ? "La publicación es independiente por sucursal para conservar su historial y validación." : "Se copiarán los turnos a borradores de esta semana."}</p><div className="mt-3 space-y-2">{branches.map((item) => <div key={item.branchId} className="flex items-center justify-between gap-3 rounded-lg bg-surface-container px-3 py-2 text-sm"><span><strong>{model.branches.find((branch) => branch.id === item.branchId)?.name}</strong><span className="ml-2 text-xs text-on-surface-variant">{item.count} turnos</span></span>{publish && <form action={publishWorkforceScheduleAction} onSubmit={onClose}><input type="hidden" name="returnTo" value={target} /><input type="hidden" name="periodId" value={periods.find((period) => period.branchId === item.branchId)?.id} /><button className={primary}>Publicar</button></form>}</div>)}</div>{publish ? <button type="button" className={`${secondary} mt-4 w-full`} onClick={onClose}>Cerrar</button> : <form action={copyWorkforcePreviousWeekGroupAction} onSubmit={onClose} className="mt-4 flex gap-2"><input type="hidden" name="returnTo" value={target} /><input type="hidden" name="weekStart" value={model.weekStart} />{branches.map((item) => <input key={item.branchId} type="hidden" name="branchId" value={item.branchId} />)}<button type="button" className={`${secondary} flex-1`} onClick={onClose}>Volver</button><button className={`${primary} flex-1`}>Copiar turnos</button></form>}</Modal>;
}

function Coverage({ model, target }: { model: ScheduleViewModel; target: string }) { const branchId = model.selectedBranchId ?? model.branches[0]?.id ?? ""; return <div className="border-t border-outline-variant p-3"><form action={saveWorkforceCoverageAction} className="grid gap-2 sm:grid-cols-6"><select aria-label="Sucursal de cobertura" name="branchId" defaultValue={branchId} className={field}>{model.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select><input type="hidden" name="returnTo" value={target} /><input aria-label="Día de cobertura" required name="businessDate" type="date" min={model.weekStart} max={model.weekEnd} defaultValue={model.selectedDay} className={field} /><input aria-label="Desde" required name="startTime" type="time" defaultValue="18:00" className={field} /><input aria-label="Hasta" required name="endTime" type="time" defaultValue="23:00" className={field} /><input aria-label="Personas necesarias" required name="requiredCount" type="number" min="1" defaultValue="1" className={field} /><button className={secondary}>Guardar</button></form><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{model.coverage.map((item) => <div key={item.id} className="rounded-lg bg-surface-container p-2 text-xs"><strong>{item.branchName} · {dateLabel(item.date, { weekday: "short", day: "numeric" })}</strong><p className="text-on-surface-variant">{item.start}–{item.end} · {item.scheduled}/{item.required}</p></div>)}</div></div>; }
