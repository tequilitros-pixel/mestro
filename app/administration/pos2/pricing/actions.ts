"use server";

import { revalidatePath } from "next/cache";
import { requireAdminAction } from "@/lib/auth";
import { createPriceVersion, endPriceVersion } from "@/lib/pos2/pricing/managePrices";

async function actor() { const user = await requireAdminAction(); return { id: user.id, role: user.role, branchIds: null } as const; }
const refresh = () => revalidatePath("/administration/pos2/pricing");

export async function createPriceAction(form: FormData) {
  const targetValue = String(form.get("target"));
  const [kind, id] = targetValue.split(":", 2);
  const scope = form.get("scope") === "BRANCH" ? { scope: "BRANCH" as const, branchId: String(form.get("branchId")) } : { scope: "GLOBAL" as const };
  const target = kind === "VARIANT" ? { variantId: id } : { productId: id };
  const validTo = String(form.get("validTo") ?? "").trim();
  await createPriceVersion({ ...target, ...scope, actor: await actor(), operationId: String(form.get("operationId")), amount: String(form.get("amount")), validFrom: new Date(String(form.get("validFrom"))), validTo: validTo ? new Date(validTo) : null });
  refresh();
}

export async function endPriceAction(form: FormData) {
  await endPriceVersion({ actor: await actor(), operationId: String(form.get("operationId")), priceVersionId: String(form.get("priceVersionId")), effectiveAt: new Date(String(form.get("effectiveAt"))), reason: String(form.get("reason")) });
  refresh();
}
