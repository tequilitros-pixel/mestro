import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("non-admin Workforce access redirects to a safe authenticated route", async () => {
  const source = await readFile(new URL("../../lib/auth.ts", import.meta.url), "utf8");
  const requireAdmin = source.match(/export async function requireAdmin[\s\S]*?\n}/)?.[0] ?? "";

  assert.doesNotMatch(requireAdmin, /redirect\("\/cooking"\)/);
  assert.match(requireAdmin, /redirect\(user \? "\/profile" : "\/login"\)/);
});
