import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWorkforceEmployeeAction } from "@/app/actions/workforceEmployment";
import { SubmitButton } from "../SubmitButton";

const field = "mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2";

export default async function NewEmployeePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const { error } = await searchParams;
  const [branches, users] = await Promise.all([
    prisma.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { active: true, workforceEmployee: null }, select: { id: true, name: true, username: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <Link href="/administration/workforce/employees" className="text-sm text-primary">← Empleados</Link>
      <div>
        <h1 className="text-3xl font-bold">Nuevo empleado</h1>
        <p className="text-sm text-on-surface-variant">Configura lo esencial ahora. La historia se genera automáticamente.</p>
      </div>
      {error && <p role="alert" className="rounded-lg border border-error p-3 text-error">{error}</p>}
      <form action={createWorkforceEmployeeAction} className="space-y-5 rounded-xl border border-outline-variant p-4 sm:p-6">
        <input type="hidden" name="effectiveFrom" value={new Date().toISOString().slice(0, 10)} />
        <label className="block">Nombre<input required name="displayName" className={field} /></label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label>Usuario vinculado (opcional)<select name="userId" className={field}><option value="">Sin usuario vinculado</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name} (@{user.username})</option>)}</select></label>
          <label>Estado inicial<select name="status" className={field}><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select></label>
          <label className="sm:col-span-2">Sucursal principal<select name="homeBranchId" className={field}><option value="">Sin sucursal</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
        </div>

        <fieldset>
          <legend className="font-semibold">Puede trabajar en</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {branches.map((branch) => <label key={branch.id} className="flex min-h-12 items-center gap-2 rounded-lg border border-outline-variant p-3"><input type="checkbox" name="allowedBranchIds" value={branch.id} />{branch.name}</label>)}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-3">
          <label>Pago inicial<input type="number" min="0.01" step="0.01" name="rateAmount" className={field} /></label>
          <label>Moneda<input name="currency" placeholder="MXN" maxLength={3} className={field} /></label>
          <label>Tipo<select name="rateType" className={field}><option value="HOURLY">Por hora</option><option value="DAILY">Por día</option><option value="WEEKLY">Por semana</option><option value="SALARY">Salario</option></select></label>
          <label className="sm:col-span-3">Fecha de ingreso (si se conoce)<input type="date" name="startedAt" className={field} /></label>
        </div>

        <details className="rounded-lg border border-outline-variant p-3">
          <summary className="cursor-pointer font-semibold">Configuración avanzada</summary>
          <label className="mt-3 block">Tipo de jornada<select name="jornadaType" className={field}><option value="">Sin registrar</option><option value="DAY">Diurna</option><option value="NIGHT">Nocturna</option><option value="MIXED">Mixta</option></select></label>
        </details>

        <SubmitButton className="min-h-12 w-full rounded-lg bg-primary px-4 py-3 font-bold text-on-primary">Crear empleado</SubmitButton>
      </form>
    </section>
  );
}
