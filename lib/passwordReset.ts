import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

function resetPepper() {
  const pepper = process.env.PASSWORD_RESET_PEPPER;
  if (!pepper || pepper.length < 32) {
    throw new Error("PASSWORD_RESET_PEPPER debe contener al menos 32 caracteres");
  }
  return pepper;
}

export function hashPasswordResetCode(code: string) {
  return createHmac("sha256", resetPepper()).update(code).digest("hex");
}

export function verifyPasswordResetCode(code: string, expectedHash: string) {
  const actual = Buffer.from(hashPasswordResetCode(code), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
