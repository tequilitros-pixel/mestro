import assert from "node:assert/strict";
import test from "node:test";
import { buildPos2Contexts, canOperatePos2Context, initialPos2ContextIndex, pos2ContextStatus, type Pos2ContextBranch } from "../lib/pos2/context";
import { requireActorBranch } from "../lib/pos2/branchAccess";

const rollout = { mode: "ALL" as const, branchIds: new Set<string>(), registerIds: new Set<string>() };

function branch(overrides: Partial<Pos2ContextBranch> = {}): Pos2ContextBranch {
  return {
    id: "branch-a",
    name: "Sucursal A",
    registers: [{ id: "register-a", name: "Caja A" }],
    terminals: [{ id: "terminal-a", name: "Terminal A", status: "ACTIVE" }],
    cashSessionsV2: [],
    cashCuts: [],
    ...overrides,
  };
}

test("construye solo los contextos permitidos por la fuente de sucursal y caja", () => {
  const contexts = buildPos2Contexts([branch()], rollout);
  assert.equal(contexts.length, 1);
  assert.equal(contexts[0].branchId, "branch-a");
  assert.equal(contexts[0].registerId, "register-a");
  assert.equal(contexts[0].cashSessionId, null);
  assert.equal(pos2ContextStatus(contexts[0]), "Caja cerrada");
  assert.equal(canOperatePos2Context(contexts[0]), false);
});

test("prioriza una caja V2 abierta sobre una caja cerrada y conserva su terminal real", () => {
  const contexts = buildPos2Contexts([
    branch(),
    branch({ id: "branch-b", name: "Sucursal B", registers: [{ id: "register-b", name: "Caja B" }], terminals: [{ id: "terminal-b", name: "Terminal B", status: "ACTIVE" }], cashSessionsV2: [{ id: "session-b", registerId: "register-b", openingTerminalId: "terminal-b", status: "OPEN" }] }),
  ], rollout);
  assert.equal(initialPos2ContextIndex(contexts), 1);
  assert.equal(contexts[1].cashSessionId, "session-b");
  assert.equal(canOperatePos2Context(contexts[1]), true);
  assert.equal(pos2ContextStatus(contexts[1]), "Caja abierta");
});

test("un corte legacy abierto bloquea una sesión POS2 paralela", () => {
  const contexts = buildPos2Contexts([branch({ cashCuts: [{ id: "legacy-cut" }] })], rollout);
  assert.equal(contexts[0].legacyOpenCashCutId, "legacy-cut");
  assert.equal(pos2ContextStatus(contexts[0]), "Corte abierto en Corte de Caja");
  assert.equal(canOperatePos2Context(contexts[0]), false);
});

test("una sesión abierta usa la terminal que realmente la abrió, aunque no haya otra terminal activa", () => {
  const contexts = buildPos2Contexts([branch({ terminals: [{ id: "terminal-a", name: "Terminal A", status: "DISABLED" }], cashSessionsV2: [{ id: "session-a", registerId: "register-a", openingTerminalId: "terminal-a", status: "OPEN" }] })], rollout);
  assert.equal(contexts.length, 1);
  assert.equal(contexts[0].terminalId, "terminal-a");
  assert.equal(contexts[0].terminalStatus, "DISABLED");
  assert.equal(pos2ContextStatus(contexts[0]), "Terminal deshabilitada");
  assert.equal(canOperatePos2Context(contexts[0]), false);
});

test("dos cajas de una sucursal se mantienen como contextos independientes", () => {
  const contexts = buildPos2Contexts([branch({
    registers: [{ id: "register-a", name: "Caja A" }, { id: "register-b", name: "Caja B" }],
    cashSessionsV2: [{ id: "session-b", registerId: "register-b", openingTerminalId: "terminal-a", status: "OPEN" }],
  })], rollout);
  assert.deepEqual(contexts.map((context) => context.registerId), ["register-a", "register-b"]);
  assert.equal(initialPos2ContextIndex(contexts), 1);
  assert.equal(contexts[0].cashSessionId, null);
  assert.equal(contexts[1].cashSessionId, "session-b");
});

test("el backend rechaza una sucursal fuera del alcance del actor", () => {
  assert.throws(() => requireActorBranch({ id: "worker", role: "GERENTE", branchIds: ["branch-a"] }, "branch-b"));
  assert.doesNotThrow(() => requireActorBranch({ id: "admin", role: "ADMIN", branchIds: null }, "branch-b"));
});
