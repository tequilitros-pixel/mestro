import { randomUUID } from "node:crypto";
import { Card } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth";
import { getClockDashboard } from "@/lib/workforce/clock/service";
import {
  workforceClockAction,
  workforceCorrectionRequestAction,
} from "@/app/actions/workforceClock";

const button =
  "min-h-14 w-full rounded-xl bg-primary px-5 py-4 text-lg font-bold text-on-primary";
export default async function ClockPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const query = await searchParams;
  let dashboard;
  try {
    dashboard = await getClockDashboard({ id: user.id, role: user.role });
  } catch (error) {
    return (
      <Card>
        <h2 className="font-bold">Reloj no disponible</h2>
        <p>
          {error instanceof Error
            ? error.message
            : "Identidad laboral inválida."}
        </p>
      </Card>
    );
  }
  const branch = dashboard.shifts[0]?.branch ?? dashboard.branches[0];
  const primary =
    dashboard.state === "NO_SESSION"
      ? "CLOCK_IN"
      : dashboard.state === "ON_BREAK"
        ? "BREAK_END"
        : "CLOCK_OUT";
  const label = {
    CLOCK_IN: "Registrar entrada",
    BREAK_END: "Terminar descanso",
    CLOCK_OUT: "Registrar salida",
  }[primary];
  const back = "/workforce-v1/clock";
  return (
    <section className="mx-auto max-w-xl space-y-4">
      {query.saved ? (
        <p role="status" className="rounded-xl bg-primary/10 p-3 font-semibold">
          {query.saved}
        </p>
      ) : null}
      {query.error ? (
        <p
          role="alert"
          className="rounded-xl bg-error/10 p-3 font-semibold text-error"
        >
          {query.error}
        </p>
      ) : null}
      <Card className="space-y-3 text-center">
        <p className="text-sm text-on-surface-variant">Estado actual</p>
        <h2 className="text-3xl font-black">{dashboard.state}</h2>
        <p>{dashboard.employment.employee.displayName}</p>
        {dashboard.shifts[0] ? (
          <p className="rounded-lg bg-surface-container p-3 text-sm">
            Turno publicado · {dashboard.shifts[0].branch.name}
            <br />
            {dashboard.shifts[0].startAt.toLocaleTimeString("es-MX", {
              hour: "2-digit",
              minute: "2-digit",
            })}
            –
            {dashboard.shifts[0].endAt.toLocaleTimeString("es-MX", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        ) : (
          <p className="rounded-lg bg-secondary/10 p-3 text-sm">
            Sin turno publicado cercano · trabajo no programado permitido con
            advertencia.
          </p>
        )}
      </Card>
      {branch ? (
        <Card className="space-y-3">
          <form action={workforceClockAction} className="space-y-3">
            <input type="hidden" name="returnTo" value={back} />
            <input type="hidden" name="type" value={primary} />
            <input type="hidden" name="idempotencyKey" value={randomUUID()} />
            <label className="block text-sm font-semibold">
              Sucursal
              <select
                name="branchId"
                defaultValue={branch.id}
                className="mt-1 w-full rounded-lg border border-outline-variant bg-surface p-3"
              >
                {dashboard.branches.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
                {dashboard.shifts
                  .filter(
                    (s) => !dashboard.branches.some((b) => b.id === s.branchId),
                  )
                  .map((s) => (
                    <option key={s.branchId} value={s.branchId}>
                      {s.branch.name} · turno
                    </option>
                  ))}
              </select>
            </label>
            <button className={button}>{label}</button>
          </form>
          {dashboard.state === "CLOCKED_IN" ? (
            <form action={workforceClockAction}>
              <input type="hidden" name="returnTo" value={back} />
              <input type="hidden" name="branchId" value={branch.id} />
              <input type="hidden" name="type" value="BREAK_START" />
              <input type="hidden" name="idempotencyKey" value={randomUUID()} />
              <button className="min-h-12 w-full rounded-xl border border-outline-variant px-4 py-3 font-bold">
                Iniciar descanso
              </button>
            </form>
          ) : null}
        </Card>
      ) : (
        <Card>No hay sucursal autorizada ni Shift publicado cercano.</Card>
      )}
      <Card>
        <details>
          <summary className="cursor-pointer font-bold">
            Solicitar corrección
          </summary>
          <form
            action={workforceCorrectionRequestAction}
            className="mt-3 space-y-2"
          >
            <input type="hidden" name="returnTo" value={back} />
            <label className="block text-sm">
              Tipo
              <select name="type" className="mt-1 w-full rounded-lg border p-3">
                <option value="ADD_MISSING_EVENT">Evento faltante</option>
                <option value="MODIFY_OCCURRED_TIME">Hora incorrecta</option>
                <option value="VOID_EVENT">Evento duplicado</option>
              </select>
            </label>
            <label className="block text-sm">
              Evento observado
              <select
                name="targetClockEventId"
                className="mt-1 w-full rounded-lg border p-3"
              >
                <option value="">No aplica</option>
                {dashboard.lastEvent ? (
                  <option
                    value={dashboard.lastEvent.originalClockEventId ?? ""}
                  >
                    {dashboard.lastEvent.type} ·{" "}
                    {dashboard.lastEvent.occurredAt.toISOString()}
                  </option>
                ) : null}
              </select>
            </label>
            <input type="hidden" name="branchId" value={branch?.id ?? ""} />
            <label className="block text-sm">
              Evento propuesto
              <select
                name="proposedEventType"
                className="mt-1 w-full rounded-lg border p-3"
              >
                <option value="CLOCK_IN">CLOCK_IN</option>
                <option value="BREAK_START">BREAK_START</option>
                <option value="BREAK_END">BREAK_END</option>
                <option value="CLOCK_OUT">CLOCK_OUT</option>
              </select>
            </label>
            <label className="block text-sm">
              Hora propuesta
              <input
                name="proposedOccurredAt"
                type="datetime-local"
                className="mt-1 w-full rounded-lg border p-3"
              />
            </label>
            <label className="block text-sm">
              Razón
              <textarea
                required
                minLength={5}
                name="reason"
                className="mt-1 w-full rounded-lg border p-3"
              />
            </label>
            <button className="min-h-12 w-full rounded-xl border border-primary px-4 py-3 font-bold text-primary">
              Enviar solicitud
            </button>
          </form>
        </details>
      </Card>
    </section>
  );
}
