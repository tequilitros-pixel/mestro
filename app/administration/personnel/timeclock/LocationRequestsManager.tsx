"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reviewLocationRequestAction } from "@/app/actions/timeclock";
import { formatBusinessDateTime } from "@/lib/dateTime";
import { useToast } from "@/components/ui/Toast";
import { CheckIcon, XIcon } from "@/components/ui/icons";

type LocationRequest = {
  id: string;
  clockIn: string;
  clockOut: string | null;
  reason: string;
  user: { id: string; name: string };
  branch: { id: string; name: string };
};

export default function LocationRequestsManager({ initialRequests }: { initialRequests: LocationRequest[] }) {
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();
  const router = useRouter();
  const requests = initialRequests.filter((request) => !reviewedIds.includes(request.id));

  async function review(requestId: string, approve: boolean) {
    setSaving(true);
    setError(null);
    const result = await reviewLocationRequestAction(requestId, approve, note);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setReviewedIds((previous) => [...previous, requestId]);
    setReviewingId(null);
    setNote("");
    showToast(approve ? "Entrada sin ubicación aprobada." : "Entrada sin ubicación rechazada.");
  }

  return <div className="space-y-3">
    <button type="button" onClick={() => router.refresh()} className="text-sm font-semibold text-primary underline">Actualizar solicitudes</button>
    {!requests.length && <div className="rounded-2xl border border-dashed border-outline-variant p-8 text-center text-on-surface-variant">Sin entradas pendientes de ubicación.</div>}
    {requests.map((request) => <div key={request.id} className="rounded-2xl border border-secondary/30 bg-surface-container p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="font-semibold text-on-surface">{request.user.name} · {request.branch.name}</p>
          <p className="text-sm text-on-surface-variant">Entrada: {formatBusinessDateTime(request.clockIn)}</p>
          <p className="text-sm text-on-surface-variant">{request.clockOut ? `Salida: ${formatBusinessDateTime(request.clockOut)}` : "Turno aún abierto"}</p>
          {!request.clockOut && <p className="text-xs text-on-surface-variant">Podrás aprobar cuando el empleado registre la salida.</p>}
          <p className="pt-2 text-sm text-on-surface"><strong>Motivo:</strong> {request.reason}</p>
        </div>
        {reviewingId !== request.id && <button
          type="button"
          onClick={() => { setReviewingId(request.id); setNote(""); setError(null); }}
          className="shrink-0 rounded-xl bg-tertiary-fixed-dim px-3 py-2 text-sm font-semibold text-on-surface"
        >Revisar</button>}
      </div>
      {reviewingId === request.id && <div className="mt-4 space-y-3 border-t border-outline-variant pt-4">
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">Nota de administración (opcional)</span>
          <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none focus:border-primary" />
        </label>
        {error && <p className="text-sm text-error">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => review(request.id, true)} disabled={saving || !request.clockOut} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-on-primary disabled:opacity-60"><CheckIcon className="h-4 w-4" />Aprobar</button>
          <button type="button" onClick={() => review(request.id, false)} disabled={saving} className="flex items-center justify-center gap-2 rounded-xl border border-error/40 px-4 py-3 font-semibold text-error disabled:opacity-60"><XIcon className="h-4 w-4" />Rechazar</button>
          <button type="button" onClick={() => setReviewingId(null)} disabled={saving} className="rounded-xl border border-outline-variant px-4 py-3 text-on-surface-variant">Cancelar</button>
        </div>
      </div>}
    </div>)}
  </div>;
}
