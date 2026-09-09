import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth";
import { getClockDashboard, listOwnCorrections } from "@/lib/workforce/clock/service";
import { formatZonedDateTimeLocal, formatZonedDateTimeParts } from "@/lib/workforce/clock/localDateTime";
import { correctionEventLabel, correctionLabel, correctionStatusLabels } from "@/lib/workforce/clock/requestPresentation";
import { RequestForm } from "./RequestForm";

export default async function WorkforceRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const query = await searchParams;
  let dashboard;
  try {
    dashboard = await getClockDashboard({ id: user.id, role: user.role });
  } catch (error) {
    return <Card><h2 className="font-bold">Solicitudes no disponibles</h2><p>{error instanceof Error ? error.message : "No se pudo resolver tu identidad laboral."}</p></Card>;
  }
  const requests = await listOwnCorrections({ id: user.id, role: user.role });
  const branches = [...dashboard.branches, ...dashboard.shifts.map((shift) => shift.branch).filter((candidate) => !dashboard.branches.some((item) => item.id === candidate.id))];
  const branchById = new Map(branches.map((branch) => [branch.id, branch]));
  const timezone = branches[0]?.timezone ?? dashboard.companyTimezone ?? "America/Mexico_City";
  const defaultParts = formatZonedDateTimeParts(dashboard.displayNow, timezone);
  const events = dashboard.displayEvents
    .filter((event) => Boolean(event.originalClockEventId) && (event.type === "CLOCK_IN" || event.type === "CLOCK_OUT"))
    .map((event) => {
      const branch = branchById.get(event.branchId);
      const eventParts = formatZonedDateTimeParts(event.occurredAt, branch?.timezone ?? timezone);
      return {
        id: event.originalClockEventId!,
        type: event.type as "CLOCK_IN" | "CLOCK_OUT",
        branchId: event.branchId,
        branchName: branch?.name ?? "Sucursal",
        date: eventParts.date,
        time: eventParts.time,
        label: `${correctionEventLabel(event.type)} · ${formatZonedDateTimeLocal(event.occurredAt, branch?.timezone ?? timezone)}`,
      };
    });
  return (
    <section className="mx-auto max-w-2xl space-y-5">
      {query.saved ? <p role="status" className="rounded-xl bg-primary/10 p-3 font-semibold">{query.saved}</p> : null}
      {query.error ? <p role="alert" className="rounded-xl bg-error/10 p-3 font-semibold text-error">{query.error}</p> : null}
      <header><Link href="/workforce/clock" className="text-sm font-semibold text-on-surface-variant">← Checador</Link><h2 className="mt-2 text-3xl font-black">Solicitudes</h2><p className="mt-1 text-sm text-on-surface-variant">Algo está mal → solicita que lo corrijan. Tus horas no cambian hasta que un administrador revise la solicitud.</p></header>
      {branches.length ? <RequestForm branches={branches.map((branch) => ({ id: branch.id, name: branch.name, timezone: branch.timezone }))} events={events} defaultBranchId={branches[0].id} defaultDate={defaultParts.date} defaultTime={defaultParts.time} /> : <Card>No hay una sucursal laboral disponible para crear una solicitud.</Card>}
      <section className="space-y-3"><h3 className="text-xl font-black">Mis solicitudes</h3>{requests.length ? requests.map((item) => {
        const itemTimezone = item.branch?.timezone ?? item.targetClockEvent?.branch.timezone ?? timezone;
        const current = item.targetClockEvent ? `${correctionEventLabel(item.targetClockEvent.type)} · ${formatZonedDateTimeLocal(item.targetClockEvent.deviceOccurredAt, itemTimezone)}` : "Sin registro";
        const requested = item.proposedOccurredAt ? `${correctionEventLabel(item.proposedEventType)} · ${formatZonedDateTimeLocal(item.proposedOccurredAt, itemTimezone)}` : "Sin cambio de hora";
        return <article key={item.id} className="rounded-xl border border-outline-variant bg-surface-container p-4"><div className="flex items-start justify-between gap-3"><div><h4 className="font-bold">{correctionLabel(item.type, item.proposedEventType)}</h4><p className="text-sm text-on-surface-variant">{item.branch?.name ?? item.targetClockEvent?.branch.name ?? "Sin sucursal"} · {formatZonedDateTimeLocal(item.requestedAt, itemTimezone)}</p></div><span className="shrink-0 rounded-full border px-3 py-1 text-xs font-bold">{correctionStatusLabels[item.status] ?? "Solicitud"}</span></div><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><p><strong>Registrado</strong><br />{current}</p><p><strong>Solicitado</strong><br />{requested}</p></div><p className="mt-3 text-sm">{item.reason}</p>{item.status === "REJECTED" && item.rejectionReason ? <p className="mt-2 text-sm text-error"><strong>Motivo:</strong> {item.rejectionReason}</p> : null}{item.status === "APPROVED" ? <p className="mt-2 text-sm text-primary">Aprobada por administrador.</p> : null}</article>;
      }) : <Card><p className="text-sm text-on-surface-variant">Aún no tienes solicitudes.</p></Card>}</section>
    </section>
  );
}
