import Link from "next/link";
import type { ComponentType } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getActiveProcesses } from "@/lib/brain/data/getActiveProcesses";
import { getRecordingStatus } from "@/lib/brain/getRecordingStatus";
import { prisma } from "@/lib/prisma";
import {
  type IconProps,
  FactoryIcon,
  FlaskIcon,
  WalletIcon,
  PackageIcon,
  ClockIcon,
  UsersIcon,
  AlertIcon,
  InfoIcon,
  CheckIcon,
  ChevronRightIcon,
  ArrowUpRightIcon,
  FlameIcon,
} from "@/components/ui/icons";

const TIME_ZONE = "America/Mexico_City";

type Alert = {
  icon: ComponentType<IconProps>;
  iconClass: string;
  title: string;
  subtitle: string;
  href: string;
};

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const [
    { cookings, millings, fermentations, distillations },
    recordingStatus,
    expiringBottles,
    lotsCount,
  ] = await Promise.all([
    getActiveProcesses(),
    getRecordingStatus(),
    getExpiringBottles(),
    prisma.lot.count(),
  ]);

  const now = new Date();

  const hour = Number(
    new Intl.DateTimeFormat("es-MX", {
      hour: "2-digit",
      hour12: false,
      timeZone: TIME_ZONE,
    }).format(now)
  );

  const greeting =
    hour >= 6 && hour < 12
      ? "Buenos días"
      : hour >= 12 && hour < 19
        ? "Buenas tardes"
        : "Buenas noches";

  const currentDate = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TIME_ZONE,
  }).format(now);

  const currentTime = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(now);

  const firstName = user.name.trim().split(/\s+/)[0] || "equipo";

  const activeProcesses =
    cookings.length +
    millings.length +
    fermentations.length +
    distillations.length;

  const alerts = buildAlerts(recordingStatus, expiringBottles);

  return (
    <main className="min-h-screen bg-background p-4 text-on-surface sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-6xl flex-col">
        {/* Saludo */}
        <div className="flex flex-col items-center py-6 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-on-surface-variant">
            {currentDate} · {currentTime}
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight text-primary sm:text-4xl">
            {greeting}, {firstName}.
          </h1>

          <p className="mt-2 text-lg text-on-surface-variant">
            ¿Qué necesita atención hoy?
          </p>

          <div className="mt-4 h-0.5 w-8 bg-primary/30" />
        </div>

        {/* Alertas de operación */}
        <section className="mb-8">
          <div className="surface-sheen overflow-hidden rounded-xl border border-outline-variant bg-surface-container-high/40 backdrop-blur">
            <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
              <h3 className="font-mono text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                Alertas de Operación
              </h3>

              {alerts.length > 0 && (
                <span className="flex h-2 w-2 rounded-full bg-error" />
              )}
            </div>

            <div className="flex flex-col divide-y divide-outline-variant">
              {alerts.length === 0 ? (
                <div className="flex items-center gap-3 p-4">
                  <CheckIcon className="h-5 w-5 shrink-0 text-tertiary-fixed-dim" />
                  <p className="text-sm font-semibold text-primary">
                    Todo en orden. Sin pendientes urgentes.
                  </p>
                </div>
              ) : (
                alerts.map((alert, i) => {
                  const AlertGlyph = alert.icon;
                  return (
                    <Link
                      key={i}
                      href={alert.href}
                      className="flex items-center gap-3 p-4 transition duration-150 ease-out hover:bg-surface-container-high/60"
                    >
                      <AlertGlyph
                        className={`h-5 w-5 shrink-0 ${alert.iconClass}`}
                      />

                      <div className="flex-grow">
                        <p className="text-sm font-semibold text-primary">
                          {alert.title}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wide text-on-surface-variant">
                          {alert.subtitle}
                        </p>
                      </div>

                      <ChevronRightIcon className="h-4 w-4 shrink-0 text-on-surface-variant" />
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* Módulos principales */}
        <section className="mb-8 grid gap-4 sm:grid-cols-2">
          <ModuleCard
            icon={FactoryIcon}
            eyebrow="Proceso Maestro"
            title="Producción de tequila"
            description="Lotes, cocción, molienda, fermentación y destilación."
            href="/plant"
            status={
              activeProcesses > 0 ? "Operando" : "Disponible"
            }
            featured
          />

          <ModuleCard
            icon={FlaskIcon}
            eyebrow="Especialidades"
            title="Elaboración de licores"
            description="Recetas, lotes, producción, embotellado y caducidad."
            href="/liquors"
            status="Disponible"
            featured
          />

          <ModuleCard
            icon={WalletIcon}
            eyebrow="Operación Tequilitros"
            title="Cortes de caja"
            description="Sucursales, ventas, salidas, sobres y caja fuerte."
            href="/cash-cuts"
            status="Disponible"
          />

          <ModuleCard
            icon={PackageIcon}
            eyebrow="Eventos y sucursales"
            title="Inventario"
            description="Productos, paquetes, equipo, eventos y conteos."
            href="/administration"
            status="Disponible"
          />

          <ModuleCard
            icon={ClockIcon}
            eyebrow="Checador y turnos"
            title="Horario"
            description="Registra tu entrada, salida y consulta tu calendario."
            href="/timeclock"
            status="Disponible"
          />

          <ModuleCard
            icon={UsersIcon}
            eyebrow="Equipo y permisos"
            title="Personal"
            description="Usuarios, sucursales, tarifas y permisos por módulo."
            href="/administration/personnel"
            status="Disponible"
          />
        </section>

        {/* Resumen de planta */}
        <section className="mb-6">
          <h3 className="mb-4 text-center font-mono text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
            Resumen de Planta
          </h3>

          <div className="grid grid-cols-3 gap-2">
            <PlantStat
              icon={FlaskIcon}
              value={fermentations.length}
              label="Fermentaciones"
            />
            <PlantStat
              icon={FlameIcon}
              value={distillations.length}
              label="Destilaciones"
            />
            <PlantStat
              icon={PackageIcon}
              value={lotsCount}
              label="Lotes"
            />
          </div>
        </section>
      </div>
    </main>
  );
}

async function getExpiringBottles() {
  const now = new Date();
  const in7Days = new Date(now);
  in7Days.setDate(in7Days.getDate() + 7);

  return prisma.liquorBottle.findMany({
    where: {
      expirationDate: { not: null, lte: in7Days },
      status: { in: ["DISPONIBLE", "RESERVADA"] },
    },
    orderBy: { expirationDate: "asc" },
    take: 3,
    include: {
      bottling: {
        include: {
          batch: {
            include: { product: true },
          },
        },
      },
    },
  });
}

function buildAlerts(
  recordingStatus: Awaited<ReturnType<typeof getRecordingStatus>>,
  expiringBottles: Awaited<ReturnType<typeof getExpiringBottles>>
): Alert[] {
  const alerts: Alert[] = [];

  for (const c of recordingStatus.cooking) {
    if (!c.isOverdue) continue;
    alerts.push({
      icon: AlertIcon,
      iconClass: "text-secondary",
      title: `${c.label} requiere lectura`,
      subtitle: "Cocción · Acción requerida",
      href: "/cooking",
    });
  }

  for (const f of recordingStatus.fermentation) {
    if (!f.isOverdue) continue;
    alerts.push({
      icon: AlertIcon,
      iconClass: "text-secondary",
      title: `${f.label} requiere lectura`,
      subtitle: "Fermentación · Acción requerida",
      href: "/fermentation",
    });
  }

  const now = new Date();

  for (const bottle of expiringBottles) {
    if (!bottle.expirationDate) continue;

    const daysLeft = Math.max(
      0,
      Math.ceil(
        (bottle.expirationDate.getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );

    alerts.push({
      icon: InfoIcon,
      iconClass: "text-outline",
      title: `${bottle.bottling.batch.product.name} vence en ${daysLeft} día${
        daysLeft === 1 ? "" : "s"
      }`,
      subtitle: "Urgencia Media",
      href: "/liquors/expiration",
    });
  }

  return alerts.slice(0, 3);
}

function ModuleCard({
  icon: Icon,
  eyebrow,
  title,
  description,
  href,
  status,
  featured = false,
}: {
  icon: ComponentType<IconProps>;
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  status: string;
  featured?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`surface-sheen group relative flex flex-col justify-end overflow-hidden rounded-xl border border-outline-variant bg-surface-container p-6 transition duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.01] hover:border-primary/25 ${
        featured ? "min-h-[200px] sm:col-span-1" : "min-h-[160px]"
      }`}
    >
      <ArrowUpRightIcon className="absolute right-5 top-5 h-6 w-6 text-primary/15 transition-colors group-hover:text-primary/40" />

      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-on-surface-variant" />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
          {eyebrow}
        </span>
      </div>

      <h2 className="mt-2 text-xl font-bold text-primary sm:text-2xl">
        {title}
      </h2>

      <p className="mt-1 text-sm text-on-surface-variant">
        {description}
      </p>

      <span className="mt-3 w-fit rounded-full border border-tertiary-fixed-dim/20 bg-tertiary-fixed-dim/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-tertiary-fixed-dim">
        {status}
      </span>
    </Link>
  );
}

function PlantStat({
  icon: Icon,
  value,
  label,
}: {
  icon: ComponentType<IconProps>;
  value: number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-outline-variant bg-surface-container-low p-4 text-center">
      <Icon className="mb-2 h-5 w-5 text-on-surface-variant" />
      <span className="text-xl font-semibold text-primary">
        {value}
      </span>
      <span className="mt-0.5 font-mono text-[9px] uppercase tracking-wide text-on-surface-variant">
        {label}
      </span>
    </div>
  );
}
