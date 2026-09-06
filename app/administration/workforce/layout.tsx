import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin, requireModuleAccess, getCurrentUser } from "@/lib/auth";
import { headers } from "next/headers";
import { workforceV1Enabled } from "@/lib/workforce/config";

const tabs = [
  ["employees", "Empleados"], ["schedule", "Programar horarios"],
  ["attendance", "Asistencia"], ["clock-corrections", "Correcciones"],
  ["timesheets", "Timesheets"], ["overtime", "Horas extra"],
  ["payroll", "Nómina"], ["settings", "Configuración"], ["branches", "Sucursales"],
];
export default async function WorkforceLayout({ children }: { children: React.ReactNode }) {
  if (!workforceV1Enabled()) notFound();
  const pathname = (await headers()).get("x-pathname") ?? "";
  const schedule = pathname.startsWith("/administration/workforce/schedule");
  if (schedule) await requireModuleAccess("/administration/schedule"); else await requireAdmin();
  const user = await getCurrentUser();
  return <main className={schedule ? "w-full p-2 lg:p-3" : "mx-auto w-full max-w-7xl p-4 sm:p-6"}>
    {user?.role === "ADMIN" && <nav aria-label="Administración Workforce" className="mb-5 flex gap-2 overflow-x-auto border-b border-outline-variant pb-3">
      {tabs.map(([route, label]) => <Link key={route} href={`/administration/workforce/${route}`} aria-current={pathname.startsWith(`/administration/workforce/${route}`) ? "page" : undefined} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold ${pathname.startsWith(`/administration/workforce/${route}`) ? "bg-primary text-on-primary" : "border border-outline-variant hover:bg-surface-container"}`}>{label}</Link>)}
    </nav>}
    {children}
  </main>;
}
