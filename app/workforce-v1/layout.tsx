import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { workforceV1Enabled } from "@/lib/workforce/config";

export default async function WorkforceEmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!workforceV1Enabled()) notFound();
  if (!(await getCurrentUser())) redirect("/login");
  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-6">
      <header className="mb-5 space-y-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Workforce V1 · Mi espacio
          </p>
          <h1 className="text-2xl font-bold sm:text-3xl">Mi calendario</h1>
        </div>
        <nav className="flex gap-2 overflow-x-auto pb-1">
          <Link
            className="whitespace-nowrap rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold"
            href="/workforce-v1?view=today"
          >
            Hoy
          </Link>
          <Link
            className="whitespace-nowrap rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold"
            href="/workforce-v1?view=week"
          >
            Semana
          </Link>
          <Link
            className="whitespace-nowrap rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold"
            href="/workforce-v1?view=month"
          >
            Mes
          </Link>
          <Link
            className="whitespace-nowrap rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold"
            href="/workforce-v1/availability"
          >
            Disponibilidad
          </Link>
          <Link
            className="whitespace-nowrap rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary"
            href="/workforce-v1/clock"
          >
            Reloj
          </Link>
          <Link
            className="whitespace-nowrap rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold"
            href="/workforce-v1/kiosk"
          >
            Kiosk
          </Link>
        </nav>
      </header>
      {children}
    </main>
  );
}
