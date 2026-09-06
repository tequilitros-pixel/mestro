import "server-only";
import type { Prisma, UserRole } from "@prisma/client";
import { DomainError } from "@/lib/domain/errors";
import { evaluateCapability, type CapabilityKey } from "./capabilityPolicy";

export type CommandActor = { id: string; role: UserRole; branchIds: string[] | null };

export async function requireCapability(
  tx: Prisma.TransactionClient,
  actor: CommandActor,
  capability: CapabilityKey,
  branchId?: string,
) {
  const rows = await tx.capabilityGrant.findMany({
    where: {
      capability: { key: capability, active: true },
      OR: [{ userId: actor.id }, { role: actor.role }],
      validFrom: { lte: new Date() },
      AND: [{ OR: [{ validTo: null }, { validTo: { gt: new Date() } }] }],
    },
    select: { userId: true, role: true, scope: true, branchId: true, capability: { select: { key: true } } },
  });
  const allowed = evaluateCapability(actor, capability, branchId, rows.map((row) => ({ ...row, capabilityKey: row.capability.key })));
  if (!allowed) throw new DomainError("PERMISSION_DENIED", { capability, ...(branchId ? { branchId } : {}) });
}

export async function requireGlobalCapability(
  tx: Prisma.TransactionClient,
  actor: CommandActor,
  capability: CapabilityKey,
) {
  const grant = await tx.capabilityGrant.findFirst({
    where: {
      capability: { key: capability, active: true },
      OR: [{ userId: actor.id }, { role: actor.role }],
      scope: "GLOBAL",
      validFrom: { lte: new Date() },
      AND: [{ OR: [{ validTo: null }, { validTo: { gt: new Date() } }] }],
    },
    select: { id: true },
  });
  if (!grant) throw new DomainError("PERMISSION_DENIED", { capability, scope: "GLOBAL" });
}
