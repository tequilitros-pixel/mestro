import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import PayrollReport from "./PayrollReport";

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
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Reporte semanal de nómina</h1>
          <p className="mt-2 text-on-surface-variant">
            Horas trabajadas y pago sugerido por trabajador.
          </p>
        </div>

        <PayrollReport />
      </div>
    </main>
  );
}
