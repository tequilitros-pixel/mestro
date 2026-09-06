import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/domain/errors";
import { generateOperationId } from "@/lib/pos2/operationId";
import { createRegister } from "@/lib/pos2/registers";
import { authenticateTerminal, createTerminalEnrollment, enrollTerminal, revokeTerminal } from "@/lib/pos2/terminals";
import { openCashSession } from "@/lib/pos2/cash/openCashSession";
import { createCashIn, createCashOut } from "@/lib/pos2/cash/createCashMovement";
import { closeCashSession } from "@/lib/pos2/cash/closeCashSession";
import { recountCash } from "@/lib/pos2/cash/recountCash";

const enabled = Boolean(process.env.PHASE3B_TEST_DATABASE_URL);

test("POS 2.0 phase 3B PostgreSQL contract", { skip: !enabled, timeout: 45_000 }, async (t) => {
  const prefix = "p3b";
  const adminId = `${prefix}-admin`;
  const branchA = `${prefix}-branch-a`;
  const branchB = `${prefix}-branch-b`;
  const admin = { id: adminId, role: "ADMIN" as const, branchIds: null };
  await prisma.user.create({ data: { id: adminId, name: "Phase 3B Admin", username: `${prefix}-admin`, password: "not-a-login", role: "ADMIN" } });
  await prisma.branch.createMany({ data: [
    { id: branchA, name: "Phase 3B A", code: `${prefix}-a` },
    { id: branchB, name: "Phase 3B B", code: `${prefix}-b` },
  ] });
  const register = await createRegister({ actor: admin, branchId: branchA, code: "CAJA-01", name: "Caja 1" });
  const register2 = await createRegister({ actor: admin, branchId: branchA, code: "CAJA-02", name: "Caja 2" });
  const registerB = await createRegister({ actor: admin, branchId: branchB, code: "CAJA-01", name: "Caja B" });
  const enrollment = await createTerminalEnrollment({ actor: admin, branchId: branchA, name: "Terminal A" });
  const enrolled = await enrollTerminal({ enrollmentToken: enrollment.enrollmentToken, deviceIdentifier: `${prefix}-device-a` });
  const terminalId = enrolled.terminal.id;

  await t.test("enrollment token is one-use and credential authenticates", async () => {
    assert.equal((await authenticateTerminal({ terminalId, credential: enrolled.credential })).id, terminalId);
    await assert.rejects(enrollTerminal({ enrollmentToken: enrollment.enrollmentToken, deviceIdentifier: `${prefix}-device-retry` }), DomainError);
  });

  let openSessionId = "";
  await t.test("two simultaneous opens leave exactly one OPEN session", async () => {
    const attempts = await Promise.allSettled([
      openCashSession({ operationId: generateOperationId(), branchId: branchA, registerId: register.id, terminalId, actor: admin, openingCash: "100" }),
      openCashSession({ operationId: generateOperationId(), branchId: branchA, registerId: register.id, terminalId, actor: admin, openingCash: "100" }),
    ]);
    assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
    assert.equal(await prisma.cashSession.count({ where: { registerId: register.id, status: "OPEN" } }), 1);
    openSessionId = (await prisma.cashSession.findFirstOrThrow({ where: { registerId: register.id, status: "OPEN" } })).id;
  });

  await t.test("cash in/out are idempotent and reused payload is rejected", async () => {
    await createCashIn({ operationId: generateOperationId(), cashSessionId: openSessionId, terminalId, actor: admin, amount: "25.50", reason: "Cambio adicional" });
    const operationId = generateOperationId();
    const first = await createCashOut({ operationId, cashSessionId: openSessionId, terminalId, actor: admin, amount: "10.25", reason: "Retiro" });
    const replay = await createCashOut({ operationId, cashSessionId: openSessionId, terminalId, actor: admin, amount: "10.25", reason: "Retiro" });
    assert.equal(first.replayed, false);
    assert.equal(replay.replayed, true);
    assert.equal(await prisma.cashMovement.count({ where: { operationId } }), 1);
    await assert.rejects(createCashOut({ operationId, cashSessionId: openSessionId, terminalId, actor: admin, amount: "11.25", reason: "Retiro" }), (error: unknown) => error instanceof DomainError && error.code === "IDEMPOTENCY_KEY_REUSED");
  });

  await t.test("close versus cash-out is serialized with an explainable final ledger", async () => {
    const close = closeCashSession({ operationId: generateOperationId(), cashSessionId: openSessionId, terminalId, actor: admin, declaredCash: "115.25", envelopeAmount: "15.25" });
    const movement = createCashOut({ operationId: generateOperationId(), cashSessionId: openSessionId, terminalId, actor: admin, amount: "5.00", reason: "Concurrent withdrawal" });
    const results = await Promise.allSettled([close, movement]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length >= 1, true);
    const session = await prisma.cashSession.findUniqueOrThrow({ where: { id: openSessionId }, include: { movements: true, cashCut: { include: { safeEnvelope: true } } } });
    assert.equal(session.status, "CLOSED");
    const ledgerExpected = session.movements.reduce((total, item) => total + (item.direction === "IN" ? Number(item.amount) : -Number(item.amount)), 0);
    assert.equal(Number(session.expectedCash), ledgerExpected);
    assert.ok(session.cashCutId);
    assert.equal(session.cashCut?.safeEnvelope?.cashCutId, session.cashCutId);
  });

  let closedSession2 = "";
  await t.test("two simultaneous closes create one declaration and one CashCut", async () => {
    const opened = await openCashSession({ operationId: generateOperationId(), branchId: branchA, registerId: register2.id, terminalId, actor: admin, openingCash: "50" });
    closedSession2 = opened.result.id;
    const attempts = await Promise.allSettled([
      closeCashSession({ operationId: generateOperationId(), cashSessionId: closedSession2, terminalId, actor: admin, declaredCash: "50" }),
      closeCashSession({ operationId: generateOperationId(), cashSessionId: closedSession2, terminalId, actor: admin, declaredCash: "50" }),
    ]);
    assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
    assert.equal(await prisma.cashDeclaration.count({ where: { cashSessionId: closedSession2, type: "CLOSING" } }), 1);
    assert.ok((await prisma.cashSession.findUniqueOrThrow({ where: { id: closedSession2 } })).cashCutId);
  });

  await t.test("recount appends history and updates the legacy projection", async () => {
    const previous = await prisma.cashDeclaration.findFirstOrThrow({ where: { cashSessionId: closedSession2, type: "CLOSING" } });
    const result = await recountCash({ operationId: generateOperationId(), cashSessionId: closedSession2, terminalId, actor: admin, declaredCash: "49", reason: "Segundo conteo" });
    assert.equal(result.result.difference, "-1.00");
    assert.equal(await prisma.cashDeclaration.count({ where: { cashSessionId: closedSession2 } }), 3);
    assert.equal((await prisma.cashDeclaration.findUniqueOrThrow({ where: { id: previous.id } })).amount.toString(), "50");
    const session = await prisma.cashSession.findUniqueOrThrow({ where: { id: closedSession2 }, include: { cashCut: true } });
    assert.equal(session.cashCut?.cashCounted, 49);
    assert.equal(session.cashCut?.difference, -1);
  });

  await t.test("financial history is append-only", async () => {
    const movement = await prisma.cashMovement.findFirstOrThrow({ where: { cashSessionId: closedSession2 } });
    const declaration = await prisma.cashDeclaration.findFirstOrThrow({ where: { cashSessionId: closedSession2 } });
    await assert.rejects(prisma.cashMovement.delete({ where: { id: movement.id } }), /append-only/);
    await assert.rejects(prisma.cashDeclaration.update({ where: { id: declaration.id }, data: { reason: "changed" } }), /append-only/);
  });

  await t.test("cross-branch, missing capability and revoked terminal are rejected", async () => {
    const restrictedAdmin = { ...admin, branchIds: [branchA] };
    await assert.rejects(openCashSession({ operationId: generateOperationId(), branchId: branchB, registerId: registerB.id, terminalId, actor: restrictedAdmin, openingCash: "0" }), (error: unknown) => error instanceof DomainError && error.code === "PERMISSION_DENIED");
    const noCapability = { id: `${prefix}-manager`, role: "GERENTE" as const, branchIds: [branchA] };
    await prisma.user.create({ data: { id: noCapability.id, name: "No Capability", username: `${prefix}-manager`, password: "not-a-login", role: "GERENTE" } });
    const register3 = await createRegister({ actor: admin, branchId: branchA, code: "CAJA-03", name: "Caja 3" });
    await assert.rejects(openCashSession({ operationId: generateOperationId(), branchId: branchA, registerId: register3.id, terminalId, actor: noCapability, openingCash: "0" }), (error: unknown) => error instanceof DomainError && error.code === "PERMISSION_DENIED");
    await revokeTerminal({ actor: admin, terminalId });
    await assert.rejects(authenticateTerminal({ terminalId, credential: enrolled.credential }), DomainError);
    await assert.rejects(openCashSession({ operationId: generateOperationId(), branchId: branchA, registerId: register3.id, terminalId, actor: admin, openingCash: "0" }), (error: unknown) => error instanceof DomainError && error.code === "PERMISSION_DENIED");
  });

  await prisma.$disconnect();
});
