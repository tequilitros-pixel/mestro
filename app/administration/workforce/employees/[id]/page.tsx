import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  changeWorkforceEmploymentStatusAction,
  changeWorkforceHomeAction,
  changeWorkforceJornadaAction,
  changeWorkforcePayRateAction,
  rehireWorkforceEmployeeAction,
  toggleWorkforceAllowedBranchAction,
  updateWorkforceEmployeeAction,
} from "@/app/actions/workforceEmployment";
import { SubmitButton } from "../SubmitButton";
import { getEmployee } from "@/lib/workforce/employment/service";
import { IdentityControls } from "../IdentityControls";

const field = "mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm";
const panel = "space-y-4 rounded-xl border border-outline-variant p-4 sm:p-5";
const button = "min-h-11 rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary";
const states: Record<string, string> = { ACTIVE: "Activo", INACTIVE: "Inactivo", TERMINATED: "Baja" };
const rateLabels: Record<string, string> = { HOURLY: "hora", DAILY: "día", WEEKLY: "semana", SALARY: "salario" };
const jornadas: Record<string, string> = { DAY: "Diurna", NIGHT: "Nocturna", MIXED: "Mixta" };

function dateOnly(value: Date | null | undefined) {
  return value?.toISOString().slice(0, 10) ?? "Sin registrar";
}

function isLiveAt(value: { effectiveFrom: Date; effectiveTo: Date | null }, at: Date) {
  return value.effectiveFrom <= at && (!value.effectiveTo || value.effectiveTo > at);
}

function formatRate(rate: { currency: string | null; amount: unknown; rateType: string } | null | undefined) {
  if (!rate) return "Sin tarifa registrada";
  return (rate.currency ?? "Sin moneda") + " $" + Number(rate.amount).toFixed(2) + " / " + (rateLabels[rate.rateType] ?? rate.rateType);
}

export default async function EmployeeDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const query = await searchParams;
  const [employee, branches] = await Promise.all([
    getEmployee(id),
    prisma.branch.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!employee) notFound();

  const now = new Date();
  const today = dateOnly(now);
  const open = employee.employments.find((employment) => employment.status !== "TERMINATED");
  const live = open?.branchAssignments.filter((assignment) => isLiveAt(assignment, now)) ?? [];
  const home = live.find((assignment) => assignment.type === "HOME");
  const allowed = live.filter((assignment) => assignment.type === "ALLOWED");
  const currentRate = open?.payRates.find((rate) => isLiveAt(rate, now));
  const currentJornada = open?.jornadaPolicies.find((policy) => isLiveAt(policy, now));
  const hiddenIds = () => <><input type="hidden" name="employeeId" value={id} /><input type="hidden" name="employmentId" value={open?.id ?? ""} /></>;

  return (
    <section className="space-y-5">
      <Link href="/administration/workforce/employees" className="text-sm text-primary">← Empleados</Link>

      <header className="flex flex-col gap-4 rounded-xl border border-outline-variant p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="min-w-0">
          <h1 className="break-words text-3xl font-bold">{employee.displayName ?? "Sin nombre"}</h1>
          <p className="mt-1 break-words text-sm text-on-surface-variant">
            {employee.user ? "@" + employee.user.username : "Sin usuario vinculado"} · {home?.branch.name ?? "Sin sucursal principal"}
          </p>
        </div>
        {open ? (
          <form action={changeWorkforceEmploymentStatusAction} className="shrink-0">
            {hiddenIds()}
            <input type="hidden" name="status" value={open.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"} />
            <input type="hidden" name="effectiveAt" value={today} />
            <button
              type="submit"
              role="switch"
              aria-checked={open.status === "ACTIVE"}
              className={"min-h-12 rounded-full border px-4 py-2 font-bold " + (open.status === "ACTIVE" ? "border-primary bg-primary/10 text-primary" : "border-outline-variant bg-surface-container text-on-surface-variant")}
            >
              <span aria-hidden="true">{open.status === "ACTIVE" ? "●" : "○"}</span> Relación laboral: {open.status === "ACTIVE" ? "Activa" : "Inactiva"}
            </button>
          </form>
        ) : <span className="rounded-full border border-outline-variant px-4 py-2 font-bold text-on-surface-variant">Relación laboral: Baja</span>}
      </header>

      <IdentityControls employeeId={id} employeeActive={employee.active}
        userId={employee.user?.id ?? null} userActive={employee.user?.active ?? null}
        hasActiveEmployment={employee.employments.some(employment => employment.status === "ACTIVE")} />

      {query.error && <p role="alert" className="rounded-lg border border-error p-3 text-error">{query.error}</p>}
      {query.saved && <p role="status" className="rounded-lg border p-3">Cambios guardados.</p>}

      <details className={panel}>
        <summary className="cursor-pointer font-semibold">Editar datos básicos</summary>
        <form action={updateWorkforceEmployeeAction} className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          {hiddenIds()}
          <label>Nombre visible<input required name="displayName" defaultValue={employee.displayName ?? ""} className={field} /></label>
          <SubmitButton className={button}>Guardar nombre</SubmitButton>
        </form>
      </details>

      {open ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.85fr)]">
          <section className={panel}>
            <div>
              <h2 className="text-lg font-bold">Trabajo</h2>
              <p className="text-sm text-on-surface-variant">HOME organiza la operación. Puede trabajar indica defaults y permisos; no bloquea Scheduling.</p>
            </div>

            <form action={changeWorkforceHomeAction} className="space-y-3">
              {hiddenIds()}
              <input type="hidden" name="quick" value="1" />
              <input type="hidden" name="effectiveFrom" value={today} />
              <label className="block text-sm font-semibold">
                Sucursal principal
                <select required name="branchId" defaultValue={home?.branchId ?? ""} className={field}>
                  <option value="">Seleccionar sucursal</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </label>
              <SubmitButton className={button}>Guardar sucursal principal</SubmitButton>
            </form>

            <div className="border-t border-outline-variant pt-4">
              <h3 className="font-semibold">Puede trabajar en</h3>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {branches.map((branch) => {
                  const assignment = allowed.find((row) => row.branchId === branch.id);
                  const isHome = home?.branchId === branch.id;
                  return (
                    <form action={toggleWorkforceAllowedBranchAction} key={branch.id}>
                      {hiddenIds()}
                      <input type="hidden" name="branchId" value={branch.id} />
                      <input type="hidden" name="assignmentId" value={assignment?.id ?? ""} />
                      <input type="hidden" name="enabled" value={assignment ? "false" : "true"} />
                      <button
                        type="submit"
                        aria-pressed={Boolean(assignment)}
                        aria-label={(assignment ? "Quitar permiso de " : "Permitir ") + branch.name + (isHome ? " (principal)" : "")}
                        className={"flex min-h-12 w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-semibold " + (assignment ? "border-primary bg-primary/10 text-primary" : "border-outline-variant bg-surface")}
                      >
                        <span aria-hidden="true" className="text-lg">{assignment ? "✓" : "○"}</span>
                        <span className="min-w-0 break-words">{branch.name}</span>
                        {isHome && <span className="ml-auto shrink-0 text-xs font-normal text-on-surface-variant">Principal</span>}
                      </button>
                    </form>
                  );
                })}
              </div>
            </div>
          </section>

          <div className="space-y-4">
            <section className={panel}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Pago</h2>
                  <p className="mt-1 text-xl font-bold">{formatRate(currentRate)}</p>
                </div>
                <details className="shrink-0 rounded-lg border border-outline-variant px-3 py-2 text-sm">
                  <summary className="cursor-pointer font-semibold">Editar</summary>
                  <form action={changeWorkforcePayRateAction} className="mt-3 grid gap-3">
                    {hiddenIds()}
                    <input type="hidden" name="quick" value="1" />
                    <input type="hidden" name="effectiveFrom" value={today} />
                    <label>Tarifa<input required type="number" min="0.01" step="0.01" name="amount" defaultValue={currentRate ? Number(currentRate.amount).toFixed(2) : ""} className={field} /></label>
                    <label>Tipo<select name="rateType" defaultValue={currentRate?.rateType ?? "HOURLY"} className={field}><option value="HOURLY">Por hora</option><option value="DAILY">Por día</option><option value="WEEKLY">Por semana</option><option value="SALARY">Salario</option></select></label>
                    <label>Moneda<input required name="currency" maxLength={3} defaultValue={currentRate?.currency ?? "MXN"} className={field} /></label>
                    <SubmitButton className={button}>Guardar</SubmitButton>
                  </form>
                </details>
              </div>
              <p className="text-xs text-on-surface-variant">Cada cambio conserva la tarifa anterior en el historial.</p>
            </section>

            <section className={panel}>
              <h2 className="text-lg font-bold">Horas objetivo</h2>
              <p className="text-xl font-bold">No configuradas</p>
              <p className="text-sm text-on-surface-variant">No existe una meta individual canónica en el modelo actual. El umbral global de horas extra no se reutiliza como meta de este empleado.</p>
            </section>

            <section className={panel}>
              <h2 className="text-lg font-bold">Acceso a MAESTRO</h2>
              <p className="text-lg font-bold">{employee.user ? "@" + employee.user.username : "Sin cuenta vinculada"}</p>
              <p className="text-sm text-on-surface-variant">{employee.user ? (employee.user.active ? "Habilitado" : "Deshabilitado") : "El empleado no tiene login."}</p>
            </section>
          </div>
        </div>
      ) : (
        <section className={panel}>
          <h2 className="text-lg font-bold">Recontratar empleado</h2>
          <p className="text-sm text-on-surface-variant">Crea una nueva relación laboral y conserva cerrada toda la historia anterior.</p>
          <form action={rehireWorkforceEmployeeAction} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <input type="hidden" name="employeeId" value={id} />
            <label>Fecha de reingreso (si se conoce)<input type="date" name="startedAt" className={field} /></label>
            <SubmitButton className={button}>Recontratar</SubmitButton>
          </form>
        </section>
      )}

      {open && (
        <details className={panel}>
          <summary className="cursor-pointer font-semibold">Configuración avanzada</summary>
          <div className="mt-3 space-y-3">
            <p className="text-sm">Tipo de jornada actual: <strong>{currentJornada ? jornadas[currentJornada.jornadaType] : "Sin registrar"}</strong></p>
            <form action={changeWorkforceJornadaAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              {hiddenIds()}
              <label>Tipo de jornada<select name="jornadaType" defaultValue={currentJornada?.jornadaType ?? "DAY"} className={field}><option value="DAY">Diurna</option><option value="NIGHT">Nocturna</option><option value="MIXED">Mixta</option></select></label>
              <label>Vigente desde<input required type="date" name="effectiveFrom" defaultValue={today} className={field} /></label>
              <SubmitButton className={button}>Guardar jornada</SubmitButton>
            </form>
          </div>
        </details>
      )}

      <details className={panel}>
        <summary className="cursor-pointer text-lg font-bold">Ver historial</summary>
        <div className="mt-4 space-y-3">
          {employee.employments.map((employment) => (
            <details key={employment.id} className="rounded-lg border border-outline-variant p-3">
              <summary className="cursor-pointer font-semibold">{states[employment.status]} · {dateOnly(employment.startedAt)} → {dateOnly(employment.endedAt)}</summary>
              <div className="mt-3 space-y-3 text-sm">
                <p>Confianza del dato: {employment.dataConfidence}</p>
                {employment.terminationReason && <p>Motivo de baja: {employment.terminationReason}</p>}
                <div><h3 className="font-semibold">BranchAssignment history</h3>{employment.branchAssignments.length ? employment.branchAssignments.map((assignment) => <p key={assignment.id}>{assignment.type} · {assignment.branch.name} · {dateOnly(assignment.effectiveFrom)} → {dateOnly(assignment.effectiveTo)}</p>) : <p>Sin asignaciones.</p>}</div>
                <div><h3 className="font-semibold">PayRate history</h3>{employment.payRates.length ? employment.payRates.map((rate) => <p key={rate.id}>{formatRate(rate)} · {dateOnly(rate.effectiveFrom)} → {dateOnly(rate.effectiveTo)}</p>) : <p>Sin tarifas.</p>}</div>
                <div><h3 className="font-semibold">Jornada history</h3>{employment.jornadaPolicies.length ? employment.jornadaPolicies.map((policy) => <p key={policy.id}>{jornadas[policy.jornadaType]} · {dateOnly(policy.effectiveFrom)} → {dateOnly(policy.effectiveTo)}</p>) : <p>Sin jornadas registradas.</p>}</div>
              </div>
            </details>
          ))}
          {!employee.employments.length && <p>Sin historial laboral.</p>}
        </div>
      </details>
    </section>
  );
}
