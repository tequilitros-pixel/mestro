import "server-only";

import type { Prisma } from "@prisma/client";
import { getAccessibleBranchIds } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type CurrentPospressCashCut = {
  id: string;
  code: string;
  openedAt: Date;
  branch: { id: string; name: string };
};

/** Resolves one server-authorized current cut for the transaction screen. */
export async function getCurrentPospressCashCut(
  user: { id: string },
): Promise<CurrentPospressCashCut | null> {
  const allowedBranchIds = await getAccessibleBranchIds();
  const branchWhere: Prisma.CashCutWhereInput = allowedBranchIds
    ? { branchId: { in: allowedBranchIds } }
    : {};
  const baseWhere: Prisma.CashCutWhereInput = { status: "ABIERTO", ...branchWhere };
  const select = {
    id: true,
    code: true,
    openedAt: true,
    branch: { select: { id: true, name: true } },
  } as const;

  const ownCut = await prisma.cashCut.findFirst({
    where: { AND: [baseWhere, { responsibleId: user.id }] },
    orderBy: { openedAt: "desc" },
    select,
  });
  if (ownCut) return ownCut;

  // Si el usuario no abrió un corte propio, sólo podemos inferir el contexto
  // cuando hay uno único dentro de sus sucursales autorizadas. Elegir el más
  // reciente entre dos sucursales abiertas podría mandar la operación al
  // negocio equivocado.
  const fallbackCuts = await prisma.cashCut.findMany({
    where: baseWhere,
    orderBy: { openedAt: "desc" },
    select,
    take: 2,
  });
  return fallbackCuts.length === 1 ? fallbackCuts[0] : null;
}
