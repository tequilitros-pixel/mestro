import "server-only";
import { prisma } from "@/lib/prisma";
import { requireCapability, type CommandActor } from "@/lib/pos2/authorization";
import { requireActorBranch } from "@/lib/pos2/cash/guards";

export async function getOpenOrders(input: { actor: CommandActor; branchId: string; registerId?: string; userId?: string; status?: "OPEN" | "PAYMENT_PENDING"; from?: Date; to?: Date }) {
  requireActorBranch(input.actor, input.branchId);
  await prisma.$transaction((tx) => requireCapability(tx, input.actor, "pos.order.recover", input.branchId));
  return prisma.pos2Order.findMany({
    where: { branchId: input.branchId, status: input.status ? input.status : { in: ["OPEN", "PAYMENT_PENDING"] }, ...(input.registerId ? { registerId: input.registerId } : {}), ...(input.userId ? { createdById: input.userId } : {}), ...(input.from || input.to ? { createdAt: { ...(input.from ? { gte: input.from } : {}), ...(input.to ? { lt: input.to } : {}) } } : {}) },
    include: { lines: { orderBy: { position: "asc" } }, register: { select: { name: true, code: true } }, terminal: { select: { name: true } } }, orderBy: { updatedAt: "desc" },
  });
}
