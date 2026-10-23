import type { CapabilityScope, UserRole } from "@prisma/client";

export const PHASE3A_CAPABILITIES = [
  "pos.sale.create", "pos.discount.apply", "pos.courtesy.apply", "pos.sale.cancel",
  "pos.return.create", "pos.refund.create", "cash.session.open", "cash.session.close",
  "cash.adjust", "cash.declaration.create", "cash.recount", "cash.in.create", "cash.out.create",
  "register.manage", "terminal.manage", "inventory.adjust", "catalog.view", "catalog.create", "catalog.edit",
  "catalog.archive", "catalog.category.manage", "catalog.variant.manage", "catalog.branch_override.manage", "pricing.edit", "branch.manage",
  "pricing.view", "pricing.create", "pricing.edit_future", "pricing.end", "pricing.branch_override", "pricing.history.view",
  "pos.order.create", "pos.order.edit", "pos.order.void", "pos.order.recover", "pos.payment.begin",
  "inventory.view", "inventory.receive", "inventory.count", "inventory.transfer", "inventory.reconcile",
  "pos.sale.complete", "pos.payment.cash", "pos.payment.card", "pos.payment.transfer",
  "pos.refund.cash", "pos.refund.card", "pos.refund.transfer", "pos.return.restock",
  "pos.discount.employee.apply", "pos.discount.manual.apply", "pos.promotion.manage", "pos.discount.manage", "pos.courtesy.manage",
] as const;

export type CapabilityKey = (typeof PHASE3A_CAPABILITIES)[number];
export type ShadowActor = { id: string; role: UserRole; branchIds: string[] | null };
export type GrantView = { capabilityKey: string; userId: string | null; role: UserRole | null; scope: CapabilityScope; branchId: string | null };

export function evaluateCapability(actor: ShadowActor, capability: CapabilityKey, branchId: string | undefined, grants: GrantView[]) {
  return grants.some((grant) => {
    if (grant.capabilityKey !== capability) return false;
    if (grant.userId !== actor.id && grant.role !== actor.role) return false;
    if (grant.scope === "GLOBAL") return true;
    if (grant.scope === "SELF") return grant.userId === actor.id;
    if (!branchId) return false;
    if (grant.scope === "BRANCH") return grant.branchId === branchId;
    return actor.branchIds === null || actor.branchIds.includes(branchId);
  });
}
