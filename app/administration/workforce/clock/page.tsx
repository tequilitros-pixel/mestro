import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/auth";
import { getAdminClockDashboard } from "@/lib/workforce/clock/admin";
import { AdminClockBoard } from "./AdminClockBoard";

const time = (value: string | null, timezone: string | null) =>
  value
    ? new Intl.DateTimeFormat("es-MX", {
        timeZone: timezone ?? "America/Mexico_City",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(value))
    : "Sin hora programada";

export default async function AdminClockPage() {
  const actor = await requireAdmin();
  const board = await getAdminClockDashboard({ id: actor.id, role: actor.role });
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-black">Checador</h1>
        <p className="text-sm text-on-surface-variant">Vista operativa de entradas activas y jornadas terminadas.</p>
      </header>

      <AdminClockBoard now={board.now.getTime()} working={board.working} completed={board.completed} />

      <section aria-labelledby="missed-clock-in-heading" className="space-y-3">
        <div>
          <h2 id="missed-clock-in-heading" className="text-xl font-black">Sin entrada registrada</h2>
          <p className="text-sm text-on-surface-variant">Se muestran sólo excepciones de asistencia abiertas; no se inventan registros.</p>
        </div>
        {board.missed.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {board.missed.map((row) => (
              <Card key={row.id} className="space-y-2">
                <h3 className="font-black">{row.name}</h3>
                <p className="text-sm">{row.branchName}</p>
                <p className="text-sm text-on-surface-variant">Hora esperada: {time(row.expectedStart, row.branchTimezone)}</p>
              </Card>
            ))}
          </div>
        ) : (
          <Card><p className="text-sm text-on-surface-variant">No hay excepciones abiertas de entrada hoy.</p></Card>
        )}
      </section>
    </section>
  );
}
