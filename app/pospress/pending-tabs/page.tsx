import { getCurrentUser } from "@/lib/auth";
import PospressPendingTabsClient from "@/components/pospress/PospressPendingTabsClient";
import { getPospressActiveScope } from "@/lib/pos/currentCashCut";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PospressPendingTabsPage() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const scope = await getPospressActiveScope(user);

  return <PospressPendingTabsClient branches={scope.allowedBranches} />;
}
