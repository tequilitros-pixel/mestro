import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "@/lib/prisma";
import { collectPilotReadiness } from "@/lib/pos2/certification/collectReadiness";
import { lockCashSession } from "@/lib/pos2/cash/guards";
import { DomainError } from "@/lib/domain/errors";

const enabled = Boolean(process.env.PHASE3L_TEST_DATABASE_URL);

test("POS 2.0 phase 3L certification and rollout gates", { skip: !enabled, timeout: 60_000 }, async (t) => {
  const userId = "p3l-admin", branchId = "p3l-branch", productId = "p3l-product", registerId = "p3l-register", terminalId = "p3l-terminal", sessionId = "p3l-session";
  await prisma.user.create({ data: { id: userId, name: "Certification Admin", username: userId, password: "test", role: "ADMIN" } });
  await prisma.branch.create({ data: { id: branchId, name: "Certification Branch", code: "P3L" } });
  await prisma.register.create({ data: { id: registerId, branchId, code: "P3L-R", name: "Certification Register", createdById: userId } });
  await prisma.terminal.create({ data: { id: terminalId, branchId, name: "Certification Terminal", status: "ACTIVE", credentialHash: "test", createdById: userId } });
  await prisma.cashSession.create({ data: { id: sessionId, branchId, registerId, openingTerminalId: terminalId, openedById: userId, status: "OPEN" } });
  await prisma.inventoryProduct.create({ data: { id: productId, code: "P3L-I", name: "Certification Item", category: "TEST", unit: "pieza", itemType: "CONSUMABLE", trackStock: true, inventoryBaseUnit: "UNIT" } });
  await prisma.inventoryBalance.create({ data: { branchId, inventoryProductId: productId, quantity: "1", unit: "UNIT" } });

  await t.test("a balance without ledger evidence blocks the pilot", async () => {
    const report = await collectPilotReadiness(prisma, { migrationDrift: false });
    assert.equal(report.status, "FAIL");
    assert.equal(report.input.inventoryMismatches, 1);
  });

  await t.test("financial locks obey register allowlist and kill switch", async () => {
    const previous = { mode: process.env.POS2_ROLLOUT_MODE, branches: process.env.POS2_PILOT_BRANCH_IDS, registers: process.env.POS2_PILOT_REGISTER_IDS };
    try {
      process.env.POS2_ROLLOUT_MODE = "PILOT";
      process.env.POS2_PILOT_BRANCH_IDS = branchId;
      process.env.POS2_PILOT_REGISTER_IDS = registerId;
      await prisma.$transaction((tx) => lockCashSession(tx, sessionId));
      process.env.POS2_ROLLOUT_MODE = "DISABLED";
      await assert.rejects(prisma.$transaction((tx) => lockCashSession(tx, sessionId)), (error: unknown) => error instanceof DomainError && error.code === "PERMISSION_DENIED");
    } finally {
      if (previous.mode === undefined) delete process.env.POS2_ROLLOUT_MODE; else process.env.POS2_ROLLOUT_MODE = previous.mode;
      if (previous.branches === undefined) delete process.env.POS2_PILOT_BRANCH_IDS; else process.env.POS2_PILOT_BRANCH_IDS = previous.branches;
      if (previous.registers === undefined) delete process.env.POS2_PILOT_REGISTER_IDS; else process.env.POS2_PILOT_REGISTER_IDS = previous.registers;
    }
  });

  await prisma.inventoryBalance.deleteMany({ where: { branchId } });
  await prisma.inventoryProduct.delete({ where: { id: productId } });
  await t.test("the same database passes after the inconsistency is removed", async () => {
    const report = await collectPilotReadiness(prisma, { migrationDrift: false });
    assert.equal(report.status, "PASS");
  });
  await prisma.$disconnect();
});
