import "server-only";
import type { Prisma } from "@prisma/client";
import { appendAuditEvent } from "./audit";
import { evaluateCapability, type CapabilityKey, type ShadowActor } from "./capabilityPolicy";
export { PHASE3A_CAPABILITIES } from "./capabilityPolicy";

export async function evaluateCapabilityShadow(
  tx: Prisma.TransactionClient,
  input: { actor: ShadowActor; capability: CapabilityKey; branchId?: string; legacyAllowed: boolean; entityType: string; entityId: string },
) {
  const rows = await tx.capabilityGrant.findMany({
    where: {
      capability: { key: input.capability, active: true },
      OR: [{ userId: input.actor.id }, { role: input.actor.role }],
      validFrom: { lte: new Date() },
      AND: [{ OR: [{ validTo: null }, { validTo: { gt: new Date() } }] }],
    },
    select: { userId: true, role: true, scope: true, branchId: true, capability: { select: { key: true } } },
  });
  const shadowAllowed = evaluateCapability(input.actor, input.capability, input.branchId, rows.map((row) => ({ ...row, capabilityKey: row.capability.key })));
  if (shadowAllowed !== input.legacyAllowed) {
    await appendAuditEvent(tx, {
      actorId: input.actor.id,
      branchId: input.branchId,
      action: "capability.shadow_mismatch",
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: { capability: input.capability, legacyAllowed: input.legacyAllowed, shadowAllowed },
    });
  }
  return { legacyAllowed: input.legacyAllowed, shadowAllowed };
}
