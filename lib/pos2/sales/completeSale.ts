import "server-only";
import { Prisma, type Pos2PaymentMethod } from "@prisma/client";
import { DomainError } from "@/lib/domain/errors";
import { executeIdempotent } from "@/lib/pos2/idempotency";
import { requireCapability, type CommandActor } from "@/lib/pos2/authorization";
import { lockCashSession, requireActiveTerminal, requireActorBranch } from "@/lib/pos2/cash/guards";
import { lockOrder, requireExpectedVersion } from "@/lib/pos2/orders/guards";
import { resolvePricesBatch } from "@/lib/pos2/pricing/resolvePrice";
import { applyInventoryBatchInTransaction } from "@/lib/pos2/inventory/applyMovements";
import { appendAuditEvent } from "@/lib/pos2/audit";
import { appendOutboxEvent } from "@/lib/pos2/outbox";
import { validatePayments, type PaymentInput } from "./paymentDomain";
import { resolveSaleInventory } from "./recipe";
import { validateFrozenAdjustments } from "@/lib/pos2/adjustments/service";

type Fault = "AFTER_SALE" | "AFTER_ADJUSTMENTS" | "AFTER_PAYMENTS" | "AFTER_FIRST_INVENTORY" | "BEFORE_FINALIZE";
type Input = { orderId: string; expectedOrderVersion: number; cashSessionId: string; terminalId: string; payments: PaymentInput[]; actor: CommandActor; operationId: string; faultInjectionForTest?: Fault };

function inject(input: Input, point: Fault) { if (input.faultInjectionForTest === point && process.env.NODE_ENV !== "production") throw new Error(`TEST_FAILURE_${point}`); }

export async function completeSale(input: Input) {
  const payload = { orderId: input.orderId, expectedOrderVersion: input.expectedOrderVersion, cashSessionId: input.cashSessionId, terminalId: input.terminalId, payments: input.payments };
  return executeIdempotent({ operationId: input.operationId, command: "CompleteSale", payload, receiptContext: { actorId: input.actor.id }, execute: async (tx) => {
    const order = await lockOrder(tx, input.orderId);
    requireActorBranch(input.actor, order.branchId);
    await requireCapability(tx, input.actor, "pos.sale.complete", order.branchId);
    requireExpectedVersion(order, input.expectedOrderVersion);
    if (order.status === "FINALIZED") throw new DomainError("ORDER_ALREADY_FINALIZED", { orderId: order.id });
    if (order.status !== "PAYMENT_PENDING") throw new DomainError("INVALID_STATE_TRANSITION", { orderId: order.id, status: order.status });
    if (!order.lines.length) throw new DomainError("ORDER_EMPTY", { orderId: order.id });
    await requireActiveTerminal(tx, { terminalId: input.terminalId, branchId: order.branchId });
    if (input.cashSessionId !== order.cashSessionId) throw new DomainError("CASH_SESSION_NOT_OPEN", { cashSessionId: input.cashSessionId });
    const session = await lockCashSession(tx, input.cashSessionId);
    if (session.status !== "OPEN" || session.branchId !== order.branchId || session.registerId !== order.registerId) throw new DomainError("CASH_SESSION_NOT_OPEN", { cashSessionId: session.id });

    const payments = validatePayments(input.payments, order.total.toFixed(2));
    for (const method of new Set(payments.map((payment) => payment.method))) await requireCapability(tx, input.actor, `pos.payment.${method.toLowerCase()}` as "pos.payment.cash" | "pos.payment.card" | "pos.payment.transfer", order.branchId);

    const at = new Date();
    const prices = await resolvePricesBatch(order.lines.map((line) => ({ ...(line.variantId ? { variantId: line.variantId } : { productId: line.productId! }), branchId: order.branchId, at })), tx);
    const products = await tx.posProduct.findMany({ where: { id: { in: order.lines.map((line) => line.productId).filter((id): id is string => Boolean(id)) } }, include: { branchOverrides: { where: { branchId: order.branchId }, take: 1 } } });
    const variants = await tx.posProductVariant.findMany({ where: { id: { in: order.lines.map((line) => line.variantId).filter((id): id is string => Boolean(id)) } }, include: { product: { include: { branchOverrides: { where: { branchId: order.branchId }, take: 1 } } } } });
    const productMap = new Map(products.map((product) => [product.id, product])); const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
    for (let i = 0; i < order.lines.length; i += 1) {
      const line = order.lines[i]; const variant = line.variantId ? variantMap.get(line.variantId) : null; const product = variant?.product ?? (line.productId ? productMap.get(line.productId) : null); const override = product?.branchOverrides[0];
      if (!product?.active || !product.sellable || product.archivedAt || (override && (!override.enabled || !override.visibleInPos || override.availability !== "AVAILABLE")) || (variant && !variant.active)) throw new DomainError("PRODUCT_UNAVAILABLE", { lineId: line.id });
      if (!prices[i]) throw new DomainError("PRICE_NOT_CONFIGURED", { lineId: line.id });
      if (prices[i]!.priceVersionId !== line.priceVersionId || !line.unitPrice.equals(prices[i]!.amount)) throw new DomainError("PRICE_CHANGED", { lineId: line.id, storedPriceVersionId: line.priceVersionId, currentPriceVersionId: prices[i]!.priceVersionId });
    }
    let frozen;
    try { frozen = await validateFrozenAdjustments(tx, order.id, at); }
    catch (error) {
      if (error instanceof Error && error.message === "PROMOTION_CHANGED") throw new DomainError("PROMOTION_CHANGED", { orderId: order.id });
      if (error instanceof Error && error.message === "DISCOUNT_NO_LONGER_VALID") throw new DomainError("DISCOUNT_NO_LONGER_VALID", { orderId: order.id });
      throw error;
    }
    const branch = await tx.branch.findUniqueOrThrow({ where: { id: order.branchId }, select: { code: true } });
    const sequence = await tx.$queryRaw<Array<{ value: bigint }>>`SELECT nextval('pos2_sale_number_seq') AS value`;
    const day = at.toISOString().slice(0, 10).replaceAll("-", "");
    const sale = await tx.pos2Sale.create({ data: { saleNumber: `${branch.code}-${day}-S${sequence[0].value.toString().padStart(6, "0")}`, orderId: order.id, branchId: order.branchId, registerId: order.registerId, terminalId: input.terminalId, cashSessionId: session.id, cashierId: input.actor.id, currency: order.currency, subtotal: order.subtotal, discountTotal: order.discountTotal, total: order.total, operationId: input.operationId } });
    inject(input, "AFTER_SALE");
    const saleLineByOrderLine = new Map<string, string>();
    for (const line of order.lines) { const variant = line.variantId ? variantMap.get(line.variantId) : null; const product = variant?.product ?? productMap.get(line.productId!); const saleLine = await tx.pos2SaleLine.create({ data: { saleId: sale.id, orderLineId: line.id, productId: line.productId, variantId: line.variantId, productNameSnapshot: product!.name, variantNameSnapshot: variant?.name ?? null, skuSnapshot: variant?.sku ?? product!.sku, quantity: line.quantity, unit: line.unit, unitPrice: line.unitPrice, lineSubtotal: line.lineSubtotal, discountTotal: line.discountTotal, lineTotal: line.lineTotal, priceVersionId: line.priceVersionId, pricingExplanation: line.pricingExplanation, position: line.position } }); saleLineByOrderLine.set(line.id, saleLine.id); }
    const snapshots = await tx.orderAdjustment.findMany({ where: { id: { in: frozen.adjustments.map((item) => item.id) } }, include: { ruleVersion: { include: { definition: true } } } });
    for (const adjustment of snapshots) await tx.saleAdjustment.create({ data: { saleId: sale.id, saleLineId: adjustment.orderLineId ? saleLineByOrderLine.get(adjustment.orderLineId) : null, orderAdjustmentId: adjustment.id, ruleVersionId: adjustment.ruleVersionId, kind: adjustment.kind, ruleCodeSnapshot: adjustment.ruleVersion.definition.code, ruleNameSnapshot: adjustment.ruleVersion.definition.name, mechanic: adjustment.ruleVersion.mechanic, amount: adjustment.amount, percentage: adjustment.percentage, reason: adjustment.reason, beneficiaryId: adjustment.beneficiaryId, authorizedById: adjustment.authorizedById } });
    inject(input, "AFTER_ADJUSTMENTS");
    for (const payment of payments) await tx.pos2Payment.create({ data: { saleId: sale.id, branchId: order.branchId, terminalId: input.terminalId, actorId: input.actor.id, method: payment.method as Pos2PaymentMethod, amount: payment.amount.toDecimal(), cashTendered: payment.tendered?.toDecimal() ?? null, changeGiven: payment.change?.toDecimal() ?? null, reference: payment.reference?.trim() || null, position: payment.position, operationId: input.operationId } });
    inject(input, "AFTER_PAYMENTS");
    const inventory = await resolveSaleInventory(tx, sale.id, order.lines);
    if (inventory.length) await applyInventoryBatchInTransaction(tx, { branchId: order.branchId, movements: inventory, actorId: input.actor.id, operationId: input.operationId, failAfterFirstMovementForTest: input.faultInjectionForTest === "AFTER_FIRST_INVENTORY" });
    const cash = payments.filter((payment) => payment.method === "CASH").reduce((sum, payment) => sum.plus(payment.amount.toDecimal()), new Prisma.Decimal(0));
    if (cash.greaterThan(0)) await tx.cashMovement.create({ data: { cashSessionId: session.id, branchId: order.branchId, registerId: order.registerId, type: "SALE_CASH", direction: "IN", amount: cash, sourceType: "SALE", sourceId: sale.id, actorId: input.actor.id, operationId: input.operationId, metadata: { saleNumber: sale.saleNumber } } });
    inject(input, "BEFORE_FINALIZE");
    const finalized = await tx.pos2Order.update({ where: { id: order.id }, data: { status: "FINALIZED", finalizedAt: at, lastModifiedById: input.actor.id, version: { increment: 1 } } });
    await appendAuditEvent(tx, { actorId: input.actor.id, branchId: order.branchId, terminalId: input.terminalId, action: "SALE_COMPLETED", entityType: "Pos2Sale", entityId: sale.id, operationId: input.operationId, metadata: { saleNumber: sale.saleNumber, orderId: order.id, total: order.total.toFixed(2), paymentCount: payments.length } });
    for (const payment of payments) await appendAuditEvent(tx, { actorId: input.actor.id, branchId: order.branchId, terminalId: input.terminalId, action: "PAYMENT_CAPTURED", entityType: "Pos2Sale", entityId: sale.id, operationId: input.operationId, metadata: { method: payment.method, amount: payment.amount.toString(), position: payment.position } });
    await appendOutboxEvent(tx, { topic: "pos2.sale.completed", aggregate: "Pos2Sale", aggregateId: sale.id, operationId: input.operationId, payload: { saleId: sale.id, saleNumber: sale.saleNumber, orderId: order.id, total: order.total.toFixed(2), adjustmentCount: snapshots.length, discountTotal: order.discountTotal.toFixed(2) } });
    return { type: "Pos2Sale", id: sale.id, saleNumber: sale.saleNumber, orderId: order.id, orderVersion: finalized.version, status: sale.status, total: sale.total.toFixed(2), cashApplied: cash.toFixed(2), receiptUrl: `/api/pos2/sales/${sale.id}/receipt` } as Prisma.InputJsonObject;
  } });
}
