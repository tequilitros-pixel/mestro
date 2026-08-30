import { randomUUID } from "node:crypto";
import { Card } from "@/components/ui/Card";
import { prisma } from "@/lib/prisma";
import { workforceKioskClockAction } from "@/app/actions/workforceClock";

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
  const branches = await prisma.branch.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
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
          include: { branchAssignments: true },
        },
      },
      orderBy: { displayName: "asc" },
    })
    : [];
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
          Identificación por PIN existente. Sin GPS y sólo online.
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
        <form action={workforceKioskClockAction} className="space-y-3">
          <input
            type="hidden"
            name="returnTo"
            value={`/workforce-v1/kiosk?branchId=${selectedBranch}`}
          />
          <input type="hidden" name="idempotencyKey" value={randomUUID()} />
          <input type="hidden" name="branchId" value={selectedBranch} />
          <label className="block font-semibold">
            Empleado
            <select
              required
              name="userId"
              className="mt-1 w-full rounded-xl border p-4"
            >
              <option value="">Selecciona</option>
              {employees
                .filter((e) => e.employments.length === 1)
                .map((e) => (
                  <option key={e.id} value={e.userId ?? ""}>
                    {e.displayName}
                  </option>
                ))}
            </select>
          </label>
          <label className="block font-semibold">
            PIN
            <input
              required
              name="pin"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              className="mt-1 w-full rounded-xl border p-4 text-center text-2xl tracking-[0.5em]"
            />
          </label>
          <button className="min-h-16 w-full rounded-xl bg-primary p-4 text-xl font-black text-on-primary">
            Registrar estado siguiente
          </button>
        </form>
        ) : (
          <p className="text-sm text-on-surface-variant">
            Selecciona una sucursal antes de mostrar empleados.
          </p>
        )}
      </Card>
    </section>
  );
}
