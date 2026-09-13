import "server-only";
import { getAccessibleBranchIds, getCurrentUser } from "@/lib/auth";
import { DomainError } from "@/lib/domain/errors";
import type { CommandActor } from "./authorization";

export async function getCurrentCommandActor(): Promise<CommandActor> {
  const user = await getCurrentUser();
  if (!user) throw new DomainError("PERMISSION_DENIED");
  return { id: user.id, role: user.role, branchIds: await getPosAccessibleBranchIds() };
}

export async function getPosAccessibleBranchIds(): Promise<string[] | null> {
  return getAccessibleBranchIds();
}
