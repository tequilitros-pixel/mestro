import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { getUserModuleKeys } from "@/app/actions/permissions";

import AppShell from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui/Toast";

const OPERATOR_ALLOWED_PATHS = [
  "/cooking",
  "/milling",
  "/fermentation",
  "/distillation",
];

function matchesPath(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

/*
 * Tipografía del nuevo sistema de diseño (definido en Stitch).
 * Reemplaza a Geist en toda la app.
 */
const inter = Inter({
  variable: "--font-inter",
  weight: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  weight: ["500", "600"],
  subsets: ["latin"],
});

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

  if (user) {
    if (!user.active) {
      redirect("/login");
    }

    const pathname = (await headers()).get("x-pathname") ?? "";
    const isAllowedForOperator = OPERATOR_ALLOWED_PATHS.some((path) =>
      matchesPath(pathname, path),
    );

    if (user.role === "OPERATOR" && pathname && !isAllowedForOperator) {
      redirect("/cooking");
    }
  }

  /*
   * Los permisos por módulo (tabla ModulePermission) solo aplican
   * a roles que no sean ADMIN (acceso total) ni OPERATOR (acceso
   * fijo a producción). Para el resto, la navegación debe reflejar
   * exactamente lo que tienen otorgado.
   */
  const moduleKeys =
    user && user.role !== "ADMIN" && user.role !== "OPERATOR"
      ? await getUserModuleKeys(user.id)
      : [];

  return (
    <html
      lang="es"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
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
