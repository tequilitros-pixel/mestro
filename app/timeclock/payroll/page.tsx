import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import PayrollDashboard from "./PayrollDashboard";

export default async function PayrollPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "ADMIN") {
    redirect("/timeclock");
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Nómina y horarios</h1>
          <p className="mt-2 text-on-surface-variant">
            Costo de mano de obra, horas trabajadas y su impacto en las ventas.
          </p>
        </div>

        <PayrollDashboard />
      </div>
    </main>
  );
}
