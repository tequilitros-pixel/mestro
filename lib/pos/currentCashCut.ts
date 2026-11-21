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

export type PospressActiveScope = {
  activeCut: {
    id: string;
    code: string;
    openedAt: Date;
    branchId: string;
    branchName: string;
  } | null;
  allowedBranches: Array<{
    id: string;
    name: string;
    openCashCutId: string | null;
  }>;
  isLockedToBranch: boolean;
  lockedBranchId: string | null;
  lockedBranchName: string | null;
};

/**
 * Busca el corte de caja ABIERTO en el que este usuario está como responsable o creador.
 */
export async function getUserActiveCashCut(user: { id: string }) {
  return prisma.cashCut.findFirst({
    where: {
      status: "ABIERTO",
      OR: [
        { responsibleId: user.id },
        { createdById: user.id },
      ],
    },
    include: {
      branch: { select: { id: true, name: true, code: true } },
    },
    orderBy: { openedAt: "desc" },
  });
}

/**
 * Resuelve el alcance estricto de sucursal para POSpress.
 * Regla de negocio:
 * Cuando un usuario abre un corte en una sucursal (ej. Canoa),
 * queda 100% acotado a esa sucursal:
 * - Solo puede vender en esa sucursal.
 * - Solo puede ver y gestionar mesas de esa sucursal.
 * - Aunque existan cortes abiertos en otras sucursales, no puede vender ni ver otras sucursales.
 */
export async function getPospressActiveScope(user: {
  id: string;
  role?: string;
}): Promise<PospressActiveScope> {
  const ownCut = await getUserActiveCashCut(user);

  // Caso 1: El usuario tiene un corte abierto en una sucursal específica
  if (ownCut) {
    return {
      activeCut: {
        id: ownCut.id,
        code: ownCut.code,
        openedAt: ownCut.openedAt,
        branchId: ownCut.branch.id,
        branchName: ownCut.branch.name,
      },
      allowedBranches: [
        {
          id: ownCut.branch.id,
          name: ownCut.branch.name,
          openCashCutId: ownCut.id,
        },
      ],
      isLockedToBranch: true,
      lockedBranchId: ownCut.branch.id,
      lockedBranchName: ownCut.branch.name,
    };
  }

  // Caso 2: El usuario no ha abierto ningún corte aún
  const accessibleBranchIds = await getAccessibleBranchIds();
  const branches = await prisma.branch.findMany({
    where: {
      active: true,
      ...(accessibleBranchIds ? { id: { in: accessibleBranchIds } } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Si el usuario tiene solo 1 sucursal asignada por rol o contrato
  if (accessibleBranchIds && accessibleBranchIds.length === 1 && branches.length === 1) {
    const singleBranch = branches[0];
    const branchCut = await prisma.cashCut.findFirst({
      where: { branchId: singleBranch.id, status: "ABIERTO" },
      orderBy: { openedAt: "desc" },
      select: { id: true, code: true, openedAt: true },
    });

    return {
      activeCut: branchCut
        ? {
            id: branchCut.id,
            code: branchCut.code,
            openedAt: branchCut.openedAt,
            branchId: singleBranch.id,
            branchName: singleBranch.name,
          }
        : null,
      allowedBranches: [
        {
          id: singleBranch.id,
          name: singleBranch.name,
          openCashCutId: branchCut?.id ?? null,
        },
      ],
      isLockedToBranch: true,
      lockedBranchId: singleBranch.id,
      lockedBranchName: singleBranch.name,
    };
  }

  // Si no tiene corte abierto y tiene múltiples sucursales (ej. Admin sin turno iniciado),
  // se muestran las sucursales pero sin corte vinculado hasta que abra uno.
  return {
    activeCut: null,
    allowedBranches: branches.map((b) => ({
      id: b.id,
      name: b.name,
      openCashCutId: null,
    })),
    isLockedToBranch: false,
    lockedBranchId: null,
    lockedBranchName: null,
  };
}

/** Resolves one server-authorized current cut for transactions or cash verification. */
export async function getCurrentPospressCashCut(
  user: { id: string },
): Promise<CurrentPospressCashCut | null> {
  const ownCut = await getUserActiveCashCut(user);
  if (ownCut) {
    return {
      id: ownCut.id,
      code: ownCut.code,
      openedAt: ownCut.openedAt,
      branch: { id: ownCut.branch.id, name: ownCut.branch.name },
    };
  }

  const allowedBranchIds = await getAccessibleBranchIds();
  if (allowedBranchIds && allowedBranchIds.length === 1) {
    const singleCut = await prisma.cashCut.findFirst({
      where: { branchId: allowedBranchIds[0], status: "ABIERTO" },
      orderBy: { openedAt: "desc" },
      select: {
        id: true,
        code: true,
        openedAt: true,
        branch: { select: { id: true, name: true } },
      },
    });
    return singleCut;
  }

  return null;
}
