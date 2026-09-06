"use server";
import { revalidatePath } from "next/cache";
import { requireAdminAction } from "@/lib/auth";
import { publishAdjustmentVersion } from "@/lib/pos2/adjustments/manageRules";

export async function publishAdjustmentAction(form: FormData) {
  const user = await requireAdminAction(), actor = { id: user.id, role: user.role, branchIds: null } as const;
  const scope = String(form.get("scope")) as "GLOBAL" | "BRANCH", mechanic = String(form.get("mechanic")) as "PERCENT_OFF" | "FIXED_AMOUNT_OFF" | "FIXED_BUNDLE_PRICE", targetType = String(form.get("targetType")) as "PRODUCT" | "VARIANT" | "CATEGORY" | "ENTIRE_ORDER";
  const value = (name: string) => String(form.get(name) ?? "").trim();
  await publishAdjustmentVersion({ actor, operationId: value("operationId"), code: value("code"), name: value("name"), kind: String(form.get("kind")) as "PROMOTION" | "DISCOUNT" | "COURTESY", mechanic, scope, branchId: scope === "BRANCH" ? value("branchId") : undefined, targetType, targetId: targetType === "ENTIRE_ORDER" ? undefined : value("targetId"), percentage: mechanic === "PERCENT_OFF" ? value("percentage") : undefined, amount: mechanic !== "PERCENT_OFF" ? value("amount") : undefined, bundleQuantity: mechanic === "FIXED_BUNDLE_PRICE" ? value("bundleQuantity") : undefined, priority: Number(value("priority") || 0), stacking: String(form.get("stacking")) as "STACKABLE" | "EXCLUSIVE", requiresBeneficiary: form.get("requiresBeneficiary") === "on", requiresAuthorization: form.get("requiresAuthorization") === "on", validFrom: new Date(value("validFrom")), validTo: value("validTo") ? new Date(value("validTo")) : undefined, timezone: value("timezone") || "America/Mexico_City" });
  revalidatePath("/administration/pos2/promotions");
}
