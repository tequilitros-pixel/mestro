import "server-only";

import { createHash } from "crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function requestFingerprint() {
  const values = await headers();
  return values.get("x-forwarded-for")?.split(",")[0]?.trim()
    || values.get("x-real-ip")
    || "unknown";
}

function throttleKey(scope: string, identifiers: string[]) {
  return `${scope}:${createHash("sha256").update(identifiers.join("|")).digest("hex")}`;
}

/*
 * Prisma 7 con driver adapters (@prisma/adapter-pg) YA NO envuelve el conflicto
 * de serializacion como P2034. Lo lanza como DriverAdapterError con
 *   cause.kind         = "TransactionWriteConflict"
 *   cause.originalCode = "40001"
 * y sin `code` en el nivel superior. Por eso el reintento de abajo nunca se
 * disparaba y el 40001 llegaba crudo hasta POST /login como 500.
 * Se aceptan las dos formas para que funcione con y sin driver adapter.
 */
function isWriteConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  if ("code" in error && String((error as { code: unknown }).code) === "P2034") {
    return true;
  }

  const cause = (error as { cause?: unknown }).cause;
  if (typeof cause === "object" && cause !== null) {
    const kind = "kind" in cause ? String((cause as { kind: unknown }).kind) : "";
    const original = "originalCode" in cause
      ? String((cause as { originalCode: unknown }).originalCode)
      : "";
    if (kind === "TransactionWriteConflict" || original === "40001") return true;
  }

  return false;
}

const MAX_THROTTLE_ATTEMPTS = 5;

export async function consumeAuthAttempt(options: {
  scope: string;
  identifiers: string[];
  maxAttempts: number;
  windowMs: number;
  blockMs?: number;
}) {
  const key = throttleKey(options.scope, options.identifiers);
  for (let attempt = 0; attempt < MAX_THROTTLE_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const now = new Date();
        const current = await tx.authThrottle.findUnique({ where: { key } });

        if (current?.blockedUntil && current.blockedUntil > now) return false;

        const windowExpired = !current || now.getTime() - current.windowStart.getTime() >= options.windowMs;
        const attempts = windowExpired ? 1 : current.attempts + 1;
        const blockedUntil = attempts > options.maxAttempts
          ? new Date(now.getTime() + (options.blockMs ?? options.windowMs))
          : null;

        await tx.authThrottle.upsert({
          where: { key },
          create: { key, attempts, windowStart: now, blockedUntil },
          update: {
            attempts,
            windowStart: windowExpired ? now : current!.windowStart,
            blockedUntil,
          },
        });

        return blockedUntil === null;
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (!isWriteConflict(error) || attempt === MAX_THROTTLE_ATTEMPTS - 1) {
        throw error;
      }
      // Espera con jitter: sin esto los reintentos vuelven a chocar
      // en el mismo instante y se agotan igual.
      const backoffMs = 10 * (attempt + 1) + Math.floor(Math.random() * 25);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
  return false;
}

export async function clearAuthAttempts(scope: string, identifiers: string[]) {
  await prisma.authThrottle.deleteMany({ where: { key: throttleKey(scope, identifiers) } });
}
