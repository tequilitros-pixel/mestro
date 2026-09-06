import { SubmitButton } from "../SubmitButton";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWorkforceEmployeeAction } from "@/app/actions/workforceEmployment";
const field="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2";
export default async function NewEmployeePage({searchParams}:{searchParams:Promise<{error?:string}>}) {
  await requireAdmin();const {error}=await searchParams;
  const [branches,users]=await Promise.all([prisma.branch.findMany({where:{active:true},orderBy:{name:"asc"}}),prisma.user.findMany({where:{active:true,workforceEmployee:null},select:{id:true,name:true,username:true},orderBy:{name:"asc"}})]);
  return <section className="mx-auto max-w-3xl space-y-4"><Link href="/administration/workforce/employees" className="text-sm text-primary">← Empleados</Link><h1 className="text-3xl font-bold">Nuevo empleado</h1><p className="text-sm text-on-surface-variant">Los datos opcionales pueden quedar sin registrar. Crear un empleado no crea una cuenta de acceso.</p>{error&&<p role="alert" className="rounded-lg border border-error p-3 text-error">{error}</p>}
  <form action={createWorkforceEmployeeAction} className="grid gap-4 rounded-xl border border-outline-variant p-4 sm:grid-cols-2 sm:p-6">
    <label className="sm:col-span-2">Nombre<input required name="displayName" className={field}/></label>
    <label>Usuario vinculado (opcional)<select name="userId" className={field}><option value="">Sin usuario vinculado</option>{users.map(u=><option key={u.id} value={u.id}>{u.name} (@{u.username})</option>)}</select></label>
    <label>Estado laboral<select name="status" className={field}><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select></label>
    <label>Sucursal principal (HOME)<select name="homeBranchId" className={field}><option value="">Sin sucursal</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
    <label>Tipo de jornada<select name="jornadaType" className={field}><option value="">Sin registrar</option><option value="DAY">Diurna</option><option value="NIGHT">Nocturna</option><option value="MIXED">Mixta</option></select></label>
    <fieldset className="sm:col-span-2"><legend>Sucursales permitidas (ALLOWED)</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{branches.map(b=><label key={b.id} className="flex items-center gap-2 rounded-lg border p-3"><input type="checkbox" name="allowedBranchIds" value={b.id}/>{b.name}</label>)}</div></fieldset>
    <label>Tarifa (opcional)<input type="number" min="0.01" step="0.01" name="rateAmount" className={field}/></label><label>Moneda de la tarifa<input name="currency" placeholder="Ej. MXN" maxLength={3} className={field}/></label>
    <label>Unidad de tarifa<select name="rateType" className={field}><option value="HOURLY">Por hora</option><option value="DAILY">Por día</option><option value="WEEKLY">Por semana</option><option value="SALARY">Salario</option></select></label>
    <label>Fecha de inicio (si se conoce)<input type="date" name="startedAt" className={field}/></label>
    <label className="sm:col-span-2">Vigencia de sucursales y condiciones<input required type="date" name="effectiveFrom" defaultValue={new Date().toISOString().slice(0,10)} className={field}/><span className="text-xs text-on-surface-variant">No sustituye una fecha de ingreso desconocida.</span></label>
    <div className="flex flex-wrap gap-3 sm:col-span-2"><SubmitButton className="rounded-lg bg-primary px-4 py-3 font-bold text-on-primary">Guardar empleado</SubmitButton><Link href="/administration/workforce/employees" className="rounded-lg border px-4 py-3">Cancelar</Link></div>
  </form></section>;
}
