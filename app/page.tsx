import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getActiveProcesses } from "@/lib/brain/data/getActiveProcesses";

const TIME_ZONE = "America/Mexico_City";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const {
    cookings,
    millings,
    fermentations,
    distillations,
  } = await getActiveProcesses();

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
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(now);

  const currentTime = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(now);

  const firstName =
    user.name.trim().split(/\s+/)[0] || "equipo";

  const activeProcesses =
    cookings.length +
    millings.length +
    fermentations.length +
    distillations.length;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.45em] text-amber-400">
                MAESTRO
              </p>

              <h1 className="mt-4 text-3xl font-black sm:text-4xl">
                {greeting}, {firstName} 👋
              </h1>

              <p className="mt-3 capitalize text-slate-400">
                {currentDate}
              </p>

              <p className="mt-1 text-lg font-semibold text-amber-300">
                {currentTime}
              </p>

              <p className="mt-5 text-sm text-slate-400">
                Selecciona el área donde deseas trabajar.
              </p>
            </div>

            <div className="w-fit rounded-2xl border border-green-500/20 bg-green-500/10 px-5 py-4">
              <p className="text-xs uppercase tracking-wider text-green-300/70">
                Proceso de producción
              </p>

              <p className="mt-1 text-lg font-bold text-green-400">
                {activeProcesses > 0
                  ? `${activeProcesses} proceso${
                      activeProcesses === 1 ? "" : "s"
                    } activo${
                      activeProcesses === 1 ? "" : "s"
                    }`
                  : "Sin procesos activos"}
              </p>
            </div>
          </div>
        </header>

        <section className="mt-6 grid flex-1 gap-5 md:grid-cols-2">
          <PillarCard
            icon="🥃"
            title="Proceso de Producción"
            subtitle="Destiladora del Norte"
            description="Lotes · Cocción · Molienda · Fermentación · Destilación · Sala"
            href="/plant"
            status={
              activeProcesses > 0
                ? "Operando"
                : "Disponible"
            }
            statusType="active"
            accent="amber"
          />

          <PillarCard
            icon="🍹"
            title="Elaboración de Licores"
            subtitle="Producción y embotellado"
            description="Recetas · Lotes · Producción · Embotellado · QR · Caducidad"
            href="/liquors"
            status="En desarrollo"
            statusType="development"
            accent="purple"
          />

          <PillarCard
            icon="💰"
            title="Cortes de Caja"
            subtitle="Operación Tequilitros"
            description="Sucursales · Ventas · Salidas · Sobres · Caja fuerte · Historial"
            href="/cash-cuts"
            status="En desarrollo"
            statusType="development"
            accent="blue"
          />

          <PillarCard
            icon="🏢"
            title="Administración"
            subtitle="Dirección empresarial"
            description="Finanzas · Compras · Proveedores · Personal · Reportes · Configuración"
            href="/administration"
            status="En desarrollo"
            statusType="development"
            accent="slate"
          />
        </section>

        <footer className="mt-8 border-t border-slate-800 pt-6 text-center">
          <p className="text-sm font-semibold text-slate-400">
            MAESTRO v2.0
          </p>

          <p className="mt-2 text-xs text-slate-500">
            Hecho con ☕, código y mucho ❤️ para Destiladora del Norte.
          </p>
        </footer>
      </div>
    </main>
  );
}

function PillarCard({
  icon,
  title,
  subtitle,
  description,
  href,
  status,
  statusType,
  accent,
}: {
  icon: string;
  title: string;
  subtitle: string;
  description: string;
  href: string;
  status: string;
  statusType: "active" | "development";
  accent: "amber" | "purple" | "blue" | "slate";
}) {
  const accentStyles = {
    amber:
      "hover:border-amber-400/60 hover:shadow-amber-400/5",
    purple:
      "hover:border-purple-400/60 hover:shadow-purple-400/5",
    blue:
      "hover:border-blue-400/60 hover:shadow-blue-400/5",
    slate:
      "hover:border-slate-500 hover:shadow-slate-400/5",
  };

  const iconStyles = {
    amber: "border-amber-400/20 bg-amber-400/10",
    purple: "border-purple-400/20 bg-purple-400/10",
    blue: "border-blue-400/20 bg-blue-400/10",
    slate: "border-slate-600 bg-slate-800",
  };

  return (
    <Link
      href={href}
      className={`group flex min-h-64 flex-col rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl transition duration-200 hover:-translate-y-1 hover:shadow-2xl sm:p-8 ${accentStyles[accent]}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-2xl border text-3xl ${iconStyles[accent]}`}
        >
          {icon}
        </div>

        <span
          className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
            statusType === "active"
              ? "border-green-500/30 bg-green-500/10 text-green-400"
              : "border-amber-400/20 bg-amber-400/10 text-amber-300"
          }`}
        >
          {status}
        </span>
      </div>

      <div className="mt-6">
        <h2 className="text-2xl font-bold sm:text-3xl">
          {title}
        </h2>

        <p className="mt-2 text-sm font-medium text-slate-300">
          {subtitle}
        </p>

        <p className="mt-4 leading-7 text-slate-400">
          {description}
        </p>
      </div>

      <div className="mt-auto flex items-center justify-between pt-8">
        <span className="font-bold text-white">
          Entrar
        </span>

        <span className="text-xl text-slate-400 transition group-hover:translate-x-1 group-hover:text-white">
          →
        </span>
      </div>
    </Link>
  );
}