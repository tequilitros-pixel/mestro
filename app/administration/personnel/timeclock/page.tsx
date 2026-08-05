import Link from "next/link";
import {
  getOpenShiftsForAdmin,
  getRecentGeofenceAlerts,
} from "@/app/actions/timeclock";
import { ChevronLeftIcon } from "@/components/ui/icons";
import OpenShiftsManager from "./OpenShiftsManager";

export default async function OpenShiftsPage() {
  const [openShifts, geofenceAlerts] = await Promise.all([
    getOpenShiftsForAdmin(),
    getRecentGeofenceAlerts(),
  ]);

  const serialized = openShifts.map((entry: Awaited<ReturnType<typeof getOpenShiftsForAdmin>>[number]) => ({
    id: entry.id,
    clockIn: entry.clockIn.toISOString(),
    user: entry.user,
    branch: entry.branch,
  }));

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href="/administration/personnel"
          className="inline-flex w-fit items-center gap-2 text-sm text-on-surface-variant transition duration-150 ease-out hover:scale-[1.04] active:scale-[0.97] hover:text-on-surface"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Regresar a Personal
        </Link>

        <div>
          <h1 className="text-3xl font-bold">Turnos abiertos</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Empleados que checaron entrada pero no han checado salida.
            Si alguien olvidó cerrar su turno, ciérralo aquí para que
            pueda volver a checar entrada.
          </p>
        </div>

        <OpenShiftsManager initialShifts={serialized} />

        <div>
          <h2 className="text-xl font-bold text-on-surface">
            Alertas de ubicación
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Empleados que se alejaron del área de su sucursal mientras
            tenían un turno abierto.
          </p>

          {geofenceAlerts.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-outline-variant p-6 text-center text-sm text-on-surface-variant">
              Sin alertas recientes.
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {geofenceAlerts.map((alert: Awaited<ReturnType<typeof getRecentGeofenceAlerts>>[number]) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-error/20 bg-error/5 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-on-surface">
                      {alert.user.name}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {alert.branch.name} · a {alert.distance} m de la sucursal
                    </p>
                  </div>

                  <p className="shrink-0 text-xs text-error">
                    {new Date(alert.createdAt).toLocaleString("es-MX", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
