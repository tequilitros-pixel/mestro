import "server-only";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/domain/errors";
import { appendAuditEvent } from "@/lib/pos2/audit";
import { requireCapability, type CommandActor } from "@/lib/pos2/authorization";
import { requireActorBranch } from "@/lib/pos2/cash/guards";

export async function setBranchProductOverride(input: {
  actor: CommandActor; branchId: string; productId: string; expectedVersion: number;
  enabled: boolean; visibleInPos: boolean; availability: "AVAILABLE" | "TEMPORARILY_UNAVAILABLE"; sortOrder?: number | null;
}) {
  return prisma.$transaction(async (tx) => {
    requireActorBranch(input.actor, input.branchId);
    await requireCapability(tx, input.actor, "catalog.branch_override.manage", input.branchId);
    const [branch, product] = await Promise.all([
      tx.branch.findUnique({ where: { id: input.branchId }, select: { id: true } }),
      tx.posProduct.findUnique({ where: { id: input.productId }, select: { id: true } }),
    ]);
    if (!branch || !product) throw new DomainError("VALIDATION_ERROR", { field: !branch ? "branchId" : "productId" });
    const existing = await tx.branchProductOverride.findUnique({ where: { branchId_productId: { branchId: input.branchId, productId: input.productId } } });
    if (!existing) {
      if (input.expectedVersion !== 0) throw new DomainError("CONFLICT", { expectedVersion: input.expectedVersion });
      const created = await tx.branchProductOverride.create({ data: { branchId: input.branchId, productId: input.productId, enabled: input.enabled, visibleInPos: input.visibleInPos, availability: input.availability, sortOrder: input.sortOrder, createdById: input.actor.id } });
      await appendAuditEvent(tx, { actorId: input.actor.id, branchId: input.branchId, action: input.enabled ? "catalog.branch_product.enabled" : "catalog.branch_product.disabled", entityType: "BranchProductOverride", entityId: created.id, metadata: { productId: input.productId, visibleInPos: input.visibleInPos, availability: input.availability } });
      return created;
    }
    const result = await tx.branchProductOverride.updateMany({ where: { id: existing.id, version: input.expectedVersion }, data: { enabled: input.enabled, visibleInPos: input.visibleInPos, availability: input.availability, sortOrder: input.sortOrder, updatedById: input.actor.id, version: { increment: 1 } } });
    if (result.count !== 1) throw new DomainError("CONFLICT", { entity: "BranchProductOverride", expectedVersion: input.expectedVersion });
    const updated = await tx.branchProductOverride.findUniqueOrThrow({ where: { id: existing.id } });
    await appendAuditEvent(tx, { actorId: input.actor.id, branchId: input.branchId, action: input.enabled ? "catalog.branch_product.enabled" : "catalog.branch_product.disabled", entityType: "BranchProductOverride", entityId: updated.id, metadata: { productId: input.productId, oldEnabled: existing.enabled, newEnabled: updated.enabled, oldVisible: existing.visibleInPos, newVisible: updated.visibleInPos, availability: updated.availability, version: updated.version } });
    return updated;
  });
}
