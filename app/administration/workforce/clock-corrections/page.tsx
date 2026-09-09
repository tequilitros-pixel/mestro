import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listCorrections } from "@/lib/workforce/clock/service";
import { workforceCorrectionDecisionAction } from "@/app/actions/workforceClock";
import { formatZonedDateTimeLocal } from "@/lib/workforce/clock/localDateTime";
import { correctionEventLabel, correctionLabel, correctionStatusLabels } from "@/lib/workforce/clock/requestPresentation";

type StatusFilter = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

function dateRange(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return {};
  const start = new Date(`${value}T00:00:00.000Z`);
  return { requestedFrom: start, requestedTo: new Date(start.getTime() + 86_400_000) };
}

export default async function CorrectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; status?: string; branch?: string; date?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const status = (["PENDING", "APPROVED", "REJECTED", "ALL"] as const).includes(query.status as StatusFilter)
    ? query.status as StatusFilter
    : "PENDING";
  const [items, branches] = await Promise.all([
    listCorrections({
      status: status === "ALL" ? undefined : status,
      branchId: query.branch,
      ...dateRange(query.date),
    }),
    prisma.branch.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const back = "/administration/workforce/clock-corrections";
  const ordered = [...items].sort((a, b) => Number(a.status !== "PENDING") - Number(b.status !== "PENDING") || a.requestedAt.getTime() - b.requestedAt.getTime());
  return (
    <section className="space-y-4">
      {query.saved ? (
        <p role="status" className="rounded-xl bg-primary/10 p-3">
          {query.saved}
        </p>
      ) : null}
      {query.error ? (
        <p role="alert" className="rounded-xl bg-error/10 p-3 text-error">
          {query.error}
        </p>
      ) : null}
      <div>
        <h2 className="text-2xl font-black">Solicitudes</h2>
        <p className="text-sm text-on-surface-variant">
          Revisa lo que un trabajador pidió antes de cambiar sus horas. Los registros originales permanecen intactos.
        </p>
      </div>
      <Card>
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
          <label className="text-sm font-semibold">Estado<select name="status" defaultValue={status} className="mt-1 min-h-11 w-full rounded-lg border p-2"><option value="PENDING">Pendientes</option><option value="APPROVED">Aprobadas</option><option value="REJECTED">Rechazadas</option><option value="ALL">Todas</option></select></label>
          <label className="text-sm font-semibold">Sucursal<select name="branch" defaultValue={query.branch ?? ""} className="mt-1 min-h-11 w-full rounded-lg border p-2"><option value="">Todas las sucursales</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          <label className="text-sm font-semibold">Fecha<input type="date" name="date" defaultValue={query.date ?? ""} className="mt-1 min-h-11 w-full rounded-lg border p-2" /></label>
          <button className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary">Filtrar</button>
        </form>
      </Card>
      {ordered.length ? (
        ordered.map((item) => {
          const timezone = item.branch?.timezone ?? item.targetClockEvent?.branch.timezone ?? "America/Mexico_City";
          const branchName = item.branch?.name ?? item.targetClockEvent?.branch.name ?? "Sin sucursal";
          const current = item.targetClockEvent
            ? `${correctionEventLabel(item.targetClockEvent.type)} · ${formatZonedDateTimeLocal(item.targetClockEvent.deviceOccurredAt, timezone)}`
            : "Sin registro";
          const requested = item.proposedOccurredAt
            ? `${correctionEventLabel(item.proposedEventType)} · ${formatZonedDateTimeLocal(item.proposedOccurredAt, timezone)}`
            : "Sin cambio de hora";
          return (
          <Card key={item.id}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-bold">{item.employment.employee.displayName}</h3><p className="text-sm">{correctionLabel(item.type, item.proposedEventType)}</p></div><span className="rounded-full border px-3 py-1 text-xs font-bold">{correctionStatusLabels[item.status] ?? "Solicitud"}</span></div>
            <p className="mt-2 text-sm text-on-surface-variant">{branchName} · solicitada {formatZonedDateTimeLocal(item.requestedAt, timezone)} · por {item.requestedBy.name ?? "Empleado"}</p>
            <div className="mt-3 grid gap-3 rounded-lg bg-surface-container p-3 sm:grid-cols-2"><p className="text-sm"><strong>Registro actual</strong><br />{current}</p><p className="text-sm"><strong>Lo que solicita</strong><br />{requested}</p></div>
            <p className="mt-3 text-sm"><strong>Comentario:</strong> {item.reason}</p>
            <p className="mt-2 text-xs text-on-surface-variant">Horario publicado: se conserva en los hechos de reloj y se revisa antes de decidir.</p>
            {item.status === "PENDING" ? <form action={workforceCorrectionDecisionAction} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end"><input type="hidden" name="returnTo" value={back} /><input type="hidden" name="correctionId" value={item.id} /><label className="text-sm">Motivo si se rechaza<input name="rejectionReason" placeholder="Escribe un motivo" className="mt-1 min-h-11 w-full rounded-lg border p-2" /></label><button name="decision" value="APPROVED" className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary">Aprobar</button><button name="decision" value="REJECTED" className="min-h-11 rounded-lg border border-error px-4 font-bold text-error">Rechazar</button></form> : item.status === "REJECTED" ? <p className="mt-3 text-sm text-error"><strong>Motivo:</strong> {item.rejectionReason ?? "Sin motivo registrado"} {item.rejectedBy?.name ? `· ${item.rejectedBy.name}` : ""}</p> : item.status === "APPROVED" ? <p className="mt-3 text-sm text-primary">Aprobada {item.approvedBy?.name ? `por ${item.approvedBy.name}` : "por administrador"}. Las horas se recalcularon mediante el flujo canónico.</p> : null}
          </Card>
          );
        })
      ) : (
        <Card>No hay solicitudes para estos filtros.</Card>
      )}
    </section>
  );
}
