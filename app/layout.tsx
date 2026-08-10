import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { getUserModuleKeys } from "@/app/actions/permissions";

import AppShell from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui/Toast";

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
   * Esta función solo consulta al usuario.
   * El middleware es el único responsable de proteger las rutas.
   */
  const user = await getCurrentUser();

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
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
      </head>
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