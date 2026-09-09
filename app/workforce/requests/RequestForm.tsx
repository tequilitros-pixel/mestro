"use client";

import { useState } from "react";
import { workforceCorrectionRequestAction } from "@/app/actions/workforceClock";
import { requestKindLabels, requestKindToCorrection, type WorkforceRequestKind } from "@/lib/workforce/clock/requestPresentation";

type Branch = { id: string; name: string; timezone: string | null };
type EventOption = { id: string; type: "CLOCK_IN" | "CLOCK_OUT"; branchId: string; branchName: string; date: string; time: string; label: string };

export function RequestForm({
  branches,
  events,
  defaultBranchId,
  defaultDate,
  defaultTime,
}: {
  branches: Branch[];
  events: EventOption[];
  defaultBranchId: string;
  defaultDate: string;
  defaultTime: string;
}) {
  const [kind, setKind] = useState<WorkforceRequestKind>("MISSING_CLOCK_IN");
  const [targetId, setTargetId] = useState("");
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);
  const correction = requestKindToCorrection(kind);
  const targetEvents = correction.targetType ? events.filter((event) => event.type === correction.targetType) : events;
  function chooseKind(value: WorkforceRequestKind) {
    setKind(value);
    const next = requestKindToCorrection(value);
    const target = next.targetType ? events.find((event) => event.type === next.targetType) : undefined;
    setTargetId(target?.id ?? "");
    if (target) {
      setBranchId(target.branchId);
      setDate(target.date);
      setTime(target.time);
    }
  }
  function chooseTarget(id: string) {
    setTargetId(id);
    const target = events.find((event) => event.id === id);
    if (!target) return;
    setBranchId(target.branchId);
    setDate(target.date);
    setTime(target.time);
  }
  return <section className="rounded-xl border border-outline-variant bg-surface-container p-4"><h3 className="text-xl font-black">Nueva solicitud</h3><p className="mt-1 text-sm text-on-surface-variant">Elige el problema; no necesitas conocer conceptos técnicos.</p><form action={workforceCorrectionRequestAction} className="mt-4 space-y-3"><input type="hidden" name="returnTo" value="/workforce/requests" /><input type="hidden" name="type" value={correction.type} /><input type="hidden" name="proposedEventType" value={correction.proposedEventType ?? ""} /><label className="block text-sm font-semibold">¿Qué necesitas corregir?<select value={kind} onChange={(event) => chooseKind(event.target.value as WorkforceRequestKind)} className="mt-1 min-h-12 w-full rounded-lg border p-3">{Object.entries(requestKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{correction.requiresTarget ? <label className="block text-sm font-semibold">{kind === "OTHER" ? "Registro relacionado" : "Registro actual"}<select name="targetClockEventId" value={targetId} onChange={(event) => chooseTarget(event.target.value)} required className="mt-1 min-h-12 w-full rounded-lg border p-3"><option value="">Selecciona un registro</option>{targetEvents.map((event) => <option key={event.id} value={event.id}>{event.label} · {event.branchName}</option>)}</select></label> : null}<label className="block text-sm font-semibold">Sucursal<select name="branchId" value={branchId} onChange={(event) => setBranchId(event.target.value)} required className="mt-1 min-h-12 w-full rounded-lg border p-3">{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Fecha<input name="proposedDate" type="date" value={date} onChange={(event) => setDate(event.target.value)} required className="mt-1 min-h-12 w-full rounded-lg border p-3" /></label><label className="text-sm font-semibold">Hora correcta<input name="proposedTime" type="time" value={time} onChange={(event) => setTime(event.target.value)} required className="mt-1 min-h-12 w-full rounded-lg border p-3" /></label></div><label className="block text-sm font-semibold">Comentario <span className="font-normal text-on-surface-variant">(opcional)</span><textarea name="reason" rows={3} placeholder="Cuéntanos qué ocurrió" className="mt-1 w-full rounded-lg border p-3" /></label><button className="min-h-12 w-full rounded-xl bg-primary px-4 py-3 font-bold text-on-primary">Enviar solicitud</button></form></section>;
}
