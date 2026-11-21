"use client";

import { useState } from "react";
import Link from "next/link";
import { cancelShiftRequestAction, createShiftRequestAction, type ShiftRequestKind } from "@/app/actions/shiftRequests";

type Shift = { id: string; date: string; startTime: string | null; endTime: string | null; branch: { name: string } | null };
type Request = { id: string; type: ShiftRequestKind; reason: string; status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"; createdAt: string; proposedStartTime: string | null; proposedEndTime: string | null; swapTargetUser: { name: string } | null; shift: Shift };
const LABELS: Record<ShiftRequestKind, string> = { CANNOT_WORK: "No puedo trabajar", CHANGE_TIME: "Cambiar horario", SWAP: "Intercambiar turno", DAY_OFF: "Solicitar día libre" };
const STATUS = { PENDING: "Pendiente", APPROVED: "Aprobada", REJECTED: "Rechazada", CANCELLED: "Cancelada" };

export default function RequestsView({ shifts, requests: initial, candidates }: { shifts: Shift[]; requests: Request[]; candidates: { id: string; name: string }[] }) {
  const [requests, setRequests] = useState(initial);
  const [shiftId, setShiftId] = useState(shifts[0]?.id ?? "");
  const [type, setType] = useState<ShiftRequestKind>("CANNOT_WORK");
  const [reason, setReason] = useState(""); const [start, setStart] = useState(""); const [end, setEnd] = useState(""); const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null);
  async function submit() { setBusy(true); setMessage(null); const result = await createShiftRequestAction({ shiftId, type, reason, proposedStartTime: start, proposedEndTime: end, swapTargetUserId: target }); setBusy(false); if (result.error) return setMessage(result.error); setMessage("Solicitud enviada para revisión."); window.location.reload(); }
  async function cancel(id: string) { const result = await cancelShiftRequestAction(id); if (result.error) return setMessage(result.error); setRequests((items) => items.map((item) => item.id === id ? { ...item, status: "CANCELLED" } : item)); }
  return <main className="min-h-screen bg-background px-4 py-6 text-on-surface"><div className="mx-auto max-w-2xl space-y-6">
    <header><Link href="/timeclock/calendar" className="text-sm font-semibold text-on-surface-variant">← Mi horario</Link><h1 className="mt-3 text-3xl font-bold">Solicitudes</h1><p className="mt-1 text-sm text-on-surface-variant">Los cambios de turnos publicados necesitan aprobación.</p></header>
    <section className="space-y-4 rounded-2xl border border-outline-variant bg-surface-container p-5"><h2 className="text-lg font-bold">Nueva solicitud</h2>
      {shifts.length === 0 ? <p className="text-sm text-on-surface-variant">No tienes turnos publicados próximos.</p> : <>
      <label className="block text-sm">Turno<select value={shiftId} onChange={(e) => setShiftId(e.target.value)} className="mt-1 w-full rounded-xl border border-outline-variant bg-background p-3">{shifts.map((s) => <option key={s.id} value={s.id}>{new Date(s.date).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })} · {s.startTime}–{s.endTime} · {s.branch?.name}</option>)}</select></label>
      <label className="block text-sm">Tipo<select value={type} onChange={(e) => setType(e.target.value as ShiftRequestKind)} className="mt-1 w-full rounded-xl border border-outline-variant bg-background p-3">{Object.entries(LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {type === "CHANGE_TIME" && <div className="grid grid-cols-2 gap-3"><label className="text-sm">Nueva entrada<input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 w-full rounded-xl border border-outline-variant bg-background p-3"/></label><label className="text-sm">Nueva salida<input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 w-full rounded-xl border border-outline-variant bg-background p-3"/></label></div>}
      {type === "SWAP" && <label className="block text-sm">Intercambiar con<select value={target} onChange={(e) => setTarget(e.target.value)} className="mt-1 w-full rounded-xl border border-outline-variant bg-background p-3"><option value="">Selecciona un trabajador</option>{candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
      <label className="block text-sm">Motivo<textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-outline-variant bg-background p-3"/></label>
      {message && <p className="rounded-xl bg-secondary/10 p-3 text-sm text-secondary">{message}</p>}<button onClick={submit} disabled={busy} className="w-full rounded-xl bg-primary py-3 font-bold text-on-primary disabled:opacity-50">{busy ? "Enviando…" : "Enviar solicitud"}</button></>}
    </section>
    <section className="space-y-3"><h2 className="text-lg font-bold">Mis solicitudes</h2>{requests.length === 0 && <p className="rounded-xl border border-dashed border-outline-variant p-5 text-sm text-on-surface-variant">Aún no tienes solicitudes.</p>}{requests.map((r) => <article key={r.id} className="rounded-2xl border border-outline-variant bg-surface-container p-4"><div className="flex justify-between gap-3"><div><p className="font-bold">{LABELS[r.type]}</p><p className="text-sm text-on-surface-variant">{new Date(r.shift.date).toLocaleDateString("es-MX", { dateStyle: "medium", timeZone: "UTC" })} · {r.shift.startTime}–{r.shift.endTime}</p></div><span className="h-fit rounded-full bg-surface-container-high px-3 py-1 text-xs font-bold">{STATUS[r.status]}</span></div><p className="mt-3 text-sm">{r.reason}</p>{r.status === "PENDING" && <button onClick={() => cancel(r.id)} className="mt-3 text-xs font-semibold text-error">Cancelar solicitud</button>}</article>)}</section>
  </div></main>;
}
