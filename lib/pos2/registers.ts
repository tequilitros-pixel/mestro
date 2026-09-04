import "server-only";
import { prisma } from "@/lib/prisma";
import { appendAuditEvent } from "@/lib/pos2/audit";
import { requireCapability, type CommandActor } from "@/lib/pos2/authorization";
import { requireActorBranch } from "@/lib/pos2/cash/guards";

function normalizedCode(value: string) {
  const code = value.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(code)) throw new Error("VALIDATION_ERROR");
  return code;
}

export async function createRegister(input: { actor: CommandActor; branchId: string; code: string; name: string }) {
  return prisma.$transaction(async (tx) => {
    requireActorBranch(input.actor, input.branchId);
    await requireCapability(tx, input.actor, "register.manage", input.branchId);
    const branch = await tx.branch.findUnique({ where: { id: input.branchId }, select: { id: true } });
    if (!branch) throw new Error("VALIDATION_ERROR");
    const register = await tx.register.create({ data: {
      branchId: input.branchId, code: normalizedCode(input.code), name: input.name.trim(), createdById: input.actor.id,
    } });
    await appendAuditEvent(tx, { actorId: input.actor.id, branchId: input.branchId, action: "register.created", entityType: "Register", entityId: register.id, metadata: { code: register.code } });
    return register;
  });
}

export async function updateRegister(input: { actor: CommandActor; registerId: string; name?: string; active?: boolean }) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.register.findUniqueOrThrow({ where: { id: input.registerId } });
    requireActorBranch(input.actor, current.branchId);
    await requireCapability(tx, input.actor, "register.manage", current.branchId);
    const register = await tx.register.update({ where: { id: current.id }, data: { name: input.name?.trim(), active: input.active } });
    await appendAuditEvent(tx, { actorId: input.actor.id, branchId: current.branchId, action: "register.updated", entityType: "Register", entityId: register.id, metadata: { active: register.active } });
    return register;
  });
}
