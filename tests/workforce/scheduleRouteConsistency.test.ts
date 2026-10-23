import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sources = [
  "../../app/actions/workforceScheduling.ts",
  "../../app/actions/workforceBranches.ts",
  "../../app/administration/workforce/employees/[id]/page.tsx",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));

test("Workforce actions and employee shortcuts return to the canonical schedule", () => {
  for (const source of sources) {
    assert.doesNotMatch(source, /\/administration\/workforce\/schedule/);
    assert.match(source, /\/administration\/schedule/);
  }
});
