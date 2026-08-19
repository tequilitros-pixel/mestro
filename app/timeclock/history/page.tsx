import Link from "next/link";
import { getMyRecentClosedShifts } from "@/app/actions/timeclock";
import { ChevronLeftIcon } from "@/components/ui/icons";
import RecentShifts from "../RecentShifts";

export default async function MyTimeclockHistoryPage() {
  const shifts = await getMyRecentClosedShifts(30);
  const serialized = shifts.filter((shift) => shift.clockOut).map((shift) => ({
    id: shift.id,
    clockIn: shift.clockIn.toISOString(),
    clockOut: shift.clockOut!.toISOString(),
    branch: shift.branch,
    latestEditRequest: shift.editRequests[0] ? {
      id: shift.editRequests[0].id,
      status: shift.editRequests[0].status,
      requestedClockIn: shift.editRequests[0].requestedClockIn.toISOString(),
      requestedClockOut: shift.editRequests[0].requestedClockOut.toISOString(),
      reason: shift.editRequests[0].reason,
    } : null,
  }));

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-md space-y-6">
        <Link href="/timeclock" className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-on-surface">
          <ChevronLeftIcon className="h-4 w-4" /> Volver al checador
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Mi historial</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Tus últimas 30 entradas y salidas.</p>
        </div>
        {serialized.length > 0 ? <RecentShifts shifts={serialized} /> : (
          <p className="rounded-2xl border border-dashed border-outline-variant p-8 text-center text-sm text-on-surface-variant">Todavía no tienes turnos cerrados.</p>
        )}
      </div>
    </main>
  );
}
