import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireModuleAccess } from "@/lib/auth";
import { getModuleKeyForPath } from "@/lib/permission-modules";
import { getCashCutScope } from "@/lib/cash-cuts/access";

/*
 * Rutas que exponen informacion historica o de varias sucursales.
 * Se niegan a quien no tiene historial (ENCARGADO) INDEPENDIENTEMENTE
 * de los permisos que tenga configurados: requireModuleAccess solo
 * comprueba que exista el permiso, y un permiso mal otorgado no debe
 * poder saltarse la regla del rol.
 */
const RUTAS_DE_HISTORIAL = [
  "/cash-cuts/history",
  "/cash-cuts/dashboard",
  "/cash-cuts/audit",
  "/cash-cuts/branches",
];

function esRutaDeHistorial(pathname: string) {
  return RUTAS_DE_HISTORIAL.some(
    (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`),
  );
}

export default async function ModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";

  const moduleKey = getModuleKeyForPath(pathname);

  if (moduleKey) {
    await requireModuleAccess(moduleKey);
  }

  const scope = await getCashCutScope();

  // Rol sin acceso al modulo (OPERATOR de planta).
  if (!scope) notFound();

  // notFound() y no un 403: un 403 confirmaria que la pantalla existe.
  if (!scope.canSeeHistory && esRutaDeHistorial(pathname)) {
    notFound();
  }

  return <>{children}</>;
}
