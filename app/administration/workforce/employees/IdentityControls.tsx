"use client";

import { useActionState } from "react";
import { changeWorkforceIdentityAction, type IdentityActionState } from "@/app/actions/workforceIdentity";

export function IdentityControls({ employeeId, employeeActive, userId, userActive, hasActiveEmployment }: {
  employeeId: string;
  employeeActive: boolean;
  userId: string | null;
  userActive: boolean | null;
  hasActiveEmployment: boolean;
}) {
  const [state, action, pending] = useActionState<IdentityActionState, FormData>(changeWorkforceIdentityAction, {});
  const operational = state.snapshot?.employeeActive ?? employeeActive;
  const access = state.snapshot ? state.snapshot.userActive : userActive;
  const linkedUser = state.snapshot ? state.snapshot.userId : userId;
  return <section className="space-y-3 rounded-xl border border-outline-variant p-4 sm:p-5" aria-label="Estado operativo y acceso">
    <div className="grid gap-4 sm:grid-cols-2">
      {([
        { target: "EMPLOYEE", label: "Estado operativo", active: operational, enabled: "Activo", disabled: "Inactivo", verb: operational ? "Desactivar empleado" : "Activar empleado" },
        { target: "USER", label: "Acceso a MAESTRO", active: Boolean(access), enabled: "Habilitado", disabled: "Deshabilitado", verb: access ? "Deshabilitar acceso" : "Habilitar acceso" },
      ] as const).map(control => <form key={control.target} action={action}
        onSubmit={event => {
          const detail = control.target === "EMPLOYEE"
            ? "No cambia la relacion laboral ni elimina historial."
            : control.active ? "Se cerraran todas las sesiones. No cambia el estado operativo ni la relacion laboral."
              : "Permite iniciar sesion. No reactiva una relacion laboral.";
          if (!window.confirm(`${control.verb}? ${detail}`)) event.preventDefault();
        }} className="flex items-center justify-between gap-3">
        <input type="hidden" name="employeeId" value={employeeId} />
        <input type="hidden" name="userId" value={linkedUser ?? ""} />
        <input type="hidden" name="target" value={control.target} />
        <input type="hidden" name="active" value={String(!control.active)} />
        <input type="hidden" name="expectedActive" value={String(control.active)} />
        <div><h2 className="font-semibold">{control.label}</h2><p className="text-xs text-on-surface-variant">
          {control.target === "USER" && !linkedUser ? "Sin usuario vinculado" : control.active ? control.enabled : control.disabled}
        </p></div>
        <button type="submit" disabled={pending || (control.target === "USER" && !linkedUser)}
          aria-label={control.verb} aria-pressed={control.active}
          className="min-h-11 shrink-0 rounded-full border border-outline-variant px-4 py-2 text-sm font-semibold disabled:opacity-50">
          {pending ? "Guardando..." : control.active ? control.enabled : control.disabled}
        </button>
      </form>)}
    </div>
    {!hasActiveEmployment && <p className="text-sm text-on-surface-variant">{"El empleado no tiene una relaci\u00f3n laboral activa."}</p>}
    {state.error && <p role="alert" className="text-sm text-error">{state.error}</p>}
    {state.success && <p role="status" className="text-sm text-on-surface-variant">{state.success}</p>}
  </section>;
}
