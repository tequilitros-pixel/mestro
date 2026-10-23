import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const safeBranchRoutes = [
  "../../app/api/cash-cuts/safe/route.ts",
  "../../app/api/cash-cuts/safe/envelopes/route.ts",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));

test("Caja Fuerte lista únicamente sucursales activas", () => {
  for (const source of safeBranchRoutes) {
    assert.match(
      source,
      /const branches = await prisma\.branch\.findMany\(\{\s*where: \{\s*active: true,/,
    );
  }
});
