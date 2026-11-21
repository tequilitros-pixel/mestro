import { getCurrentUser, getAccessibleBranchIds } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPosSaleBranchOptions } from "@/lib/pos/cashCutBranchGuard";
import PosSellClient from "@/components/pos/PosSellClient";
import { getCurrentPospressCashCut } from "@/lib/pos/currentCashCut";

export default async function PosSellPage() {
  const user = await getCurrentUser();
  const allowedBranchIds = await getAccessibleBranchIds();
  const isAdmin = user?.role === "ADMIN";
  const currentCashCut = user && !isAdmin ? await getCurrentPospressCashCut(user) : null;

  if (!user) return null;
  const { branches, branchLockMessage } = await getPosSaleBranchOptions(prisma, user.id, allowedBranchIds);

  return (
    <PosSellClient
      key={branches.map((branch) => branch.id).join(",")}
      branchLockMessage={branchLockMessage}
      branchOptions={branches}
      canManageCatalog={user?.role === "ADMIN"}
    />
  );
}
