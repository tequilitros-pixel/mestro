import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import AppShell from "@/components/layout/AppShell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MAESTRO",
  description: "Sistema Inteligente de Destiladora del Norte",
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
  const headerStore = await headers();

  const isPublicRoute =
    headerStore.get("x-maestro-public-route") === "true";

  /*
   * En rutas públicas no consultamos la sesión.
   * Así evitamos cualquier redirección producida por getCurrentUser().
   */
  const user = isPublicRoute
    ? null
    : await getCurrentUser();

  if (!isPublicRoute) {
    const cookieStore = await cookies();
    const hasSessionCookie = cookieStore.has("maestro_user");

    if (hasSessionCookie && !user) {
      redirect("/api/session/clear");
    }
  }

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen bg-slate-950 text-white">
        {!isPublicRoute && <ServiceWorkerRegister />}

        {user && !isPublicRoute ? (
          <AppShell user={user}>
            {children}
          </AppShell>
        ) : (
          children
        )}
      </body>
    </html>
  );
}