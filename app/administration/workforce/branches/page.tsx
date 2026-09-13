import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getWorkforceBranchesData } from "@/app/actions/workforceBranches";
import BranchesManager from "./BranchesManager";

export default async function WorkforceBranchesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/workforce");

  const data = await getWorkforceBranchesData();

  return (
    <main className="min-h-screen bg-background px-4 py-5 text-on-surface sm:px-6">
      <div className="mx-auto max-w-7xl">
        <BranchesManager
          initialBranches={data.branches}
          templates={data.templates}
          initialSettings={data.settings}
          initialPendingEvidence={data.pendingEvidence}
        />
      </div>
    </main>
  );
}
