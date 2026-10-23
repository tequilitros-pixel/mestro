import "server-only";
import { getAccessibleBranchIds, requireAnyModuleActionAccess } from "@/lib/auth";
import { DomainError } from "@/lib/domain/errors";
import type { CommandActor } from "./authorization";

export async function getCurrentCommandActor(): Promise<CommandActor> {
  return getCurrentCommandActorFor(["/pos"]);
}

export async function getCurrentCommandActorFor(
  moduleKeys: readonly string[],
): Promise<CommandActor> {
  const user = await requireAnyModuleActionAccess(moduleKeys).catch(() => {
    throw new DomainError("PERMISSION_DENIED");
  });
  return { id: user.id, role: user.role, branchIds: await getPosAccessibleBranchIds() };
}

export async function getPosAccessibleBranchIds(): Promise<string[] | null> {
  return getAccessibleBranchIds();
}
