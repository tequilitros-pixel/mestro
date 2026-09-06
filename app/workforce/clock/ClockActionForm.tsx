"use client";

import { useRef, useState } from "react";
import { workforceClockAction } from "@/app/actions/workforceClock";

type BranchOption = {
  id: string;
  name: string;
  requiresLocation: boolean;
};

export function ClockActionForm({
  branches,
  defaultBranchId,
  type,
  idempotencyKey,
  returnTo,
  label,
}: {
  branches: BranchOption[];
  defaultBranchId: string;
  type: "CLOCK_IN" | "BREAK_END" | "CLOCK_OUT";
  idempotencyKey: string;
  returnTo: string;
  label: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [locating, setLocating] = useState(false);
  const [ready, setReady] = useState(false);

  async function prepare(event: React.FormEvent<HTMLFormElement>) {
    if (ready || type === "BREAK_END") return;
    event.preventDefault();
    const requiresLocation = branches.find((branch) => branch.id === branchId)?.requiresLocation;
    const input = formRef.current?.elements.namedItem("location") as HTMLInputElement | null;
    if (!input) return;
    setLocating(true);
    if (!requiresLocation) {
      input.value = JSON.stringify({ failure: "UNAVAILABLE" });
    } else if (!navigator.geolocation) {
      input.value = JSON.stringify({ failure: "UNAVAILABLE" });
    } else {
      input.value = await new Promise<string>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve(JSON.stringify({
            sample: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracyMeters: position.coords.accuracy,
              checkedAt: new Date(position.timestamp).toISOString(),
            },
          })),
          (error) => resolve(JSON.stringify({
            failure: error.code === error.PERMISSION_DENIED ? "PERMISSION_DENIED" : "UNAVAILABLE",
          })),
          { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
        );
      });
    }
    setReady(true);
    setLocating(false);
    requestAnimationFrame(() => formRef.current?.requestSubmit());
  }

  return <form ref={formRef} action={workforceClockAction} onSubmit={prepare} className="space-y-3">
    <input type="hidden" name="returnTo" value={returnTo} />
    <input type="hidden" name="type" value={type} />
    <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
    <input type="hidden" name="location" />
    <label className="block text-sm font-semibold">Sucursal
      <select name="branchId" value={branchId} onChange={(event) => { setBranchId(event.target.value); setReady(false); }} className="mt-1 w-full rounded-lg border border-outline-variant bg-surface p-3">
        {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
      </select>
    </label>
    <button disabled={locating} className="min-h-14 w-full rounded-xl bg-primary px-5 py-4 text-lg font-bold text-on-primary disabled:opacity-60">{locating ? "Verificando ubicación…" : label}</button>
    {branches.find((branch) => branch.id === branchId)?.requiresLocation && type !== "BREAK_END" ? <p className="text-center text-xs text-on-surface-variant">Tu ubicación se consulta una sola vez para esta checada. No se guardan tus coordenadas exactas.</p> : null}
  </form>;
}
