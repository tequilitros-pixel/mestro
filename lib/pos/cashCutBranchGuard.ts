import type { Prisma } from "@prisma/client";
import { DomainError } from "@/lib/domain/errors";

type CashCutReader = Pick<Prisma.TransactionClient, "cashCut">;

// Apertura y cobro comparten este bloqueo por responsable: dos solicitudes
// concurrentes no pueden abrir una caja en otra sucursal mientras se cobra.
export async function lockCashCutOwner(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`
    SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${"cash-cut-owner:" + userId}, 0))
  `;
}

export async function assertCashCutBranch(db: CashCutReader, userId: string, branchId: string) {
  const conflictingCut = await db.cashCut.findFirst({
    where: { responsibleId: userId, status: "ABIERTO", branchId: { not: branchId } },
    orderBy: { openedAt: "desc" },
    select: { branchId: true, branch: { select: { name: true } } },
  });
  if (conflictingCut) {
    throw new DomainError(
      "CASH_SESSION_NOT_OPEN",
      { branchId: conflictingCut.branchId },
      `Tienes un corte abierto en ${conflictingCut.branch.name}. Cierra ese corte antes de operar en otra sucursal.`,
    );
  }
}

export async function getPosSaleBranchOptions(
  db: Pick<Prisma.TransactionClient, "branch" | "cashCut">,
  userId: string,
  allowedBranchIds: string[] | null,
) {
  const [accessibleBranches, ownCuts] = await Promise.all([
    db.branch.findMany({
      where: { active: true, ...(allowedBranchIds ? { id: { in: allowedBranchIds } } : {}) },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.cashCut.findMany({
      where: { responsibleId: userId, status: "ABIERTO" },
      select: { branchId: true, branch: { select: { name: true } } },
    }),
  ]);
  const ownBranchIds = new Set(ownCuts.map((cut) => cut.branchId));
  // No elegir arbitrariamente si ya existen varios cortes propios en conflicto.
  const branches = ownBranchIds.size > 1 ? [] : accessibleBranches.filter(
    (branch) => ownBranchIds.size === 0 || ownBranchIds.has(branch.id),
  );
  const branchLockMessage = ownBranchIds.size > 1
    ? "Tienes cortes abiertos en varias sucursales. Cierra los cortes anteriores antes de vender."
    : ownCuts.length
      ? `Tu corte abierto está en ${ownCuts[0].branch.name}. Para vender en otra sucursal, primero cierra ese corte.`
      : null;
  const cuts = branches.length ? await db.cashCut.findMany({
    where: { status: "ABIERTO", branchId: { in: branches.map((branch) => branch.id) } },
    orderBy: { openedAt: "desc" },
    select: { id: true, branchId: true, eventStockIsolated: true, event: { select: { clientName: true } } },
  }) : [];
  const openCutByBranch = new Map<string, (typeof cuts)[number]>();
  for (const cut of cuts) if (!openCutByBranch.has(cut.branchId)) openCutByBranch.set(cut.branchId, cut);
  return {
    branches: branches.map((branch) => ({ ...branch, openCashCutId: openCutByBranch.get(branch.id)?.id ?? null, openEventName: openCutByBranch.get(branch.id)?.eventStockIsolated ? (openCutByBranch.get(branch.id)?.event?.clientName ?? null) : null })),
    branchLockMessage,
  };
}
