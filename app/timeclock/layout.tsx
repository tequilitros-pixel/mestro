import { headers } from "next/headers";
import { requireModuleAccess } from "@/lib/auth";
import { getModuleKeyForPath } from "@/lib/permission-modules";

export default async function TimeClockLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "/timeclock";

  // /timeclock/payroll gestiona internamente la vista personal de recibos de colaborador
  // vs la consola de nómina general de empresa según permisos del usuario.
  if (!pathname.startsWith("/timeclock/payroll")) {
    const moduleKey = getModuleKeyForPath(pathname) ?? "/timeclock";
    await requireModuleAccess(moduleKey);
  }

  return <>{children}</>;
}
