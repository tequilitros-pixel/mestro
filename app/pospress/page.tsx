import { getCurrentUser } from "@/lib/auth";
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

  if (!user) {
    return null;
  }

  const scope = await getPospressActiveScope(user);

  const initialBranchId =
    scope.lockedBranchId ??
    (query.branchId && scope.allowedBranches.some((b) => b.id === query.branchId)
      ? query.branchId
      : scope.allowedBranches[0]?.id);

  return (
    <PosSellClient
      title="Punto de Venta"
      inventoryMode="v2"
      initialBranchId={initialBranchId}
      branchOptions={scope.allowedBranches}
      canManageCatalog={user.role === "ADMIN"}
    />
  );
}
