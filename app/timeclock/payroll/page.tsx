import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUserModuleKeys } from "@/app/actions/permissions";
import { getMyTimeClockSummary } from "@/app/actions/timeclock";
import { getMyApprovedPayrollHistory } from "@/app/actions/employeePayrollHistory";
import EmployeePayrollView from "./EmployeePayrollView";
import PayrollDashboard from "./PayrollDashboard";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const moduleKeys = user.role !== "ADMIN" ? await getUserModuleKeys(user.id) : [];
  const isPayrollManager = user.role === "ADMIN" || moduleKeys.includes("/timeclock/payroll");

  if (!isPayrollManager) {
    const [summary, historyResult, query] = await Promise.all([
      getMyTimeClockSummary(),
      getMyApprovedPayrollHistory(),
      searchParams,
    ]);
    const history = "error" in historyResult ? historyResult : historyResult.data;
    const initialTab =
      query?.tab === "PAGOS" || query?.tab === "SEMANA" || query?.tab === "RESUMEN"
        ? query.tab
        : undefined;

    return (
      <EmployeePayrollView
        userName={user.name}
        summary={summary}
        history={history}
        initialTab={initialTab}
      />
    );
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
