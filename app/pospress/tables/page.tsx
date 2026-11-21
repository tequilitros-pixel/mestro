import { getAccessibleBranchIds, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPosSaleBranchOptions } from "@/lib/pos/cashCutBranchGuard";
import PospressTablesClient from "@/components/pospress/PospressTablesClient";
import { getPospressActiveScope } from "@/lib/pos/currentCashCut";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PospressTablesPage() {
  const [user, allowedBranchIds] = await Promise.all([getCurrentUser(), getAccessibleBranchIds()]);
  if (!user) return null;
  const { branches, branchLockMessage } = await getPosSaleBranchOptions(prisma, user.id, allowedBranchIds);

  return <>
    {branchLockMessage && <p role="status" className="border-b border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface-variant">{branchLockMessage}</p>}
    <PospressTablesClient key={branches.map((branch) => branch.id).join(",")} branches={branches} />
  </>;
}
