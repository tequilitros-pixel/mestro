import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const manager = readFileSync("app/administration/workforce/branches/BranchesManager.tsx", "utf8");
const page = readFileSync("app/administration/workforce/branches/page.tsx", "utf8");
const editor = readFileSync("components/GeofenceLocationEditor.tsx", "utf8");

test("pending geofence evidence uses a deterministic business timezone formatter", () => {
  assert.match(manager, /formatBusinessDateTime\(evidence\.checkedAt\)/);
  assert.doesNotMatch(manager, /new Date\(evidence\.checkedAt\)\.toLocaleString/);
});

test("admin branch UI renders the real geofence editor instead of the placeholder", () => {
  assert.match(page, /user\.role !== "ADMIN"/);
  assert.match(page, /redirect\("\/workforce"\)/);
  assert.match(manager, /<GeofenceLocationEditor/);
  assert.match(manager, /Modo de geozona/);
  assert.doesNotMatch(manager, /Pr\u00f3ximamente|Geolocalizaci\u00f3n desactivada/);
  assert.match(editor, /Usar mi ubicaci\u00f3n actual/);
  assert.match(editor, /Guardar geozona/);
  assert.match(editor, /LocationPicker/);
});
