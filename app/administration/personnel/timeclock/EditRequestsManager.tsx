"use client";

import { useState } from "react";
import { reviewTimeClockEditRequestAction } from "@/app/actions/timeclock";
import { useToast } from "@/components/ui/Toast";
import { CheckIcon, XIcon } from "@/components/ui/icons";

type EditRequest = {
  id: string;
  reason: string | null;
  originalClockIn: string;
  originalClockOut: string | null;
  requestedClockIn: string;
  requestedClockOut: string;
  user: { id: string; name: string };
  timeClock: { branch: { id: string; name: string } };
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function EditRequestsManager({
  initialRequests,
}: {
  initialRequests: EditRequest[];
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  async function review(requestId: string, approve: boolean) {
    setSaving(true);
    setError(null);

    const result = await reviewTimeClockEditRequestAction(requestId, approve, note);

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setRequests((prev) => prev.filter((r) => r.id !== requestId));
    setReviewingId(null);
    setNote("");
    showToast(approve ? "Corrección aplicada al turno." : "Solicitud rechazada.");
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-outline-variant p-8 text-center text-on-surface-variant">
        No hay solicitudes de corrección pendientes.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => {
        const isReviewing = reviewingId === request.id;

        return (
          <div
            key={request.id}
            className="rounded-2xl border border-secondary/30 bg-surface-container p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-on-surface">{request.user.name}</p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {request.timeClock.branch.name}
                </p>

                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-outline">
                      Registrado
                    </p>
                    <p className="text-on-surface-variant">
                      {formatDateTime(request.originalClockIn)}
                      {request.originalClockOut ? ` — ${formatDateTime(request.originalClockOut)}` : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Solicitado
                    </p>
                    <p className="text-on-surface">
                      {formatDateTime(request.requestedClockIn)} — {formatDateTime(request.requestedClockOut)}
                    </p>
                  </div>
                </div>

                {request.reason && (
                  <p className="mt-3 text-sm text-on-surface-variant">
                    Motivo: {request.reason}
                  </p>
                )}
              </div>

              {!isReviewing && (
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => {
                      setReviewingId(request.id);
                      setNote("");
                      setError(null);
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-tertiary-fixed-dim px-3 py-2 text-sm font-semibold text-on-surface transition duration-150 ease-out hover:opacity-90 hover:scale-[1.04] active:scale-[0.97]"
                  >
                    <CheckIcon className="h-4 w-4" />
                    Revisar
                  </button>
                </div>
              )}
            </div>

            {isReviewing && (
              <div className="mt-4 space-y-3 border-t border-outline-variant pt-4">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-on-surface-variant">
                    Nota (opcional)
                  </span>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                  />
                </label>

                {error && <p className="text-sm text-error">{error}</p>}

                <div className="flex gap-3">
                  <button
                    onClick={() => review(request.id, true)}
                    disabled={saving}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100"
                  >
                    <CheckIcon className="h-4 w-4" />
                    {saving ? "Guardando..." : "Aprobar y aplicar"}
                  </button>
                  <button
                    onClick={() => review(request.id, false)}
                    disabled={saving}
                    className="flex items-center justify-center gap-2 rounded-xl border border-error/40 px-4 py-3 font-semibold text-error transition duration-150 ease-out hover:scale-[1.04] hover:bg-error/10 active:scale-[0.97] disabled:opacity-60"
                  >
                    <XIcon className="h-4 w-4" />
                    Rechazar
                  </button>
                  <button
                    onClick={() => setReviewingId(null)}
                    className="rounded-xl border border-outline-variant px-4 py-3 text-on-surface-variant hover:border-outline-variant"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
