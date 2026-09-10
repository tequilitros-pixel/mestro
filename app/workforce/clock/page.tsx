import { ClockStatus } from "./ClockStatus";
import { clockError, clockSuccess, userClockEventLabel } from "./presentation";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth";
import { getClockDashboard } from "@/lib/workforce/clock/service";
import { resolveBranchGeofencePolicy } from "@/lib/workforce/geofence";
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
                requiresLocation: primary === "CLOCK_IN"
                  ? resolveBranchGeofencePolicy(item, dashboard.locationPolicy).requireGeolocationClockIn
                  : primary === "CLOCK_OUT"
                    ? resolveBranchGeofencePolicy(item, dashboard.locationPolicy).requireGeolocationClockOut
                    : false,
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
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold">¿Algo no coincide?</h2><p className="text-sm text-on-surface-variant">Solicita una corrección sin modificar tus horas de inmediato.</p></div><Link href="/workforce/requests" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary px-4 py-3 font-bold text-primary">Solicitar corrección</Link></div>
      </Card>
    </section>
  );
}
