"use server";

import { revalidatePath } from "next/cache";
import { requireAdminAction } from "@/lib/auth";
import { createRegister, updateRegister } from "@/lib/pos2/registers";
import { createTerminalEnrollment, revokeTerminal, rotateTerminalCredential } from "@/lib/pos2/terminals";

async function adminActor() {
  const user = await requireAdminAction();
  return { id: user.id, role: user.role, branchIds: null } as const;
}

export async function createRegisterAction(formData: FormData) {
  await createRegister({ actor: await adminActor(), branchId: String(formData.get("branchId") ?? ""), code: String(formData.get("code") ?? ""), name: String(formData.get("name") ?? "") });
  revalidatePath("/administration/pos2/cash");
}

export async function toggleRegisterAction(formData: FormData) {
  await updateRegister({ actor: await adminActor(), registerId: String(formData.get("registerId") ?? ""), active: formData.get("active") === "true" });
  revalidatePath("/administration/pos2/cash");
}

export type EnrollmentState = { token?: string; credential?: string; terminalName?: string; error?: string };

export async function createTerminalAction(_: EnrollmentState, formData: FormData): Promise<EnrollmentState> {
  try {
    const actor = await adminActor();
    const terminalId = String(formData.get("terminalId") ?? "");
    if (terminalId) {
      const result = await rotateTerminalCredential({ actor, terminalId, deviceIdentifier: String(formData.get("deviceIdentifier") ?? "") });
      revalidatePath("/administration/pos2/cash");
      return { credential: result.credential, terminalName: result.terminal.name };
    }
    const result = await createTerminalEnrollment({ actor, branchId: String(formData.get("branchId") ?? ""), name: String(formData.get("name") ?? "") });
    revalidatePath("/administration/pos2/cash");
    return { token: result.enrollmentToken, terminalName: result.terminal.name };
  } catch { return { error: "No fue posible crear la terminal." }; }
}

export async function revokeTerminalAction(formData: FormData) {
  await revokeTerminal({ actor: await adminActor(), terminalId: String(formData.get("terminalId") ?? "") });
  revalidatePath("/administration/pos2/cash");
}