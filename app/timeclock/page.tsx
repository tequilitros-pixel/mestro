import ClockWidget from "./ClockWidget";
import Link from "next/link";
import { ArrowRightIcon, CalendarIcon, ClockIcon, ReceiptIcon } from "@/components/ui/icons";
import { getCurrentUser } from "@/lib/auth";
import { getUserModuleKeys } from "@/app/actions/permissions";
import { canAccessModule } from "@/lib/permission-modules";

export default async function TimeClockPage() {
  const user = await getCurrentUser();
  const moduleKeys = user && user.role !== "ADMIN" ? await getUserModuleKeys(user.id) : [];

  const role = user?.role ?? "OPERATOR";

  const canAvailability = canAccessModule(role, moduleKeys, "/timeclock/availability");
  const canHours = canAccessModule(role, moduleKeys, "/timeclock/hours");
  const canPayroll = canAccessModule(role, moduleKeys, "/timeclock/payroll") || canHours;
  const canHistory = canAccessModule(role, moduleKeys, "/timeclock/history");
  const canKiosk = canAccessModule(role, moduleKeys, "/timeclock/kiosk");

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Checador</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Registra tu entrada y salida.
          </p>
        </div>

        <ClockWidget />

        <nav className="grid gap-3" aria-label="Información personal del checador">
          {canAvailability && (
            <TimeclockLink
              href="/timeclock/availability"
              icon={<CalendarIcon className="h-5 w-5" />}
              title="Mi disponibilidad"
              description="Indica con anticipación cuándo puedes trabajar."
            />
          )}
          {canHours && (
            <TimeclockLink
              href="/timeclock/hours"
              icon={<ClockIcon className="h-5 w-5" />}
              title="Horas de esta semana"
              description="Consulta tus horas y pago estimado actuales."
            />
          )}
          {canPayroll && (
            <TimeclockLink
              href="/timeclock/payroll"
              icon={<ReceiptIcon className="h-5 w-5" />}
              title="Mi nómina y pagos"
              description="Revisa tus semanas aprobadas y recibos."
            />
          )}
          {canHistory && (
            <TimeclockLink
              href="/timeclock/history"
              icon={<ReceiptIcon className="h-5 w-5" />}
              title="Ver historial"
              description="Revisa entradas, salidas y solicita correcciones."
            />
          )}
        </nav>

        {canKiosk && (
          <p className="text-center text-xs text-on-surface-variant">
            ¿Estás en un dispositivo compartido de la sucursal?{" "}
            <Link href="/timeclock/kiosk" className="font-semibold text-primary underline">
              Usar modo kiosco
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}

function TimeclockLink({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-outline-variant bg-surface-container p-4 transition-[transform,border-color,background-color] duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:border-primary/35 hover:bg-surface-container-high active:scale-[0.98]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-on-surface">{title}</span>
        <span className="mt-0.5 block text-xs text-on-surface-variant">{description}</span>
      </span>
      <ArrowRightIcon className="h-5 w-5 shrink-0 text-on-surface-variant transition-transform duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5" />
    </Link>
  );
}
