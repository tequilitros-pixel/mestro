"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { IdentityChangeError } from "@/lib/workforce/identity/operations";
import { changeIdentityState } from "@/lib/workforce/identity/service";

export type IdentityActionState = {
  error?: string;
  success?: string;
  snapshot?: { employeeId: string | null; employeeActive: boolean | null; userId: string | null; userActive: boolean | null };
};

export async function changeWorkforceIdentityAction(
  _previous: IdentityActionState,
  form: FormData,
): Promise<IdentityActionState> {
  const actor = await getCurrentUser();
  if (!actor?.active || actor.role !== "ADMIN") return { error: "Solo ADMIN puede administrar identidades." };
  const target = form.get("target");
  const active = form.get("active");
  const expectedActive = form.get("expectedActive");
  const employeeId = form.get("employeeId");
  if ((target !== "EMPLOYEE" && target !== "USER") || (active !== "true" && active !== "false")
    || (expectedActive !== "true" && expectedActive !== "false") || typeof employeeId !== "string" || !employeeId) {
    return { error: "Solicitud de identidad no valida." };
  }
  try {
    const result = await changeIdentityState(actor, {
      target, active: active === "true", expectedActive: expectedActive === "true", employeeId,
      userId: target === "USER" ? String(form.get("userId") ?? "") : undefined,
      reason: typeof form.get("reason") === "string" ? String(form.get("reason")) : undefined,
    });
    revalidatePath("/administration/workforce/employees");
    revalidatePath(`/administration/workforce/employees/${employeeId}`);
    revalidatePath("/administration/personnel");
    return { snapshot: result.snapshot, success: target === "EMPLOYEE"
      ? "Estado operativo actualizado. La relacion laboral no cambio."
      : active === "true" ? "Acceso habilitado. Debe iniciar una nueva sesion."
        : `Acceso deshabilitado. Sesiones revocadas: ${result.revokedSessions}.` };
  } catch (error) {
    return { error: error instanceof IdentityChangeError ? error.message : "No se pudo actualizar la identidad. Recarga la ficha e intenta nuevamente." };
  }
}
