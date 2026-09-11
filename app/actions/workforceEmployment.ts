"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { workforceV1Enabled } from "@/lib/workforce/config";
import { assertWorkforceAdministrator } from "@/lib/workforce/employment/rules";
import { addBranchAssignment, archiveEmployeeIdentity, changeEmploymentStatus, changeHomeBranch, changePayRate, createEmployee, rehireEmployee, setEmployeeActive, updateEmployeeProfile, changeJornada, endAllowedBranch, setEmployeeUser, createAndSetEmployeeUser } from "@/lib/workforce/employment/service";

async function authorize() {
  if (!workforceV1Enabled()) throw new Error("Workforce V1 no está habilitado.");
  const user = await getCurrentUser();
  assertWorkforceAdministrator(user);
  if (!user) throw new Error("No autorizado");
  return user;
}

function dateValue(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "");
  const date = value ? new Date(`${value}T00:00:00.000Z`) : null;
  if (!date || Number.isNaN(date.getTime())) throw new Error(`Fecha inválida: ${key}`);
  return date;
}

export async function createWorkforceEmployeeAction(formData: FormData) {
  await authorize();
  const rateAmount = Number(formData.get("rateAmount"));
  let employee;
  try {
    if (String(formData.get("rateAmount") ?? "").trim() && (!Number.isFinite(rateAmount) || rateAmount <= 0)) throw new Error("La tarifa debe ser mayor que cero.");
    const accessMode = String(formData.get("accessMode") ?? "NONE");
    if (!["EXISTING", "NEW", "NONE"].includes(accessMode)) throw new Error("Opción de acceso inválida.");
    const userId = accessMode === "EXISTING" ? String(formData.get("userId") ?? "") || null : null;
    if (accessMode === "EXISTING" && !userId) throw new Error("Selecciona un usuario existente o elige sin acceso.");
    const newUser = accessMode === "NEW" ? {
      name: String(formData.get("newUserName") ?? formData.get("displayName") ?? ""),
      username: String(formData.get("newUsername") ?? ""),
      password: String(formData.get("newPassword") ?? ""),
      role: String(formData.get("newRole") ?? "OPERATOR") as "ADMIN" | "OPERATOR" | "GERENTE" | "ENCARGADO" | "CONSULTA",
      branchIds: [String(formData.get("homeBranchId") ?? ""), ...formData.getAll("allowedBranchIds").map(String)].filter(Boolean),
    } : undefined;
    employee = await createEmployee({
    displayName: String(formData.get("displayName") ?? ""),
    firstName: String(formData.get("firstName") ?? "") || null,
    lastName: String(formData.get("lastName") ?? "") || null,
    employeeNumber: String(formData.get("employeeNumber") ?? "") || null,
    userId,
    newUser,
    employment: {
      status: String(formData.get("status") ?? "ACTIVE") as "ACTIVE" | "INACTIVE" | "TERMINATED",
      startedAt: String(formData.get("startedAt") ?? "") ? dateValue(formData, "startedAt") : null,
      dataConfidence: String(formData.get("startedAt") ?? "") ? "KNOWN" : "LEGACY_UNKNOWN",
      allowedBranchIds: formData.getAll("allowedBranchIds").map(String),
      jornadaType: (String(formData.get("jornadaType") ?? "") || null) as "DAY" | "NIGHT" | "MIXED" | null,
      homeBranchId: String(formData.get("homeBranchId") ?? "") || null,
      effectiveFrom: dateValue(formData, "effectiveFrom"),
      payRate: Number.isFinite(rateAmount) && rateAmount > 0 ? { rateType: String(formData.get("rateType") ?? "HOURLY") as "HOURLY" | "DAILY" | "WEEKLY" | "SALARY", amount: rateAmount, currency: String(formData.get("currency") ?? "").toUpperCase(), effectiveFrom: dateValue(formData, "effectiveFrom") } : undefined,
    },
  });
  } catch (cause) { redirect(`/administration/workforce/employees/new?error=${encodeURIComponent(cause instanceof Error ? cause.message : "No fue posible crear el empleado.")}`); }
  revalidatePath("/administration/workforce/employees");
  const home = String(formData.get("homeBranchId") ?? "");
  redirect(`/administration/workforce/employees/${employee.id}${home ? `?assignedBranch=${encodeURIComponent(home)}` : ""}`);
}

export async function setWorkforceEmployeeUserAction(formData: FormData) {
  return change(formData, () => setEmployeeUser({ employeeId: String(formData.get("employeeId") ?? ""), userId: String(formData.get("userId") ?? "") || null }));
}

export async function createWorkforceEmployeeUserAction(formData: FormData) {
  await authorize();
  const employeeId = String(formData.get("employeeId") ?? "");
  let error = "";
  try {
    await createAndSetEmployeeUser({
      employeeId,
      user: {
        name: String(formData.get("newUserName") ?? ""),
        username: String(formData.get("newUsername") ?? ""),
        password: String(formData.get("newPassword") ?? ""),
        role: String(formData.get("newRole") ?? "OPERATOR") as "ADMIN" | "OPERATOR" | "GERENTE" | "ENCARGADO" | "CONSULTA",
        branchIds: formData.getAll("branchIds").map(String),
      },
    });
  } catch (cause) { error = cause instanceof Error ? cause.message : "No fue posible crear el usuario."; }
  revalidatePath(`/administration/workforce/employees/${employeeId}`);
  redirect(`/administration/workforce/employees/${encodeURIComponent(employeeId)}?${error ? `error=${encodeURIComponent(error)}` : "saved=1"}`);
}

export async function changeWorkforceHomeAction(formData: FormData) {
  await authorize();
  const employeeId = String(formData.get("employeeId"));
  const branchId = String(formData.get("branchId"));
  const employmentId = String(formData.get("employmentId"));
  const effectiveFrom = formData.get("quick") ? new Date() : dateValue(formData, "effectiveFrom");
  let error: string | null = null;
  let assignmentSaved = false;
  try {
    await changeHomeBranch({ employmentId, branchId, effectiveFrom });
    assignmentSaved = true;

  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Error desconocido.";
    error = assignmentSaved
      ? `Sucursal HOME guardada; la plantilla no se aplicó: ${message}`
      : `No fue posible cambiar la sucursal HOME: ${message}`;
  }
  if (error) redirect(`/administration/workforce/employees/${employeeId}?error=${encodeURIComponent(error)}${assignmentSaved ? `&assignedBranch=${encodeURIComponent(branchId)}` : ""}`);
  revalidatePath(`/administration/workforce/employees/${employeeId}`);
  redirect(`/administration/workforce/employees/${employeeId}?assignedBranch=${encodeURIComponent(branchId)}&assignedFrom=${effectiveFrom.toISOString().slice(0, 10)}`);
}

async function change(formData: FormData, operation: () => Promise<unknown>) {
  await authorize();
  const id = String(formData.get("employeeId") ?? "");
  let error = "";
  try { await operation(); } catch (cause) { error = cause instanceof Error ? cause.message : "No fue posible guardar."; }
  revalidatePath("/administration/workforce/employees");
  revalidatePath(`/administration/workforce/employees/${id}`);
  revalidatePath("/administration/workforce/schedule");
  redirect(`/administration/workforce/employees/${encodeURIComponent(id)}?${error ? `error=${encodeURIComponent(error)}` : "saved=1"}`);
}

export async function addWorkforceAllowedBranchAction(formData: FormData) {
  return change(formData, () => addBranchAssignment({ employmentId: String(formData.get("employmentId")), branchId: String(formData.get("branchId")), type: "ALLOWED", effectiveFrom: dateValue(formData, "effectiveFrom") }));
}
export async function toggleWorkforceAllowedBranchAction(formData: FormData) {
  return change(formData, () => {
    const enabled = String(formData.get("enabled") ?? "");
    const employmentId = String(formData.get("employmentId") ?? "");
    const branchId = String(formData.get("branchId") ?? "");
    if (enabled === "true") return addBranchAssignment({ employmentId, branchId, type: "ALLOWED", effectiveFrom: new Date() });
    if (enabled === "false") return endAllowedBranch({ assignmentId: String(formData.get("assignmentId") ?? ""), employmentId, effectiveTo: new Date() });
    throw new Error("Estado de sucursal inválido.");
  });
}
export async function changeWorkforcePayRateAction(formData: FormData) {
  await authorize();
  const employeeId = String(formData.get("employeeId"));
  let error: string | null = null;
  try {
    await changePayRate({ employmentId: String(formData.get("employmentId")), rateType: String(formData.get("rateType")) as "HOURLY" | "DAILY" | "WEEKLY" | "SALARY", amount: Number(formData.get("amount")), currency: String(formData.get("currency")).toUpperCase(), effectiveFrom: formData.get("quick") ? new Date() : dateValue(formData, "effectiveFrom") });
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "No fue posible cambiar la tarifa.";
  }
  if (error) redirect(`/administration/workforce/employees/${encodeURIComponent(employeeId)}?error=${encodeURIComponent(error)}`);
  revalidatePath(`/administration/workforce/employees/${employeeId}`);
}
export async function changeWorkforceEmploymentStatusAction(formData: FormData) {
  return change(formData, () => changeEmploymentStatus({ employmentId: String(formData.get("employmentId")), status: String(formData.get("status")) as "ACTIVE" | "INACTIVE" | "TERMINATED", effectiveAt: dateValue(formData, "effectiveAt"), terminationReason: String(formData.get("terminationReason") ?? "") || null }));
}
export async function updateWorkforceEmployeeAction(formData: FormData) {
  return change(formData, () => updateEmployeeProfile({ employeeId: String(formData.get("employeeId")), displayName: String(formData.get("displayName") ?? "") }));
}
export async function changeWorkforceEmployeeActiveAction(formData: FormData) {
  return change(formData, () => setEmployeeActive({ employeeId: String(formData.get("employeeId")), active: String(formData.get("active") ?? "") === "true" }));
}
export async function archiveWorkforceIdentityAction(formData: FormData) {
  const admin = await authorize();
  const employeeId = String(formData.get("employeeId") ?? "");
  let error = "";
  try { await archiveEmployeeIdentity(admin, employeeId); } catch (cause) { error = cause instanceof Error ? cause.message : "No fue posible archivar la identidad."; }
  revalidatePath("/administration/personnel");
  revalidatePath("/administration/workforce/employees");
  revalidatePath(`/administration/workforce/employees/${employeeId}`);
  redirect(`/administration/workforce/employees/${encodeURIComponent(employeeId)}?${error ? `error=${encodeURIComponent(error)}` : "saved=1"}`);
}
export async function rehireWorkforceEmployeeAction(formData: FormData) {
  return change(formData, () => rehireEmployee({ employeeId: String(formData.get("employeeId")), startedAt: formData.get("startedAt") ? dateValue(formData, "startedAt") : null, dataConfidence: formData.get("startedAt") ? "KNOWN" : "LEGACY_UNKNOWN" }));
}
export async function changeWorkforceJornadaAction(formData: FormData) {
  return change(formData, () => changeJornada({ employmentId: String(formData.get("employmentId")), jornadaType: String(formData.get("jornadaType")) as "DAY" | "NIGHT" | "MIXED", effectiveFrom: dateValue(formData, "effectiveFrom") }));
}
export async function endWorkforceAllowedBranchAction(formData: FormData) {
  return change(formData, () => endAllowedBranch({ assignmentId: String(formData.get("assignmentId")), employmentId: String(formData.get("employmentId")), effectiveTo: dateValue(formData, "effectiveTo") }));
}
