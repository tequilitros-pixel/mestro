import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { DomainError } from "@/lib/domain/errors";
import type { CommandActor } from "./authorization";

export async function getCurrentCommandActor(): Promise<CommandActor> {
  const user = await getCurrentUser();
  if (!user) throw new DomainError("PERMISSION_DENIED");
  return { id: user.id, role: user.role, branchIds: await getPosAccessibleBranchIds() };
}

export async function getPosAccessibleBranchIds(): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const { withRlsContext } = await import("@/lib/rls");
  const branches = await withRlsContext(user, (tx) =>
    tx.userBranch.findMany({
      where: { userId: user.id },
      select: { branchId: true },
    }),
  );

  return branches.map((branch) => branch.branchId);
}
