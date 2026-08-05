import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ScheduleTabs from "./ScheduleTabs";

export default async function SchedulePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "ADMIN") {
    redirect("/timeclock");
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <p className="font-mono text-xs font-black uppercase tracking-[0.35em] text-on-surface-variant">
            Administración
          </p>

          <h1 className="mt-2 text-4xl font-bold text-on-surface">
            Horarios
          </h1>

          <p className="mt-2 text-sm text-on-surface-variant">
            Turnos, cobertura y plantillas por sucursal.
          </p>
        </div>

        <ScheduleTabs />
      </div>
    </main>
  );
}
