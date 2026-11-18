import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { DomainError } from "../../lib/domain/errors";
import { assertCashCutBranch, getPosSaleBranchOptions } from "../../lib/pos/cashCutBranchGuard";

const branches = [
  { id: "canoas", name: "Canoas" },
  { id: "centro", name: "Colotlán Centro" },
];
type Cut = { id: string; branchId: string; responsibleId: string; status: string };
const ownCut: Cut = { id: "centro-cut", branchId: "centro", responsibleId: "damaris", status: "ABIERTO" };
const otherCut: Cut = { id: "canoas-cut", branchId: "canoas", responsibleId: "other", status: "ABIERTO" };

function database(cuts: Cut[]) {
  type Filter = { responsibleId?: string; status?: string; branchId?: { not?: string; in?: string[] } };
  const matching = ({ where }: { where: Filter }) => cuts.filter((cut) =>
    (!where.responsibleId || cut.responsibleId === where.responsibleId) &&
    (!where.status || cut.status === where.status) &&
    (!where.branchId?.not || cut.branchId !== where.branchId.not) &&
    (!where.branchId?.in || where.branchId.in.includes(cut.branchId)),
  ).map((cut) => ({ ...cut, branch: branches.find((branch) => branch.id === cut.branchId)! }));
  return {
    branch: { findMany: async ({ where }: { where: { id?: { in: string[] } } }) => branches.filter((branch) => !where.id || where.id.in.includes(branch.id)) },
    cashCut: { findFirst: async (query: { where: Filter }) => matching(query)[0] ?? null, findMany: async (query: { where: Filter }) => matching(query) },
  } as unknown as Prisma.TransactionClient;
}

test("Damaris no puede vender en Canoas con corte propio en Centro aunque otro cajero abrió Canoas", async () => {
  const db = database([ownCut, otherCut]);
  await assert.rejects(assertCashCutBranch(db, "damaris", "canoas"), (error: unknown) => {
    assert.ok(error instanceof DomainError);
    assert.equal(error.httpStatus, 409);
    assert.equal(error.retryable, false);
    assert.match(error.message, /Colotlán Centro/);
    return true;
  });
  await assert.doesNotReject(assertCashCutBranch(db, "damaris", "centro"));
});

test("un corte cerrado no bloquea el cambio de sucursal ni se confunde con el de otro responsable", async () => {
  const db = database([{ ...ownCut, status: "CERRADO" }, otherCut]);
  await assert.doesNotReject(assertCashCutBranch(db, "damaris", "canoas"));
});

test("POS solo ofrece Centro, sin elegir Canoas por orden alfabético", async () => {
  const result = await getPosSaleBranchOptions(database([ownCut, otherCut]), "damaris", ["canoas", "centro"]);
  assert.deepEqual(result.branches, [{ ...branches[1], openCashCutId: "centro-cut" }]);
  assert.match(result.branchLockMessage!, /primero cierra ese corte/);
});

test("tener corte propio no concede acceso a sucursales fuera de las asignadas", async () => {
  const result = await getPosSaleBranchOptions(database([ownCut, otherCut]), "damaris", ["canoas"]);
  assert.deepEqual(result.branches, []);
});

test("cortes propios en varias sucursales bloquean el cobro hasta resolver el conflicto", async () => {
  const db = database([ownCut, { ...otherCut, responsibleId: "damaris" }]);
  const result = await getPosSaleBranchOptions(db, "damaris", null);
  assert.deepEqual(result.branches, []);
  await assert.rejects(assertCashCutBranch(db, "damaris", "centro"), DomainError);
  await assert.rejects(assertCashCutBranch(db, "damaris", "canoas"), DomainError);
});

test("sin corte propio se conserva el acceso asignado; otros responsables no fijan la sucursal", async () => {
  const result = await getPosSaleBranchOptions(database([otherCut]), "damaris", ["canoas", "centro"]);
  assert.equal(result.branches.length, 2);
  assert.equal(result.branchLockMessage, null);
});
