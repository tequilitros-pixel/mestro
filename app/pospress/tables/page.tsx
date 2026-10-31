import { getCurrentUser } from "@/lib/auth";
import PospressTablesClient from "@/components/pospress/PospressTablesClient";
import { getPospressActiveScope } from "@/lib/pos/currentCashCut";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PospressTablesPage() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const scope = await getPospressActiveScope(user);

  return <PospressTablesClient branches={scope.allowedBranches} />;
}
