"use client";

import Link from "next/link";
import { useMemo } from "react";
import { addDaysToDateOnly, mondayOfWeek } from "@/lib/dateOnly";
import { CalendarIcon, ClockIcon, MapPinIcon, PartyIcon } from "@/components/ui/icons";

type ScheduleEventInfo = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  instructions: string | null;
};

type Shift = {
  id: string;
  date: string;
  type: "TURNO" | "DESCANSO";
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  position: string | null;
  branch: { id: string; name: string } | null;
  event: ScheduleEventInfo | null;
};

type OpenShift = {
  id: string;
  clockIn: string;
  branch: { id: string; name: string };
} | null;

type CalendarViewProps = {
  shifts: Shift[];
  openShift: OpenShift;
  todayKey: string;
};

const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function dateFromKey(key: string) {
  return new Date(`${key}T12:00:00.000Z`);
}

function dayName(key: string) {
  return DAY_NAMES[dateFromKey(key).getUTCDay()];
}

function shortDate(key: string) {
  const date = dateFromKey(key);
  return `${date.getUTCDate()} de ${MONTH_NAMES[date.getUTCMonth()]}`;
}

function weekRangeLabel(weekStart: string) {
  const weekEnd = addDaysToDateOnly(weekStart, 6);
  const start = dateFromKey(weekStart);
  const end = dateFromKey(weekEnd);
  return start.getUTCMonth() === end.getUTCMonth()
    ? `${start.getUTCDate()}–${end.getUTCDate()} de ${MONTH_NAMES[start.getUTCMonth()]}`
    : `${start.getUTCDate()} de ${MONTH_NAMES[start.getUTCMonth()]} – ${end.getUTCDate()} de ${MONTH_NAMES[end.getUTCMonth()]}`;
}

function shiftLabel(shift: Shift) {
  return shift.event?.name ?? shift.branch?.name ?? "Turno de trabajo";
}

export default function CalendarView({ shifts, openShift, todayKey }: CalendarViewProps) {
  const byDate = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const shift of shifts) {
      const key = shift.date.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), shift]);
    }
    return map;
  }, [shifts]);

  const days = useMemo(() => Array.from({ length: 21 }, (_, index) => addDaysToDateOnly(todayKey, index)), [todayKey]);
  const weeks = useMemo(() => {
    const grouped: Array<{ start: string; days: string[] }> = [];
    for (let index = 0; index < days.length; index += 7) {
      const weekDays = days.slice(index, index + 7);
      grouped.push({ start: mondayOfWeek(weekDays[0]), days: weekDays });
    }
    return grouped;
  }, [days]);
  const workDays = days.filter((key) => (byDate.get(key) ?? []).some((shift) => shift.type === "TURNO")).length;
  const restDays = days.filter((key) => {
    const dayShifts = byDate.get(key) ?? [];
    return dayShifts.length > 0 && dayShifts.every((shift) => shift.type === "DESCANSO");
  }).length;
  const unscheduledDays = days.length - workDays - restDays;

  return (
    <main className="min-h-screen bg-background text-on-surface">
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-outline">Próximos 21 días</p>
            <h1 className="mt-1 text-3xl font-bold text-on-surface">Mi horario</h1>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">Aquí puedes ver claramente qué días trabajas y cuáles son de descanso.</p>
          </div>
          <Link href="/timeclock" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container text-on-surface-variant transition hover:border-primary/25 hover:text-primary" aria-label="Ir al checador"><ClockIcon className="h-5 w-5" /></Link>
        </header>

        <nav className="grid grid-cols-2 gap-3">
          <Link href="/timeclock/availability" className="rounded-xl border border-outline-variant bg-surface-container p-3 text-center text-sm font-semibold">Mi disponibilidad</Link>
          <Link href="/timeclock/requests" className="rounded-xl border border-outline-variant bg-surface-container p-3 text-center text-sm font-semibold">Solicitudes</Link>
        </nav>

        <section className="grid grid-cols-3 gap-2" aria-label="Resumen del horario">
          <div className="rounded-2xl border border-primary/25 bg-primary/[0.08] p-4"><p className="text-[10px] font-black uppercase tracking-widest text-primary">Días de trabajo</p><p className="mt-1 text-2xl font-bold text-on-surface">{workDays}</p></div>
          <div className="rounded-2xl border border-tertiary-fixed-dim/25 bg-tertiary-fixed-dim/[0.08] p-4"><p className="text-[10px] font-black uppercase tracking-widest text-tertiary-fixed-dim">Días de descanso</p><p className="mt-1 text-2xl font-bold text-on-surface">{restDays}</p></div>
          <div className="rounded-2xl border border-outline-variant bg-surface-container-high p-4"><p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Sin horario</p><p className="mt-1 text-2xl font-bold text-on-surface">{unscheduledDays}</p></div>
        </section>

        <div className="space-y-5">
          {weeks.map((week) => {
            const weekWorkDays = week.days.filter((key) => (byDate.get(key) ?? []).some((shift) => shift.type === "TURNO")).length;
            return <section key={week.start} className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container"><div className="border-b border-outline-variant bg-surface-container-high px-4 py-3"><div className="flex items-center justify-between gap-3"><h2 className="font-bold capitalize text-on-surface">Semana del {weekRangeLabel(week.start)}</h2><span className="shrink-0 rounded-full bg-surface-container px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{weekWorkDays} {weekWorkDays === 1 ? "día" : "días"} de trabajo</span></div></div><div className="divide-y divide-outline-variant">{week.days.map((key) => { const dayShifts = byDate.get(key) ?? []; return <DayRow key={key} dateKey={key} isToday={key === todayKey} shifts={dayShifts.filter((shift) => shift.type === "TURNO")} hasExplicitRest={dayShifts.some((shift) => shift.type === "DESCANSO")} openShift={openShift} />; })}</div></section>;
          })}
        </div>

        {shifts.length === 0 && <div className="rounded-2xl border border-dashed border-outline-variant p-6 text-center text-sm text-on-surface-variant"><CalendarIcon className="mx-auto mb-2 h-8 w-8" />No tienes turnos publicados en los próximos 21 días.</div>}
      </div>
    </main>
  );
}

function DayRow({ dateKey, isToday, shifts, hasExplicitRest, openShift }: { dateKey: string; isToday: boolean; shifts: Shift[]; hasExplicitRest: boolean; openShift: OpenShift }) {
  const noAssignment = !hasExplicitRest;
  return <div className={`px-4 py-4 ${isToday ? "bg-primary/[0.06]" : "bg-surface-container"}`}><div className="flex items-start gap-3"><div className="w-28 shrink-0"><p className={`text-xs font-black uppercase tracking-wide ${isToday ? "text-primary" : "text-on-surface-variant"}`}>{dayName(dateKey)}</p><p className="mt-0.5 text-sm font-semibold capitalize text-on-surface">{shortDate(dateKey)}</p>{isToday && <span className="mt-1 inline-flex rounded-full bg-primary px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-on-primary">Hoy</span>}</div><div className="min-w-0 flex-1 space-y-2">{shifts.length > 0 ? shifts.map((shift) => <WorkShift key={shift.id} shift={shift} dateKey={dateKey} openShift={openShift} />) : <div className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${noAssignment ? "border-outline-variant bg-surface-container-high" : "border-tertiary-fixed-dim/25 bg-tertiary-fixed-dim/[0.08]"}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${noAssignment ? "bg-surface-container-highest text-on-surface-variant" : "bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim"}`}>{noAssignment ? "—" : "✓"}</span><div><p className={`font-bold uppercase tracking-wide ${noAssignment ? "text-on-surface-variant" : "text-tertiary-fixed-dim"}`}>{noAssignment ? "Turno no programado" : "Descanso"}</p><p className="text-xs text-on-surface-variant">{noAssignment ? "No hay horario asignado para este día." : "Descanso programado"}</p></div></div>}</div></div></div>;
}

function WorkShift({ shift, dateKey, openShift }: { shift: Shift; dateKey: string; openShift: OpenShift }) {
  const currentDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
  const isActive = dateKey === currentDate && openShift !== null && shift.branch !== null && openShift.branch.id === shift.branch.id;
  const isPast = dateKey < currentDate;
  const status = isActive ? "EN TURNO" : isPast ? "COMPLETADO" : "PROGRAMADO";
  const statusClass = isActive ? "bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim" : isPast ? "bg-surface-container-highest text-on-surface-variant" : "bg-secondary/10 text-secondary";
  return <div className={`rounded-xl border p-3 ${isActive ? "border-tertiary-fixed-dim/40 bg-tertiary-fixed-dim/[0.06]" : "border-primary/20 bg-primary/[0.04]"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="flex items-center gap-1.5 font-semibold text-on-surface">{shift.event ? <PartyIcon className="h-4 w-4 shrink-0 text-primary" /> : null}<span className="truncate">{shiftLabel(shift)}</span></p><p className="mt-1 font-mono text-sm font-bold text-on-surface">{shift.startTime} — {shift.endTime}</p>{shift.position && <p className="mt-0.5 text-xs text-on-surface-variant">{shift.position}</p>}</div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black tracking-widest ${statusClass}`}>{status}</span></div>{shift.event?.location && <p className="mt-2 flex items-center gap-1.5 text-xs text-on-surface-variant"><MapPinIcon className="h-3.5 w-3.5 shrink-0" />{shift.event.location}</p>}{shift.event?.description && <p className="mt-2 text-xs leading-5 text-on-surface-variant">{shift.event.description}</p>}{shift.event?.instructions && <div className="mt-2 rounded-lg bg-surface-container-high p-2.5 text-xs text-on-surface"><span className="font-bold uppercase tracking-wide text-on-surface-variant">Instrucciones: </span>{shift.event.instructions}</div>}{shift.notes && <p className="mt-2 text-xs text-on-surface-variant">{shift.notes}</p>}</div>;
}
