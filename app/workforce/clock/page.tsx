import { ClockStatus } from "./ClockStatus";
import { clockError, clockSuccess, userClockEventLabel } from "./presentation";
import { randomUUID } from "node:crypto";
import { Card } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth";
import { getClockDashboard } from "@/lib/workforce/clock/service";
import {
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
  const primary = dashboard.state === "NO_SESSION"
    ? "CLOCK_IN"
    : dashboard.state === "CLOCKED_IN"
      ? "CLOCK_OUT"
      : null;
  const label = primary === "CLOCK_IN" ? "Iniciar turno" : primary === "CLOCK_OUT" ? "Terminar turno" : null;
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
  const preferredBranchId = dashboard.state === "NO_SESSION"
    ? dashboard.shifts[0]?.branchId
    : dashboard.displayEvents.at(-1)?.branchId;
  const branch = availableBranches.find((item) => item.id === preferredBranchId)
    ?? dashboard.shifts[0]?.branch
    ?? dashboard.branches[0];
  const formatShiftTime = (value: Date, timezone: string | null | undefined) =>
    new Intl.DateTimeFormat("es-MX", {
      timeZone: timezone ?? dashboardTimezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(value);
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
          {clockError(query.error)}
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
            {formatShiftTime(dashboard.shifts[0].startAt, dashboard.shifts[0].branch.timezone)}
            –
            {formatShiftTime(dashboard.shifts[0].endAt, dashboard.shifts[0].branch.timezone)}
          </p>
        ) : (
          <p className="border-t border-outline-variant pt-3 text-sm font-semibold text-on-surface-variant">
            Trabajo no programado · permitido por la política actual.
          </p>
        )}
      </Card>
      {branch ? (
        <Card className="space-y-3">
          {primary && label ? (
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
          ) : null}
        </Card>
      ) : (
        <Card>No hay sucursal autorizada ni Shift publicado cercano.</Card>
      )}
      <div id="solicitudes">
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
                    {userClockEventLabel(dashboard.lastEvent.type)} ·{" "}
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
      </div>
    </section>
  );
}
