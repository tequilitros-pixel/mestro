import { BoilerProcessType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatBusinessDateTime } from "@/lib/dateTime";
import { startBoilerProcessUsageAction, stopBoilerProcessUsageAction } from "@/app/boiler/actions";

export default async function ProcessBoilerUsage({
  processType,
  processId,
}: {
  processType: BoilerProcessType;
  processId: string;
}) {
  const [activeLink, boilerSessions] = await Promise.all([
    prisma.boilerProcessLink.findFirst({
      where: { processType, processId, endedAt: null },
      include: { boilerSession: { include: { equipment: { select: { name: true } } } } },
    }),
    prisma.boilerSession.findMany({
      where: { endedAt: null, equipment: { active: true, type: "CALDERA" } },
      include: { equipment: { select: { name: true } } },
      orderBy: { startedAt: "desc" },
    }),
  ]);

  return (
    <section className="mb-6 rounded-2xl border border-outline-variant bg-surface-container p-5 sm:p-8">
      <h2 className="text-xl font-bold">Uso de Caldera</h2>
      <p className="mt-2 text-sm text-on-surface-variant">Este intervalo alimenta el tiempo consumido por la etapa en la bitácora general de Caldera.</p>
      {activeLink ? (
        <div className="mt-4 flex flex-col gap-3 rounded-xl bg-surface-container-high p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm"><strong>{activeLink.boilerSession.equipment.name}</strong> · desde {formatBusinessDateTime(activeLink.startedAt)}</p>
          <form action={stopBoilerProcessUsageAction}>
            <input type="hidden" name="processType" value={processType} />
            <input type="hidden" name="processId" value={processId} />
            <button className="rounded-xl border border-secondary px-4 py-2 font-bold text-secondary">Detener uso</button>
          </form>
        </div>
      ) : boilerSessions.length > 0 ? (
        <form action={startBoilerProcessUsageAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="processType" value={processType} />
          <input type="hidden" name="processId" value={processId} />
          <label className="grid flex-1 gap-1 text-sm font-semibold">Caldera encendida<select name="boilerSessionId" className="rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3">{boilerSessions.map((session) => <option key={session.id} value={session.id}>{session.equipment.name} · {formatBusinessDateTime(session.startedAt)}</option>)}</select></label>
          <button className="rounded-xl bg-secondary px-4 py-3 font-bold text-on-secondary">Iniciar uso</button>
        </form>
      ) : (
        <p className="mt-4 rounded-xl bg-surface-container-high p-4 text-sm text-on-surface-variant">No hay una Caldera encendida. Enciéndela desde la sección Caldera antes de iniciar este intervalo.</p>
      )}
    </section>
  );
}
