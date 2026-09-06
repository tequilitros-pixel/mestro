import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { formatSyncStatusLabel } from "../lib/offline/status";
import { formatBusinessDateTime } from "../lib/dateTime";
import type { SyncSnapshot } from "../lib/offline/types";

const source = ts.transpileModule(readFileSync(new URL("../components/offline/OfflineProvider.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

// Defer state updaters until render, as React may do. Exceptions inside an
// updater must not be confused with exceptions caught by the async caller.
function provider(options: { readFails?: boolean; syncFails?: boolean; storageFails?: boolean; date?: string; malformed?: boolean }) {
  let state: SyncSnapshot;
  const updates: Array<(current: SyncSnapshot) => SyncSnapshot> = [];
  const exports: Record<string, (props: unknown) => any> = {};
  runInNewContext(source, {
    exports,
    console: { error() {} },
    navigator: { onLine: true },
    localStorage: { getItem() { if (options.storageFails) throw new Error("Storage denied"); return options.date ?? null; } },
    require(name: string) {
      if (name === "react") return {
        createContext: () => ({ Provider: "provider" }),
        useCallback: (fn: unknown) => fn,
        useEffect() {},
        useState(initial: SyncSnapshot) { state = initial; return [state, (update: (value: SyncSnapshot) => SyncSnapshot) => updates.push(update)]; },
      };
      if (name === "react/jsx-runtime") return { jsx: (type: unknown, props: unknown) => ({ type, props }) };
      if (name === "@/lib/offline/queue") return { async listOperations() {
        if (options.readFails) throw new Error("IndexedDB unavailable");
        return options.malformed ? [null] : [{ status: "failed" }, { status: "pending" }];
      } };
      if (name === "@/lib/offline/sync") return { async syncOfflineQueue() { if (options.syncFails) throw new Error("Sync write failed"); } };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  const child = { label: "POS remains mounted" };
  const rendered = exports.OfflineProvider({ children: child });
  assert.equal(rendered.props.children, child);
  return {
    syncNow: rendered.props.value.syncNow as () => Promise<void>,
    render() { for (const update of updates.splice(0)) state = update(state!); return state!; },
  };
}

for (const failure of ["readFails", "syncFails", "storageFails", "malformed"] as const) {
  test(`provider contains ${failure}, including deferred render, and exposes sync error`, async () => {
    const app = provider({ [failure]: true });
    await assert.doesNotReject(app.syncNow());
    let snapshot!: SyncSnapshot;
    assert.doesNotThrow(() => { snapshot = app.render(); });
    assert.ok(snapshot.syncError);
    assert.match(formatSyncStatusLabel(snapshot), /Error de sincronización/);
  });
}

test("invalid stored timestamp cannot cause RangeError in the sync indicator", async () => {
  const app = provider({ date: "invalid-timestamp" });
  await app.syncNow();
  const snapshot = app.render();
  assert.equal(snapshot.lastSyncedAt, null);
  assert.doesNotThrow(() => snapshot.lastSyncedAt && formatBusinessDateTime(snapshot.lastSyncedAt));
});

test("successful retry clears the sync error and retains real pending/failed counts", async () => {
  const options = { syncFails: true };
  const app = provider(options);
  await app.syncNow();
  assert.ok(app.render().syncError);
  options.syncFails = false;
  await app.syncNow();
  const snapshot = app.render();
  assert.equal(snapshot.syncError, null);
  assert.equal(snapshot.failed, 1);
  assert.equal(snapshot.pending, 1);
});
