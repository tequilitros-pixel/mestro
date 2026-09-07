import { ClockStatus } from "./ClockStatus";
import { clockEventLabels, clockSuccess } from "./presentation";
import { randomUUID } from "node:crypto";
import { Card } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth";
import { getClockDashboard } from "@/lib/workforce/clock/service";
import {
  workforceClockAction,
  workforceCorrectionRequestAction,
} from "@/app/actions/workforceClock";
import { ClockActionForm } from "./ClockActionForm";

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
  const back = "/workforce/clock";
  const availableBranches = [
    ...dashboard.branches,
    ...dashboard.shifts
      .map((shift) => shift.branch)
      .filter((candidate) => !dashboard.branches.some((item) => item.id === candidate.id)),
  ];
  const requiresForAction = primary === "CLOCK_IN"
    ? dashboard.locationPolicy.requireGeolocationClockIn
    : primary === "CLOCK_OUT"
      ? dashboard.locationPolicy.requireGeolocationClockOut
      : false;
  const dashboardTimezone = dashboard.companyTimezone ?? "America/Mexico_City";
  return (
    <section className="mx-auto max-w-xl space-y-4">
      {query.saved ? (
        <p role="status" className="rounded-xl bg-primary/10 p-3 font-semibold">
          {query.saved === "Evento registrado." || query.saved === "Operación ya registrada." ? clockSuccess(dashboard.lastEvent?.type) : query.saved}
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
        <ClockStatus
          events={dashboard.displayEvents.map((event) => ({
            type: event.type,
            occurredAt: event.occurredAt.toISOString(),
            branchId: event.branchId,
          }))}
          name={dashboard.employment.employee.displayName ?? "Empleado"}
          branches={availableBranches.map((item) => ({
            id: item.id,
            name: item.name,
            timezone: item.timezone ?? dashboardTimezone,
          }))}
          serverNow={dashboard.displayNow.getTime()}
          state={dashboard.state}
        />
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
          <p className="border-t border-outline-variant pt-3 text-xs text-on-surface-variant">
            Sin turno publicado cercano · trabajo no programado permitido con
            advertencia.
          </p>
        )}
      </Card>
      {branch ? (
        <Card className="space-y-3">
          <ClockActionForm
            branches={availableBranches.map((item) => ({
              id: item.id,
              name: item.name,
              requiresLocation: Boolean(requiresForAction && item.geofenceEnabled && item.geofenceId),
            }))}
            defaultBranchId={branch.id}
            type={primary}
            idempotencyKey={randomUUID()}
            returnTo={back}
            label={label}
          />
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
                    {clockEventLabels[dashboard.lastEvent.type]??"Evento"} ·{" "}
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
                <option value="CLOCK_IN">Entrada</option>
                <option value="BREAK_START">Inicio de descanso</option>
                <option value="BREAK_END">Fin de descanso</option>
                <option value="CLOCK_OUT">Salida</option>
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
