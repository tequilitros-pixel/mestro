import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getMyTimeClockSummary } from "@/app/actions/timeclock";
import { getMyApprovedPayrollHistory } from "@/app/actions/employeePayrollHistory";
import EmployeePayrollView from "./EmployeePayrollView";
import PayrollDashboard from "./PayrollDashboard";

export default async function PayrollPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "ADMIN") {
    const [summary, historyResult] = await Promise.all([
      getMyTimeClockSummary(),
      getMyApprovedPayrollHistory(),
    ]);
    const history = "error" in historyResult ? historyResult : historyResult.data;
    return <EmployeePayrollView userName={user.name} summary={summary} history={history} />;
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Nómina</h1>
          <p className="mt-2 text-on-surface-variant">
            Revisa las horas reales, corrige incidencias y aprueba la planilla semanal.
          </p>
        </div>

        <PayrollDashboard />
      </div>
    </main>
  );
}
