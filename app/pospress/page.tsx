import { getAccessibleBranchIds, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPosSaleBranchOptions } from "@/lib/pos/cashCutBranchGuard";
import PosSellClient from "@/components/pos/PosSellClient";
import { getPospressActiveScope } from "@/lib/pos/currentCashCut";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PosPressPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string }>;
}) {
  const [user, query] = await Promise.all([
    getCurrentUser(),
    searchParams,
  ]);

  if (!user) return null;
  const { branches, branchLockMessage } = await getPosSaleBranchOptions(prisma, user.id, allowedBranchIds);
  const selectedBranchId = branches.some((branch) => branch.id === query.branchId)
    ? query.branchId
    : undefined;

  return (
    <PosSellClient
      key={branches.map((branch) => branch.id).join(",")}
      branchLockMessage={branchLockMessage}
      title="Punto de Venta"
      inventoryMode="v2"
      initialBranchId={selectedBranchId}
      branchOptions={branches}
      canManageCatalog={user?.role === "ADMIN"}
    />
  );
}
