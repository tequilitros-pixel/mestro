import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listEmployees } from "@/lib/workforce/employment/service";
import { normalizeEmployeeStatusFilter, selectEmploymentForStatus } from "@/lib/workforce/employment/presentation";
import { prisma } from "@/lib/prisma";

const states: Record<string, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  TERMINATED: "Baja",
  NONE: "Sin relación laboral",
};
const rateLabels: Record<string, string> = {
  HOURLY: "hora",
  DAILY: "día",
  WEEKLY: "semana",
  SALARY: "salario",
};

type EmployeeSearchParams = { q?: string; branch?: string; status?: string };

function formatRate(rate: { currency: string | null; amount: unknown; rateType: string } | null | undefined) {
  if (!rate) return "Sin tarifa registrada";
  return (rate.currency ?? "Sin moneda") + " $" + Number(rate.amount).toFixed(2) + " / " + (rateLabels[rate.rateType] ?? rate.rateType);
}

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<EmployeeSearchParams> }) {
  await requireAdmin();
  const filters = await searchParams;
  const statusFilter = normalizeEmployeeStatusFilter(filters.status);
  const [all, branches] = await Promise.all([
    listEmployees(),
    prisma.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const rows = all
    .map((employee) => {
      const current = selectEmploymentForStatus(employee.employments, statusFilter);
      const assignments = current && current.status !== "TERMINATED" ? current.branchAssignments : [];
      return {
        employee,
        assignments,
        home: assignments.find((assignment) => assignment.type === "HOME")?.branch.name ?? "Sin sucursal",
        status: current?.status ?? "NONE",
        rate: current?.status !== "TERMINATED" ? current?.payRates[0] : null,
      };
    })
    .filter((row) => {
      const haystack = (row.employee.displayName ?? "") + " " + (row.employee.employeeNumber ?? "") + " " + (row.employee.user?.username ?? "");
      const queryMatches = !filters.q || haystack.toLocaleLowerCase().includes(filters.q.toLocaleLowerCase());
      const statusMatches = statusFilter === "ALL" || row.status === statusFilter;
      const branchMatches = !filters.branch || row.assignments.some((assignment) => assignment.branchId === filters.branch);
      return queryMatches && statusMatches && branchMatches;
    });

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Empleados</h1>
          <p className="text-sm text-on-surface-variant">La configuración actual de cada persona, sin exponer su historia por defecto.</p>
        </div>
        <Link href="/administration/workforce/employees/new" className="rounded-lg bg-primary px-4 py-3 font-bold text-on-primary">
          + Nuevo empleado
        </Link>
      </header>

      <form className="grid gap-3 rounded-xl border border-outline-variant p-4 sm:grid-cols-[minmax(0,2fr)_minmax(10rem,1fr)_minmax(9rem,1fr)_auto]">
        <label className="text-sm">
          Buscar empleado
          <input name="q" defaultValue={filters.q} placeholder="Nombre o usuario" className="mt-1 w-full rounded-lg border bg-surface px-3 py-2" />
        </label>
        <label className="text-sm">
          Sucursal
          <select name="branch" defaultValue={filters.branch ?? ""} className="mt-1 w-full rounded-lg border bg-surface px-3 py-2">
            <option value="">Todas</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </label>
        <label className="text-sm">
          Estado
          <select name="status" defaultValue={statusFilter} className="mt-1 w-full rounded-lg border bg-surface px-3 py-2">
            <option value="ACTIVE">Activos</option>
            <option value="INACTIVE">Inactivos</option>
            <option value="TERMINATED">Terminados</option>
            <option value="ALL">Todos</option>
          </select>
        </label>
        <button type="submit" className="self-end rounded-lg border px-4 py-2 font-semibold">Filtrar</button>
      </form>

      <p className="text-sm text-on-surface-variant">{rows.length} empleados · {statusFilter === "ACTIVE" ? "activos por defecto" : "filtro: " + (states[statusFilter] ?? statusFilter)}</p>

      <div className="overflow-hidden rounded-xl border border-outline-variant">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="bg-surface-container">
            <tr>
              {["Empleado", "Estado", "Sucursal principal", "Pago", "Usuario"].map((label) => <th key={label} className="p-3">{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.employee.id} className="border-t border-outline-variant align-top hover:bg-surface-container/60">
                <td className="p-3">
                  <Link className="block break-words font-bold hover:underline" href={"/administration/workforce/employees/" + row.employee.id}>
                    {row.employee.displayName ?? "Sin nombre"}
                  </Link>
                </td>
                <td className="p-3">{states[row.status]}</td>
                <td className="break-words p-3">{row.home}</td>
                <td className="break-words p-3">{formatRate(row.rate)}</td>
                <td className="break-words p-3">{row.employee.user ? <><span>@{row.employee.user.username}</span><span className="mt-1 block text-xs text-on-surface-variant">{row.employee.user.active ? "Habilitado" : "Deshabilitado"}</span></> : "Sin acceso"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <Link key={row.employee.id} href={"/administration/workforce/employees/" + row.employee.id} className="block rounded-xl border border-outline-variant p-4 hover:bg-surface-container/60">
            <div className="flex items-start justify-between gap-3">
              <h2 className="break-words font-bold">{row.employee.displayName ?? "Sin nombre"}</h2>
              <span className="shrink-0 text-sm">{states[row.status]}</span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-on-surface-variant">Sucursal principal</dt><dd className="break-words">{row.home}</dd></div>
              <div><dt className="text-xs text-on-surface-variant">Pago</dt><dd className="break-words">{formatRate(row.rate)}</dd></div>
              <div className="col-span-2"><dt className="text-xs text-on-surface-variant">Usuario</dt><dd className="break-words">{row.employee.user ? "@" + row.employee.user.username + " · " + (row.employee.user.active ? "Habilitado" : "Deshabilitado") : "Sin acceso"}</dd></div>
            </dl>
          </Link>
        ))}
      </div>

      {!rows.length && <p className="rounded-xl border p-6 text-center">No hay empleados que coincidan. Puedes ajustar los filtros o crear un empleado.</p>}
    </section>
  );
}
