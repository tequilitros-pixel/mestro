import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { getUserModuleKeys } from "@/app/actions/permissions";
import { getDefaultPathForModuleKeys } from "@/lib/permission-modules";

import AppShell from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui/Toast";

const OPERATOR_ALLOWED_PATHS = [
  "/cooking",
  "/milling",
  "/fermentation",
  "/distillation",
  "/workforce-v1",
];

function matchesPath(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export const metadata: Metadata = {
  title: "Destiladora del Norte",
  description: "Sistema Operativo de Destiladora del Norte",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  /*
   * El proxy (proxy.ts) solo confirma que exista la cookie de sesión
   * y no toca la base de datos (ver comentario en ese archivo). La
   * verificación real de usuario activo y restricción de rutas por
   * rol se hace aquí, que sí es un Server Component normal.
   */
  const user = await getCurrentUser();

  const moduleKeys = user && user.role !== "ADMIN"
    ? await getUserModuleKeys(user.id)
    : [];

  if (user) {
    if (!user.active) {
      // Evita un ciclo /login → /login cuando queda una cookie de un
      // usuario desactivado. Esta ruta elimina la sesión antes de volver.
      redirect("/api/session/clear");
    }

    const pathname = (await headers()).get("x-pathname") ?? "";
    const isAllowedForOperator = OPERATOR_ALLOWED_PATHS.some((path) =>
      matchesPath(pathname, path),
    );

    if (
      user.role === "OPERATOR" &&
      moduleKeys.length === 0 &&
      pathname &&
      !isAllowedForOperator
    ) {
      redirect("/cooking");
    }

    // La portada contiene información global. Los usuarios con acceso
    // limitado entran directamente al primer módulo que tienen autorizado.
    if (user.role !== "ADMIN" && pathname === "/") {
      redirect(
        user.role === "OPERATOR" && moduleKeys.length === 0
          ? "/cooking"
          : getDefaultPathForModuleKeys(moduleKeys),
      );
    }
  }

  /*
   * Los permisos por módulo (tabla ModulePermission) solo aplican
   * a roles que no sean ADMIN (acceso total) ni OPERATOR (acceso
   * fijo a producción). Para el resto, la navegación debe reflejar
   * exactamente lo que tienen otorgado.
   */
  return (
    <html
      lang="es"
      className="h-full antialiased"
    >
      <body className="min-h-screen bg-background text-on-surface">
        <ToastProvider>
          {user ? (
            <AppShell
              user={{ name: user.name, role: user.role }}
              moduleKeys={moduleKeys}
            >
              {children}
            </AppShell>
          ) : (
            children
          )}
        </ToastProvider>
      </body>
    </html>
  );
}
