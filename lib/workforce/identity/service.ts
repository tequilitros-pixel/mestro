import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { setRlsContext } from "@/lib/rls";
import { revokeAllUserSessions } from "@/lib/session";
import { applyIdentityChange, type IdentityActor, type IdentityChange } from "./operations";

export async function changeIdentityState(actor: IdentityActor, input: IdentityChange, attempt = 0) {
  let result;
  try {
    result = await prisma.$transaction(tx => applyIdentityChange(tx, actor, input, {
      authorizeContext: administrator => setRlsContext(tx, administrator),
      revokeSessions: userId => revokeAllUserSessions(userId, tx),
    }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 15_000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) {
      return changeIdentityState(actor, input, attempt + 1);
    }
    throw error;
  }
  // Existing server/Vercel log infrastructure; emit only after a successful commit.
  // Never store credentials or create financial/domain audit rows for identity.
  if (result.changed || result.revokedSessions) {
    console.info("[identity.audit]", JSON.stringify({ occurredAt: new Date().toISOString(), ...result.audit }));
  }
  return result;
}
