import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../lib/prisma";
import { buildPos2Contexts, canOperatePos2Context } from "../lib/pos2/context";

const enabled = Boolean(process.env.PHASE3M_TEST_DATABASE_URL);

test("POS2 context resolution is persisted, branch-scoped and cut-aware", { skip: !enabled, timeout: 45_000 }, async () => {
  const prefix = "p3m";
  const userId = `${prefix}-worker`;
  const branchA = `${prefix}-a`;
  const branchB = `${prefix}-b`;
  const branchC = `${prefix}-c`;
  const registerA = `${prefix}-register-a`;
  const registerB = `${prefix}-register-b`;
  const registerC = `${prefix}-register-c`;
  const terminalA = `${prefix}-terminal-a`;
  const terminalB = `${prefix}-terminal-b`;
  const terminalC = `${prefix}-terminal-c`;

  await prisma.user.create({ data: { id: userId, name: "Context Worker", username: userId, password: "test", role: "GERENTE" } });
  await prisma.branch.createMany({ data: [
    { id: branchA, name: "Context A", code: "P3MA" },
    { id: branchB, name: "Context B", code: "P3MB" },
    { id: branchC, name: "Context C", code: "P3MC" },
  ] });
  await prisma.userBranch.createMany({ data: [{ userId, branchId: branchA }, { userId, branchId: branchB }] });
  await prisma.register.createMany({ data: [
    { id: registerA, branchId: branchA, code: "RA", name: "Caja A", createdById: userId },
    { id: registerB, branchId: branchB, code: "RB", name: "Caja B", createdById: userId },
    { id: registerC, branchId: branchC, code: "RC", name: "Caja C", createdById: userId },
  ] });
  await prisma.terminal.createMany({ data: [
    { id: terminalA, branchId: branchA, name: "Terminal A", status: "ACTIVE", credentialHash: "test", createdById: userId },
    { id: terminalB, branchId: branchB, name: "Terminal B", status: "ACTIVE", credentialHash: "test", createdById: userId },
    { id: terminalC, branchId: branchC, name: "Terminal C", status: "ACTIVE", credentialHash: "test", createdById: userId },
  ] });
  await prisma.cashSession.create({ data: { id: `${prefix}-session-b`, branchId: branchB, registerId: registerB, openingTerminalId: terminalB, openedById: userId, status: "OPEN" } });
  await prisma.cashCut.create({ data: { id: `${prefix}-legacy-cut`, code: "P3M-CUT", branchId: branchC, responsibleId: userId, date: new Date("2026-09-13T00:00:00.000Z"), startingFund: 0, createdById: userId, status: "ABIERTO" } });

  const allowedBranchIds = (await prisma.userBranch.findMany({ where: { userId }, select: { branchId: true } })).map((item) => item.branchId);
  const branches = await prisma.branch.findMany({
    where: { id: { in: allowedBranchIds } },
    include: {
      registers: { where: { active: true } },
      terminals: true,
      cashSessionsV2: { where: { status: { in: ["OPEN", "CLOSING"] } }, select: { id: true, registerId: true, openingTerminalId: true, status: true } },
      cashCuts: { where: { status: "ABIERTO" }, select: { id: true } },
    },
  });
  const contexts = buildPos2Contexts(branches, { mode: "ALL", branchIds: new Set(), registerIds: new Set() });

  assert.deepEqual(new Set(contexts.map((context) => context.branchId)), new Set([branchA, branchB]));
  assert.equal(contexts.some((context) => context.branchId === branchC), false);
  assert.equal(contexts.find((context) => context.branchId === branchB)?.cashSessionId, `${prefix}-session-b`);
  assert.equal(canOperatePos2Context(contexts.find((context) => context.branchId === branchB)), true);
  assert.equal(canOperatePos2Context(contexts.find((context) => context.branchId === branchA)), false);

  await prisma.$disconnect();
});
