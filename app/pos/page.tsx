import { getCurrentUser, getAccessibleBranchIds } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PosSellClient from "@/components/pos/PosSellClient";
import { getCurrentPospressCashCut } from "@/lib/pos/currentCashCut";

export default async function PosSellPage() {
  const user = await getCurrentUser();
  const allowedBranchIds = await getAccessibleBranchIds();
  const isAdmin = user?.role === "ADMIN";
  const currentCashCut = user && !isAdmin ? await getCurrentPospressCashCut(user) : null;

  const branches = await prisma.branch.findMany({
    where: {
      active: true,
      ...(isAdmin
        ? (allowedBranchIds ? { id: { in: allowedBranchIds } } : {})
        : currentCashCut ? { id: currentCashCut.branch.id } : { id: "__no-open-pospress-cut__" }),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const openCuts = isAdmin ? await prisma.cashCut.findMany({
    where: {
      status: "ABIERTO",
      branchId: { in: branches.map((b) => b.id) },
    },
    select: { id: true, branchId: true },
  }) : [];

  const openCutByBranch = new Map(openCuts.map((c) => [c.branchId, c.id]));

  const branchOptions = branches.map((b) => ({
    id: b.id,
    name: b.name,
    openCashCutId: currentCashCut?.branch.id === b.id
      ? currentCashCut.id
      : openCutByBranch.get(b.id) ?? null,
  }));

  return (
    <PosSellClient
      branchOptions={branchOptions}
      canManageCatalog={user?.role === "ADMIN"}
    />
  );
}
