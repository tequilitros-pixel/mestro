import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/domain/errors";
import { generateOperationId } from "@/lib/pos2/operationId";
import { addOrderLine, beginPayment, voidOrder } from "@/lib/pos2/orders/manageOrders";
import { completeSale } from "@/lib/pos2/sales/completeSale";

const enabled = Boolean(process.env.PHASE3I_TEST_DATABASE_URL);

test("POS 2.0 exact concurrency and lost-response scenarios", { skip: !enabled, timeout: 120_000 }, async (t) => {
  const p = "p3i";
  const admin = { id: `${p}-admin`, role: "ADMIN" as const, branchIds: null };
  const branchId = `${p}-branch`, registerId = `${p}-register`, terminalId = `${p}-terminal`, sessionId = `${p}-session`;
  const categoryId = `${p}-category`, productId = `${p}-product`, variantId = `${p}-variant`, priceId = `${p}-price`;

  await prisma.user.create({ data: { id: admin.id, name: "Concurrency Admin", username: admin.id, password: "test", role: "ADMIN" } });
  await prisma.branch.create({ data: { id: branchId, name: "Concurrency Branch", code: "S3I" } });
  await prisma.register.create({ data: { id: registerId, branchId, code: "R", name: "Register", createdById: admin.id } });
  await prisma.terminal.create({ data: { id: terminalId, branchId, name: "Terminal", status: "ACTIVE", credentialHash: "hash", createdById: admin.id } });
  await prisma.cashSession.create({ data: { id: sessionId, branchId, registerId, openingTerminalId: terminalId, openedById: admin.id, status: "OPEN" } });
  await prisma.posCategory.create({ data: { id: categoryId, name: "Concurrency", slug: "p3i", active: true, position: 0 } });
  await prisma.posProduct.create({ data: { id: productId, categoryId, name: "Synthetic Drink", active: true, sellable: true, inventoryTracked: false, baseUnit: "UNIT", createdById: admin.id } });
  await prisma.posProductVariant.create({ data: { id: variantId, productId, name: "Regular", baseUnit: "UNIT", price: 100, active: true } });
  await prisma.priceVersion.create({ data: { id: priceId, targetType: "VARIANT", targetKey: `VARIANT:${variantId}`, variantId, scope: "GLOBAL", branchKey: "GLOBAL", amount: "100", createdById: admin.id, operationId: generateOperationId(), validFrom: new Date("2026-01-01Z") } });

  const openOrder = (id: string, orderNumber: string, withLine: boolean) => prisma.pos2Order.create({
    data: {
      id, orderNumber, branchId, registerId, terminalId, cashSessionId: sessionId, createdById: admin.id, lastModifiedById: admin.id,
      status: "OPEN", subtotal: withLine ? "100" : "0", discountTotal: "0", total: withLine ? "100" : "0", pricingTimestamp: new Date(), version: 1,
      ...(withLine ? { lines: { create: { variantId, targetKey: `VARIANT:${variantId}`, displayName: "Synthetic Drink — Regular", catalogVersion: 1, quantity: "1", unit: "UNIT", unitPrice: "100", lineSubtotal: "100", discountTotal: "0", lineTotal: "100", priceVersionId: priceId, pricingExplanation: "GLOBAL_BASE_PRICE", position: 0 } } } : {}),
    }, include: { lines: true },
  });

  await t.test("edición concurrente del mismo pedido acepta una versión y rechaza la obsoleta", async () => {
    const order = await openOrder(`${p}-edit-order`, `${p}-EDIT`, false);
    const results = await Promise.allSettled([
      addOrderLine({ orderId: order.id, variantId, quantity: "1", expectedOrderVersion: 1, actor: admin, operationId: generateOperationId() }),
      addOrderLine({ orderId: order.id, variantId, quantity: "2", expectedOrderVersion: 1, actor: admin, operationId: generateOperationId() }),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected" && result.reason instanceof DomainError && result.reason.code === "ORDER_VERSION_CONFLICT").length, 1);
    const stored = await prisma.pos2Order.findUniqueOrThrow({ where: { id: order.id }, include: { lines: true } });
    assert.equal(stored.version, 2);
    assert.equal(stored.lines.length, 1);
  });

  await t.test("cancelación contra inicio de cobro tiene un único ganador semántico", async () => {
    const order = await openOrder(`${p}-cancel-order`, `${p}-CANCEL`, true);
    const results = await Promise.allSettled([
      beginPayment({ orderId: order.id, expectedOrderVersion: 1, actor: admin, operationId: generateOperationId() }),
      voidOrder({ orderId: order.id, expectedOrderVersion: 1, actor: admin, operationId: generateOperationId(), reason: "Cliente cancela" }),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const stored = await prisma.pos2Order.findUniqueOrThrow({ where: { id: order.id } });
    assert.ok(stored.status === "PAYMENT_PENDING" || stored.status === "VOIDED");
    assert.equal(await prisma.pos2Sale.count({ where: { orderId: order.id } }), 0);
  });

  await t.test("pérdida de respuesta después del commit local se recupera por replay idempotente", async () => {
    const source = await openOrder(`${p}-lost-response-order`, `${p}-LOST`, true);
    const order = await prisma.pos2Order.update({ where: { id: source.id }, data: { status: "PAYMENT_PENDING" } });
    const operationId = generateOperationId();
    await completeSale({ orderId: order.id, expectedOrderVersion: order.version, cashSessionId: sessionId, terminalId, actor: admin, operationId, payments: [{ method: "CARD", amount: "100", reference: "SYNTHETIC-AUTH" }] });
    const replay = await completeSale({ orderId: order.id, expectedOrderVersion: order.version, cashSessionId: sessionId, terminalId, actor: admin, operationId, payments: [{ method: "CARD", amount: "100", reference: "SYNTHETIC-AUTH" }] });
    assert.equal(replay.replayed, true);
    assert.equal(await prisma.pos2Sale.count({ where: { orderId: order.id } }), 1);
    assert.equal(await prisma.pos2Payment.count({ where: { sale: { orderId: order.id } } }), 1);
    assert.equal(await prisma.operationReceipt.count({ where: { operationId } }), 1);
  });

  await prisma.$disconnect();
});
