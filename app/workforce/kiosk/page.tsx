import { workforceGeolocationEnabled } from "@/lib/workforce/geolocation-release";
import { randomUUID } from "node:crypto";
import { Card } from "@/components/ui/Card";
import { prisma } from "@/lib/prisma";
import { resolveWorkforcePolicy } from "@/lib/workforce/settings/service";
import { KioskClockForm } from "./KioskClockForm";

export default async function KioskPage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    error?: string;
    branchId?: string;
  }>;
}) {
  const query = await searchParams;
  const [branches, policy] = await Promise.all([prisma.branch.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  }), resolveWorkforcePolicy(new Date())]);
  const selectedBranch = branches.some((branch) => branch.id === query.branchId)
    ? query.branchId
    : null;
  const employees = selectedBranch
    ? await prisma.employee.findMany({
      where: {
        active: true,
        user: { active: true, pinHash: { not: null } },
        employments: {
          some: {
            status: "ACTIVE",
            branchAssignments: {
              some: { branchId: selectedBranch },
            },
          },
        },
      },
      include: {
        user: true,
        employments: {
          where: { status: "ACTIVE" },
          include: {
            branchAssignments: true,
            workSessions: { where: { endedAt: null }, select: { id: true }, take: 1 },
          },
        },
      },
      orderBy: { displayName: "asc" },
    })
    : [];
  const selectedBranchRecord = branches.find((branch) => branch.id === selectedBranch);
  return (
    <section className="mx-auto max-w-xl space-y-4">
      {query.saved ? (
        <p role="status" className="rounded-xl bg-primary/10 p-3 font-semibold">
          {query.saved}
        </p>
      ) : null}
      {query.error ? (
        <p
          role="alert"
          className="rounded-xl bg-error/10 p-3 font-semibold text-error"
        >
          {query.error}
        </p>
      ) : null}
      <Card>
        <h2 className="text-2xl font-black">Kiosk Workforce V1</h2>
        <p className="text-sm text-on-surface-variant">
          Identificación por PIN existente. Sólo online.
        </p>
      </Card>
      <Card>
        <form method="get" className="mb-4 space-y-3">
          <label className="block font-semibold">
            Contexto de sucursal
            <select
              required
              name="branchId"
              defaultValue={selectedBranch ?? ""}
              className="mt-1 w-full rounded-xl border p-4"
            >
              <option value="">Selecciona</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <button className="w-full rounded-xl border p-3 font-bold">
            Abrir sucursal
          </button>
        </form>
        {selectedBranch ? (
        <KioskClockForm branchId={selectedBranch} requiresLocation={Boolean(workforceGeolocationEnabled && selectedBranchRecord?.geofenceEnabled && selectedBranchRecord.geofenceId && (policy.requireGeolocationClockIn || policy.requireGeolocationClockOut))} idempotencyKey={randomUUID()} employees={employees.filter((employee) => employee.employments.length === 1).map((employee) => ({ id: employee.userId ?? "", name: employee.displayName ?? "Empleado", hasOpenShift: employee.employments[0].workSessions.length > 0 }))} />
        ) : (
          <p className="text-sm text-on-surface-variant">
            Selecciona una sucursal antes de mostrar empleados.
          </p>
        )}
      </Card>
    </section>
  );
}
