import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/auth";
import { listPendingCorrections } from "@/lib/workforce/clock/service";
import { workforceCorrectionDecisionAction } from "@/app/actions/workforceClock";

export default async function CorrectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await requireAdmin();
  const [query, items] = await Promise.all([
    searchParams,
    listPendingCorrections(),
  ]);
  const back = "/administration/workforce-v1/clock-corrections";
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
        <h2 className="text-2xl font-black">Correcciones de reloj</h2>
        <p className="text-sm text-on-surface-variant">
          Decisiones administrativas; ClockEvent original permanece intacto.
        </p>
      </div>
      {items.length ? (
        items.map((item) => (
          <Card key={item.id}>
            <h3 className="font-bold">
              {item.employment.employee.displayName} · {item.type}
            </h3>
            <p className="text-sm">{item.reason}</p>
            <p className="text-xs text-on-surface-variant">
              {item.branch?.name ??
                item.targetClockEvent?.branchId ??
                "Sin branch"}{" "}
              · solicitado por {item.requestedBy.name}
            </p>
            <form
              action={workforceCorrectionDecisionAction}
              className="mt-3 flex flex-col gap-2 sm:flex-row"
            >
              <input type="hidden" name="returnTo" value={back} />
              <input type="hidden" name="correctionId" value={item.id} />
              <input
                name="rejectionReason"
                placeholder="Razón si se rechaza"
                className="min-h-11 flex-1 rounded-lg border p-2"
              />
              <button
                name="decision"
                value="APPROVED"
                className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary"
              >
                Aprobar
              </button>
              <button
                name="decision"
                value="REJECTED"
                className="min-h-11 rounded-lg border border-error px-4 font-bold text-error"
              >
                Rechazar
              </button>
            </form>
          </Card>
        ))
      ) : (
        <Card>No hay solicitudes pendientes.</Card>
      )}
    </section>
  );
}
