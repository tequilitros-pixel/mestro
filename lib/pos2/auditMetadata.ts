import type { Prisma } from "@prisma/client";

const FORBIDDEN_METADATA_KEYS = /password|secret|token|authorization|cookie|pin/i;

export function sanitizeAuditMetadata(input: Record<string, unknown> | undefined) {
  if (!input) return undefined;
  return Object.fromEntries(
    Object.entries(input)
      .filter(([key, value]) => !FORBIDDEN_METADATA_KEYS.test(key) && (["string", "number", "boolean"].includes(typeof value) || value === null))
      .map(([key, value]) => [key, value]),
  ) as Prisma.InputJsonObject;
}
