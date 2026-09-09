"use client";

import { useRef, useState } from "react";
import { workforceKioskClockAction } from "@/app/actions/workforceClock";

export function KioskClockForm({
  branchId,
  requiresLocation,
  employees,
  idempotencyKey,
}: {
  branchId: string;
  requiresLocation: boolean;
  employees: { id: string; name: string; hasOpenShift: boolean }[];
  idempotencyKey: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [userId, setUserId] = useState("");
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  async function prepare(event: React.FormEvent<HTMLFormElement>) {
    if (ready) return;
    event.preventDefault();
    const input = formRef.current?.elements.namedItem("location") as HTMLInputElement | null;
    if (!input) return;
    setLocating(true);
    if (!requiresLocation || !navigator.geolocation) {
      input.value = JSON.stringify({ failure: "UNAVAILABLE" });
    } else {
      input.value = await new Promise<string>((resolve) => navigator.geolocation.getCurrentPosition(
        (position) => resolve(JSON.stringify({ sample: { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyMeters: position.coords.accuracy, checkedAt: new Date(position.timestamp).toISOString() } })),
        (error) => resolve(JSON.stringify({ failure: error.code === error.PERMISSION_DENIED ? "PERMISSION_DENIED" : "UNAVAILABLE" })),
        { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
      ));
    }
    setReady(true);
    setLocating(false);
    requestAnimationFrame(() => formRef.current?.requestSubmit());
  }
  const selectedEmployee = employees.find((employee) => employee.id === userId);
  return <form ref={formRef} action={workforceKioskClockAction} onSubmit={prepare} className="space-y-3">
    <input type="hidden" name="returnTo" value={`/workforce/kiosk?branchId=${branchId}`} />
    <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
    <input type="hidden" name="branchId" value={branchId} />
    <input type="hidden" name="location" />
    <label className="block font-semibold">Empleado<select required name="userId" value={userId} onChange={(event) => { setUserId(event.target.value); setReady(false); }} className="mt-1 w-full rounded-xl border p-4"><option value="">Selecciona</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
    <label className="block font-semibold">PIN<input required name="pin" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} className="mt-1 w-full rounded-xl border p-4 text-center text-2xl tracking-[0.5em]" /></label>
    <button disabled={locating || !selectedEmployee} className="min-h-16 w-full rounded-xl bg-primary p-4 text-xl font-black text-on-primary disabled:opacity-60">{locating ? "Verificando ubicación…" : selectedEmployee?.hasOpenShift ? "Terminar turno" : "Iniciar turno"}</button>
    {requiresLocation ? <p className="text-center text-xs text-on-surface-variant">Lectura puntual para esta checada; no se guardan coordenadas exactas.</p> : null}
  </form>;
}
