"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  copyPreviousAvailabilityWeekAction,
  getMyAvailabilityWeek,
  saveMyAvailabilityAction,
  type AvailabilityKind,
  type AvailabilityReasonKind,
} from "@/app/actions/availability";
import { addDaysToDateOnly, mondayOfWeek, todayDateOnly } from "@/lib/dateOnly";

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const TYPE_OPTIONS: { value: AvailabilityKind; label: string; help: string }[] = [
  { value: "AVAILABLE_ALL_DAY", label: "Disponible todo el día", help: "Puedes trabajar en cualquier horario." },
  { value: "AVAILABLE_PARTIAL", label: "Horario específico", help: "Indica desde qué hora y hasta qué hora." },
  { value: "UNAVAILABLE", label: "No disponible", help: "No puedes trabajar ese día." },
  { value: "PREFER_OFF", label: "Preferiría descansar", help: "Es una preferencia, no una prohibición." },
];
const REASONS: { value: AvailabilityReasonKind; label: string }[] = [
  { value: "MEDICAL", label: "Cita médica" }, { value: "SCHOOL", label: "Escuela" },
  { value: "FAMILY", label: "Compromiso familiar" }, { value: "TRAVEL", label: "Viaje" },
  { value: "ERRAND", label: "Trámite" }, { value: "OTHER", label: "Otro" },
];

function styleFor(type?: AvailabilityKind) {
  if (type === "UNAVAILABLE") return "border-error/30 bg-error/10 text-error";
  if (type === "AVAILABLE_PARTIAL") return "border-secondary/30 bg-secondary/10 text-secondary";
  if (type === "PREFER_OFF") return "border-outline-variant bg-surface-container-high text-on-surface-variant";
  if (type === "AVAILABLE_ALL_DAY") return "border-tertiary-fixed-dim/30 bg-tertiary-fixed-dim/10 text-tertiary-fixed-dim";
  return "border-outline-variant bg-surface-container text-on-surface-variant";
}

function labelFor(day: { availability: { type: AvailabilityKind; startTime: string | null; endTime: string | null } | null }) {
  const availability = day.availability;
  if (!availability) return "Sin indicar";
  if (availability.type === "AVAILABLE_ALL_DAY") return "Disponible";
  if (availability.type === "UNAVAILABLE") return "No disponible";
  if (availability.type === "PREFER_OFF") return "Preferiría descansar";
  return `${availability.startTime} – ${availability.endTime}`;
}

export default function AvailabilityView() {
  const [weekStart, setWeekStart] = useState(mondayOfWeek(todayDateOnly()));
  const [data, setData] = useState<Awaited<ReturnType<typeof getMyAvailabilityWeek>> | null>(null);
  const [selected, setSelected] = useState(0);
  const [type, setType] = useState<AvailabilityKind>("AVAILABLE_ALL_DAY");
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("01:00");
  const [reason, setReason] = useState<AvailabilityReasonKind>("OTHER");
  const [reasonNotes, setReasonNotes] = useState("");
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setData(await getMyAvailabilityWeek(weekStart));
  }, [weekStart]);
  // La carga es asíncrona y sincroniza datos externos con la semana visible.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const days = useMemo(
    () => data?.success === true && data.days ? data.days : [],
    [data],
  );
  const selectedDay = days[selected];
  useEffect(() => {
    if (!selectedDay?.availability) return;
    // El formulario conserva edición local y debe rehidratarse al cambiar de día.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setType(selectedDay.availability.type);
    setStartTime(selectedDay.availability.startTime ?? "17:00");
    setEndTime(selectedDay.availability.endTime ?? "01:00");
    setReason(selectedDay.availability.reason ?? "OTHER");
    setReasonNotes(selectedDay.availability.reasonNotes ?? "");
  }, [selectedDay?.availability]);

  const summary = useMemo(() => days.reduce((acc, day) => {
    const type = day.availability?.type;
    if (type === "AVAILABLE_ALL_DAY") acc.available++;
    else if (type === "AVAILABLE_PARTIAL") acc.partial++;
    else if (type === "UNAVAILABLE") acc.unavailable++;
    else if (type === "PREFER_OFF") acc.preferOff++;
    return acc;
  }, { available: 0, partial: 0, unavailable: 0, preferOff: 0 }), [days]);

  async function save() {
    if (!selectedDay) return;
    setBusy(true); setMessage(null);
    const result = await saveMyAvailabilityAction({ date: selectedDay.date, type, startTime, endTime, reason, reasonNotes, repeatWeekly });
    setBusy(false);
    if (result.error) return setMessage(result.error);
    setMessage(repeatWeekly ? "Disponibilidad semanal guardada." : "Disponibilidad del día guardada.");
    await load();
  }

  async function copyPrevious() {
    setBusy(true); setMessage(null);
    const result = await copyPreviousAvailabilityWeekAction(weekStart);
    setBusy(false);
    setMessage(result.error ?? `${result.count ?? 0} días copiados de la semana anterior.`);
    if (!result.error) await load();
  }

  const closed = data?.success === true ? data.closed : false;
  return (
    <main className="min-h-screen bg-background px-4 py-6 text-on-surface">
      <div className="mx-auto max-w-2xl space-y-5">
        <header>
          <Link href="/timeclock" className="text-sm font-semibold text-on-surface-variant">← Horario</Link>
          <h1 className="mt-3 text-3xl font-bold">Mi disponibilidad</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Indica cuándo puedes trabajar. Esto no modifica turnos publicados.</p>
        </header>

        <section className="rounded-2xl border border-outline-variant bg-surface-container p-4">
          <div className="flex items-center justify-between gap-3">
            <button onClick={() => { setWeekStart(addDaysToDateOnly(weekStart, -7)); setSelected(0); }} className="rounded-xl border border-outline-variant px-3 py-2">←</button>
            <div className="text-center"><p className="text-xs uppercase tracking-wider text-on-surface-variant">Disponibilidad</p><p className="font-bold">{weekStart} al {addDaysToDateOnly(weekStart, 6)}</p></div>
            <button onClick={() => { setWeekStart(addDaysToDateOnly(weekStart, 7)); setSelected(0); }} className="rounded-xl border border-outline-variant px-3 py-2">→</button>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs sm:grid-cols-7">
            {days.map((day, index) => <button key={day.date} onClick={() => { setSelected(index); setMessage(null); }} className={`rounded-xl border p-2 ${selected === index ? "ring-2 ring-primary" : ""} ${styleFor(day.availability?.type)}`}><span className="block font-bold">{DAY_NAMES[index]} {Number(day.date.slice(8))}</span><span className="mt-1 block truncate">{labelFor(day)}</span></button>)}
          </div>
          <p className="mt-4 text-xs text-on-surface-variant">{summary.available} disponibles · {summary.partial} parciales · {summary.unavailable} no disponibles · {summary.preferOff} preferencias</p>
        </section>

        {closed && <div className="rounded-xl border border-secondary/30 bg-secondary/10 p-4 text-sm text-secondary">El periodo de disponibilidad para esta semana ya cerró.</div>}
        {selectedDay && <section className="space-y-4 rounded-2xl border border-outline-variant bg-surface-container p-5">
          <div><h2 className="text-lg font-bold">{DAY_NAMES[selected]} {Number(selectedDay.date.slice(8))}</h2>{selectedDay.shift && <div className="mt-2 rounded-xl border border-secondary/30 bg-secondary/10 p-3 text-sm"><strong>Turno programado:</strong> {selectedDay.shift.startTime}–{selectedDay.shift.endTime} · {selectedDay.shift.branch?.name}<br/><Link href="/timeclock/calendar" className="font-semibold underline">Ver turno</Link></div>}</div>
          <div className="grid gap-2">{TYPE_OPTIONS.map((option) => <label key={option.value} className={`cursor-pointer rounded-xl border p-3 ${type === option.value ? "border-primary bg-primary/10" : "border-outline-variant"}`}><span className="flex gap-3"><input type="radio" checked={type === option.value} onChange={() => setType(option.value)}/><span><strong className="block text-sm">{option.label}</strong><small className="text-on-surface-variant">{option.help}</small></span></span></label>)}</div>
          {type === "AVAILABLE_PARTIAL" && <div className="grid grid-cols-2 gap-3"><label className="text-sm">Desde<input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1 w-full rounded-xl border border-outline-variant bg-background p-3"/></label><label className="text-sm">Hasta<input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="mt-1 w-full rounded-xl border border-outline-variant bg-background p-3"/></label></div>}
          {type === "UNAVAILABLE" && <div className="space-y-3"><label className="block text-sm">Motivo<select value={reason} onChange={(e) => setReason(e.target.value as AvailabilityReasonKind)} className="mt-1 w-full rounded-xl border border-outline-variant bg-background p-3">{REASONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="block text-sm">Descripción opcional<textarea value={reasonNotes} onChange={(e) => setReasonNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-outline-variant bg-background p-3"/></label></div>}
          <label className="flex items-center gap-3 rounded-xl border border-outline-variant p-3 text-sm"><input type="checkbox" checked={repeatWeekly} onChange={(e) => setRepeatWeekly(e.target.checked)}/><span><strong className="block">Repetir cada semana</strong><small className="text-on-surface-variant">Se aplicará todos los {DAY_NAMES[selected].toLowerCase()}.</small></span></label>
          {message && <p className={`rounded-xl p-3 text-sm ${message.includes("guardada") || message.includes("copiados") ? "bg-tertiary-fixed-dim/10 text-tertiary-fixed-dim" : "bg-error/10 text-error"}`}>{message}</p>}
          <button onClick={save} disabled={busy || closed} className="w-full rounded-xl bg-primary py-3 font-bold text-on-primary disabled:opacity-50">{busy ? "Guardando…" : "Guardar disponibilidad"}</button>
        </section>}
        <button onClick={copyPrevious} disabled={busy || closed} className="w-full rounded-xl border border-outline-variant py-3 text-sm font-semibold disabled:opacity-50">Copiar disponibilidad de la semana anterior</button>
      </div>
    </main>
  );
}
