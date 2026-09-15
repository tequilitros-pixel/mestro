import { getAccessibleBranchIds, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PosSellClient from "@/components/pos/PosSellClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PosPressPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string }>;
}) {
  const [user, allowedBranchIds, query] = await Promise.all([
    getCurrentUser(),
    getAccessibleBranchIds(),
    searchParams,
  ]);

  const branches = await prisma.branch.findMany({
    where: {
      active: true,
      ...(allowedBranchIds ? { id: { in: allowedBranchIds } } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const openCuts = branches.length
    ? await prisma.cashCut.findMany({
        where: {
          status: "ABIERTO",
          branchId: { in: branches.map((branch) => branch.id) },
        },
        orderBy: { openedAt: "desc" },
        select: { id: true, branchId: true },
      })
    : [];

  const openCutByBranch = new Map<string, string>();
  for (const cut of openCuts) {
    if (!openCutByBranch.has(cut.branchId)) {
      openCutByBranch.set(cut.branchId, cut.id);
    }
  }
  const selectedBranchId = branches.some((branch) => branch.id === query.branchId)
    ? query.branchId
    : undefined;

  return (
    <PosSellClient
      title="POSpress"
      inventoryMode="v2"
      initialBranchId={selectedBranchId}
      branchOptions={branches.map((branch) => ({
        id: branch.id,
        name: branch.name,
        openCashCutId: openCutByBranch.get(branch.id) ?? null,
      }))}
      canManageCatalog={user?.role === "ADMIN"}
    />
  );
}
