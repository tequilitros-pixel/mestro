import { getAccessibleBranchIds, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PospressTablesClient from "@/components/pospress/PospressTablesClient";
import { getCurrentPospressCashCut } from "@/lib/pos/currentCashCut";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PospressTablesPage() {
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
  const cuts = isAdmin && branches.length ? await prisma.cashCut.findMany({
    where: { status: "ABIERTO", branchId: { in: branches.map((branch) => branch.id) } },
    orderBy: { openedAt: "desc" },
    select: { id: true, branchId: true },
  }) : [];
  const openCutByBranch = new Map<string, string>();
  for (const cut of cuts) if (!openCutByBranch.has(cut.branchId)) openCutByBranch.set(cut.branchId, cut.id);

  return <PospressTablesClient branches={branches.map((branch) => ({
    ...branch,
    openCashCutId: currentCashCut?.branch.id === branch.id
      ? currentCashCut.id
      : openCutByBranch.get(branch.id) ?? null,
  }))} />;
}
