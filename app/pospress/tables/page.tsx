import { getAccessibleBranchIds } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PospressTablesClient from "@/components/pospress/PospressTablesClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PospressTablesPage() {
  const allowedBranchIds = await getAccessibleBranchIds();
  const branches = await prisma.branch.findMany({
    where: { active: true, ...(allowedBranchIds ? { id: { in: allowedBranchIds } } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const cuts = branches.length ? await prisma.cashCut.findMany({
    where: { status: "ABIERTO", branchId: { in: branches.map((branch) => branch.id) } },
    orderBy: { openedAt: "desc" },
    select: { id: true, branchId: true },
  }) : [];
  const openCutByBranch = new Map<string, string>();
  for (const cut of cuts) if (!openCutByBranch.has(cut.branchId)) openCutByBranch.set(cut.branchId, cut.id);

  return <PospressTablesClient branches={branches.map((branch) => ({ ...branch, openCashCutId: openCutByBranch.get(branch.id) ?? null }))} />;
}
