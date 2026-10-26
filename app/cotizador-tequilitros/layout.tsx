import { headers } from "next/headers";
import { requireModuleAccess } from "@/lib/auth";
import { getModuleKeyForPath } from "@/lib/permission-modules";

export const metadata = {
  title: "Cotizador Tequilitros | Maestro",
  description: "Cotizador oficial de barras móviles, calendario de disponibilidad y contratos Tequilitros.",
};

export default async function CotizadorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "/cotizador-tequilitros";
  const moduleKey = getModuleKeyForPath(pathname) ?? "/cotizador-tequilitros";

  await requireModuleAccess(moduleKey);

  return (
    <div className="min-h-screen bg-background text-on-surface">
      {children}
    </div>
  );
}
