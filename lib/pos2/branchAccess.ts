import { DomainError } from "@/lib/domain/errors";
import type { CommandActor } from "./authorization";

export function requireActorBranch(actor: CommandActor, branchId: string) {
  if (actor.branchIds !== null && !actor.branchIds.includes(branchId)) {
    throw new DomainError("PERMISSION_DENIED", { branchId });
  }
}
