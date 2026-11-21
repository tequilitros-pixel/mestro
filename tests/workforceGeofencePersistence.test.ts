import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import {
  getBranchGeofenceSaveState,
  persistBranchGeofence,
  type BranchGeofenceSaveInput,
} from "@/lib/workforce/geofencePersistence";

type FakeGeofence = { id: string; latitude: number; longitude: number; radius: number; branches: { id: string }[] } | null;

function fakeDatabase(geofence: FakeGeofence) {
  let currentGeofence = geofence ? { ...geofence } : null;
  let currentBranch = { id: "branch-qa", name: "QA", geofenceId: geofence?.id ?? null, geofence: currentGeofence ? { id: currentGeofence.id, branches: currentGeofence.branches } : null, geofenceEnabled: false, geofenceMode: "OFF" as const };
  const writes: string[] = [];
  const tx = {
    branch: {
      update: async ({ data }: { data: Record<string, unknown> }) => {
        writes.push("branch.update");
        currentBranch = { ...currentBranch, ...data } as typeof currentBranch;
        return currentBranch;
      },
    },
    geofence: {
      update: async ({ data }: { data: Partial<NonNullable<typeof currentGeofence>> }) => {
        writes.push("geofence.update");
        currentGeofence = { ...currentGeofence!, ...data };
        return currentGeofence;
      },
      create: async ({ data }: { data: { name: string; latitude: number; longitude: number; radius: number } }) => {
        writes.push("geofence.create");
        currentGeofence = { id: "geofence-created", ...data, branches: [{ id: currentBranch.id }] };
        return { id: currentGeofence.id };
      },
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, read: () => ({ branch: currentBranch, geofence: currentGeofence }), writes };
}

test("save then reload preserves moved center and 100 to 200 radius while OFF", async () => {
  const db = fakeDatabase({ id: "geofence-qa", latitude: 20.6736, longitude: -103.344, radius: 100, branches: [{ id: "branch-qa" }] });
  const input: BranchGeofenceSaveInput = { enabled: false, mode: "OFF", latitude: 22.0990604, longitude: -103.2729006, radius: 200 };

  const state = getBranchGeofenceSaveState(input);
  assert.equal(state.error, null);
  await persistBranchGeofence(db.tx, db.read().branch, input, state);

  const reloaded = db.read();
  assert.deepEqual(reloaded.geofence && { latitude: reloaded.geofence.latitude, longitude: reloaded.geofence.longitude, radius: reloaded.geofence.radius }, {
    latitude: input.latitude,
    longitude: input.longitude,
    radius: input.radius,
  });
  assert.equal(reloaded.branch.geofenceEnabled, false);
  assert.equal(reloaded.branch.geofenceMode, "OFF");
  assert.deepEqual(db.writes, ["geofence.update", "branch.update"]);
});

test("valid coordinates can be saved for a disabled branch without enabling it", async () => {
  const db = fakeDatabase(null);
  const input: BranchGeofenceSaveInput = { enabled: false, mode: "OFF", latitude: 20.6736, longitude: -103.344, radius: 100 };
  await persistBranchGeofence(db.tx, db.read().branch, input);
  const reloaded = db.read();
  assert.equal(reloaded.geofence?.radius, 100);
  assert.equal(reloaded.branch.geofenceEnabled, false);
  assert.equal(reloaded.branch.geofenceMode, "OFF");
});

test("combined branch save is the only geofence write path used by the editor", () => {
  const manager = readFileSync("app/administration/workforce/branches/BranchesManager.tsx", "utf8");
  assert.match(manager, /updateWorkforceBranchAction\(\{[\s\S]*geofence:/);
  assert.doesNotMatch(manager, /const geofenceResult/);
});
