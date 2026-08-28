import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { requireModuleAccess } from "@/lib/auth";
import { headers } from "next/headers";
import { workforceV1Enabled } from "@/lib/workforce/config";

export default async function WorkforceV1Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!workforceV1Enabled()) notFound();
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (pathname.startsWith("/administration/workforce-v1/schedule"))
    await requireModuleAccess("/administration/schedule");
  else await requireAdmin();
  return (
    <main className="mx-auto w-full max-w-7xl p-4 sm:p-6">
      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Workforce V1 · DEV
          </p>
          <h1 className="text-2xl font-bold sm:text-3xl">
            Personal y relaciones laborales
          </h1>
          <p className="text-sm text-on-surface-variant">
            Fuente laboral V1 aislada; el runtime legacy permanece separado.
          </p>
        </div>
        <nav className="flex gap-2 overflow-x-auto pb-1">
          <Link
            className="whitespace-nowrap rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold"
            href="/administration/workforce-v1"
          >
            Empleados
          </Link>
          <Link
            className="whitespace-nowrap rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold"
            href="/administration/workforce-v1/availability"
          >
            Disponibilidad
          </Link>
          <Link
            className="whitespace-nowrap rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold"
            href="/administration/workforce-v1/schedule"
          >
            Horario
          </Link>
          <Link
            className="whitespace-nowrap rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold"
            href="/administration/workforce-v1/clock-corrections"
          >
            Correcciones
          </Link>
          <Link
            className="whitespace-nowrap rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold"
            href="/administration/workforce-v1/attendance"
          >
            Asistencia
          </Link>
          <Link
            className="whitespace-nowrap rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold"
            href="/administration/workforce-v1/timesheets"
          >
            Timesheets
          </Link>
          <Link
            className="whitespace-nowrap rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold"
            href="/administration/workforce-v1/settings"
          >
            Configuración
          </Link>
          <Link
            className="whitespace-nowrap rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold"
            href="/administration/workforce-v1/overtime"
          >
            Overtime
          </Link>
          <Link
            className="whitespace-nowrap rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary"
            href="/administration/workforce-v1/employees/new"
          >
            Crear empleado
          </Link>
        </nav>
      </header>
      {children}
    </main>
  );
}
