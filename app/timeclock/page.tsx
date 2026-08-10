import Link from "next/link";
import ClockWidget from "./ClockWidget";
import RecentShifts from "./RecentShifts";
import { getMyRecentClosedShifts } from "@/app/actions/timeclock";

export default async function TimeClockPage() {
  const recentShifts = await getMyRecentClosedShifts(10);

  const serializedShifts = recentShifts
    .filter((s) => s.clockOut)
    .map((s) => ({
      id: s.id,
      clockIn: s.clockIn.toISOString(),
      clockOut: s.clockOut!.toISOString(),
      branch: s.branch,
      latestEditRequest: s.editRequests[0]
        ? {
            id: s.editRequests[0].id,
            status: s.editRequests[0].status,
            requestedClockIn: s.editRequests[0].requestedClockIn.toISOString(),
            requestedClockOut: s.editRequests[0].requestedClockOut.toISOString(),
            reason: s.editRequests[0].reason,
          }
        : null,
    }));

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Checador</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Registra tu entrada y salida.
          </p>
        </div>

        <ClockWidget />

        <RecentShifts shifts={serializedShifts} />

        <p className="text-center text-xs text-on-surface-variant">
          ¿Estás en un dispositivo compartido de la sucursal?{" "}
          <Link href="/timeclock/kiosk" className="font-semibold text-primary underline">
            Usar modo kiosco
          </Link>
        </p>
      </div>
    </main>
  );
}
