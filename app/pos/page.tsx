import { getCurrentUser, getAccessibleBranchIds } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PosSellClient from "@/components/pos/PosSellClient";

export default async function PosSellPage() {
  const user = await getCurrentUser();
  const allowedBranchIds = await getAccessibleBranchIds();

  const branches = await prisma.branch.findMany({
    where: {
      active: true,
      ...(allowedBranchIds ? { id: { in: allowedBranchIds } } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const openCuts = await prisma.cashCut.findMany({
    where: {
      status: "ABIERTO",
      branchId: { in: branches.map((b) => b.id) },
    },
    select: { id: true, branchId: true },
  });

  const openCutByBranch = new Map(openCuts.map((c) => [c.branchId, c.id]));

  const branchOptions = branches.map((b) => ({
    id: b.id,
    name: b.name,
    openCashCutId: openCutByBranch.get(b.id) ?? null,
  }));

  return (
    <PosSellClient
      branchOptions={branchOptions}
      canManageCatalog={user?.role === "ADMIN"}
    />
  );
}
