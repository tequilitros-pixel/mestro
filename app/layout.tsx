import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import TopBar from "@/components/ui/TopBar";
import { getCurrentUser } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";


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
  description: "Sistema Operativo para Destilerías",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
    const user = await getCurrentUser();
  const cookieStore = await cookies();
  const hasSessionCookie = cookieStore.has("maestro_user");

  if (hasSessionCookie && !user) {
    redirect("/api/session/clear");
  }


  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen bg-slate-950 text-white">
        <TopBar user={user} />

        <main className="mx-auto w-full max-w-7xl p-6">
          {children}
        </main>
      </body>
    </html>
  );
}
 