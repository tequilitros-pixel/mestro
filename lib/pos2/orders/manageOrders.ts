import "server-only";
import { Prisma } from "@prisma/client";
import { DomainError } from "@/lib/domain/errors";
import { Money } from "@/lib/domain/money";
import { appendAuditEvent } from "@/lib/pos2/audit";
import { requireCapability, type CommandActor } from "@/lib/pos2/authorization";
import { requireActorBranch, requireActiveTerminal } from "@/lib/pos2/cash/guards";
import { executeIdempotent } from "@/lib/pos2/idempotency";
import { resolvePricesBatch } from "@/lib/pos2/pricing/resolvePrice";
import { targetKey } from "@/lib/pos2/pricing/domain";
import { calculateLineTotal, canTransitionOrder, parseOrderQuantity } from "./domain";
import { lockOrder, requireExpectedVersion, requireOpenOrder } from "./guards";
import { recalculateOrderTotals, resolveOrderTarget, type OrderTarget } from "./helpers";

const orderJson = (order: { id: string; orderNumber: string; status: string; version: number; subtotal: Prisma.Decimal; discountTotal: Prisma.Decimal; total: Prisma.Decimal }) => ({ type: "Pos2Order", id: order.id, orderNumber: order.orderNumber, status: order.status, version: order.version, subtotal: order.subtotal.toFixed(2), discountTotal: order.discountTotal.toFixed(2), total: order.total.toFixed(2) } as Prisma.InputJsonObject);

export async function createOrder(input: { branchId: string; registerId: string; terminalId: string; cashSessionId: string; actor: CommandActor; operationId: string; expiresAt?: Date | null }) {
  const payload = { branchId: input.branchId, registerId: input.registerId, terminalId: input.terminalId, cashSessionId: input.cashSessionId, expiresAt: input.expiresAt?.toISOString() ?? null };
  return executeIdempotent({ operationId: input.operationId, command: "CreateOrder", payload, receiptContext: { actorId: input.actor.id, branchId: input.branchId }, execute: async (tx) => {
    requireActorBranch(input.actor, input.branchId); await requireCapability(tx, input.actor, "pos.order.create", input.branchId);
    const register = await tx.register.findUnique({ where: { id: input.registerId } });
    const terminal = await requireActiveTerminal(tx, { terminalId: input.terminalId, branchId: input.branchId });
    const session = await tx.cashSession.findUnique({ where: { id: input.cashSessionId } });
    const branch = await tx.branch.findUnique({ where: { id: input.branchId }, select: { code: true, active: true } });
    void terminal;
    if (!branch?.active || !register?.active || register.branchId !== input.branchId) throw new DomainError("VALIDATION_ERROR", { field: "registerId" });
    if (!session || session.status !== "OPEN" || session.branchId !== input.branchId || session.registerId !== input.registerId) throw new DomainError("CASH_SESSION_NOT_OPEN", { cashSessionId: input.cashSessionId });
    const sequence = await tx.$queryRaw<Array<{ value: bigint }>>`SELECT nextval('pos2_order_number_seq') AS value`;
    const now = new Date(); const day = now.toISOString().slice(0, 10).replaceAll("-", "");
    const order = await tx.pos2Order.create({ data: { orderNumber: `${branch.code}-${day}-${sequence[0].value.toString().padStart(6, "0")}`, branchId: input.branchId, registerId: input.registerId, terminalId: input.terminalId, cashSessionId: input.cashSessionId, createdById: input.actor.id, lastModifiedById: input.actor.id, pricingTimestamp: now, expiresAt: input.expiresAt ?? null } });
    await appendAuditEvent(tx, { actorId: input.actor.id, branchId: input.branchId, terminalId: input.terminalId, action: "ORDER_CREATED", entityType: "Pos2Order", entityId: order.id, operationId: input.operationId, metadata: { orderNumber: order.orderNumber, registerId: input.registerId, cashSessionId: input.cashSessionId } });
    return orderJson(order);
  } });
}

export async function addOrderLine(input: OrderTarget & { orderId: string; quantity: string; expectedOrderVersion: number; actor: CommandActor; operationId: string }) {
  const payload = { orderId: input.orderId, targetKey: targetKey(input), quantity: input.quantity, expectedOrderVersion: input.expectedOrderVersion };
  return executeIdempotent({ operationId: input.operationId, command: "AddOrderLine", payload, receiptContext: { actorId: input.actor.id }, execute: async (tx) => {
    const order = await lockOrder(tx, input.orderId); authorizeEdit(input.actor, order.branchId); await requireCapability(tx, input.actor, "pos.order.edit", order.branchId); requireOpenOrder(order); requireExpectedVersion(order, input.expectedOrderVersion);
    const now = new Date(); const resolved = await resolveOrderTarget(tx, { ...input, branchId: order.branchId, at: now }); const key = targetKey(input);
    const existing = order.lines.find((line) => line.targetKey === key && line.priceVersionId === resolved.price.priceVersionId);
    if (existing) {
      let combined; try { combined = parseOrderQuantity(existing.quantity.add(resolved.quantity.toDecimal()).toString(), existing.unit); } catch { throw new DomainError("INVALID_QUANTITY", { unit: existing.unit }); }
      const total = calculateLineTotal(resolved.price.amount, combined.toDecimal().toString());
      await tx.pos2OrderLine.update({ where: { id: existing.id }, data: { quantity: combined.toDecimal(), unitPrice: Money.from(resolved.price.amount).toDecimal(), lineSubtotal: total.toDecimal(), lineTotal: total.toDecimal(), catalogVersion: resolved.catalogVersion, pricingExplanation: resolved.price.explanation } });
    } else {
      await tx.pos2OrderLine.create({ data: { orderId: order.id, productId: input.productId ?? null, variantId: input.variantId ?? null, targetKey: key, displayName: resolved.displayName, catalogVersion: resolved.catalogVersion, quantity: resolved.quantity.toDecimal(), unit: resolved.unit, unitPrice: Money.from(resolved.price.amount).toDecimal(), lineSubtotal: resolved.lineTotal.toDecimal(), lineTotal: resolved.lineTotal.toDecimal(), priceVersionId: resolved.price.priceVersionId, pricingExplanation: resolved.price.explanation, position: order.lines.length } });
    }
    const updated = await recalculateOrderTotals(tx, order.id, input.actor.id, now);
    await appendAuditEvent(tx, { actorId: input.actor.id, branchId: order.branchId, terminalId: order.terminalId, action: "ORDER_LINE_ADDED", entityType: "Pos2Order", entityId: order.id, operationId: input.operationId, metadata: { targetKey: key, quantity: resolved.quantity.toString(), priceVersionId: resolved.price.priceVersionId, combined: Boolean(existing), version: updated.version } });
    return orderJson(updated);
  } });
}

export async function updateOrderLineQuantity(input: { orderId: string; lineId: string; quantity: string; expectedOrderVersion: number; actor: CommandActor; operationId: string }) {
  const payload = { orderId: input.orderId, lineId: input.lineId, quantity: input.quantity, expectedOrderVersion: input.expectedOrderVersion };
  return executeIdempotent({ operationId: input.operationId, command: "UpdateOrderLineQuantity", payload, receiptContext: { actorId: input.actor.id }, execute: async (tx) => {
    const order = await lockOrder(tx, input.orderId); authorizeEdit(input.actor, order.branchId); await requireCapability(tx, input.actor, "pos.order.edit", order.branchId); requireOpenOrder(order); requireExpectedVersion(order, input.expectedOrderVersion);
    const line = order.lines.find((item) => item.id === input.lineId); if (!line) throw new DomainError("VALIDATION_ERROR", { field: "lineId" });
    const now = new Date(); const resolved = await resolveOrderTarget(tx, { ...(line.variantId ? { variantId: line.variantId } : { productId: line.productId! }), branchId: order.branchId, quantity: input.quantity, at: now });
    await tx.pos2OrderLine.update({ where: { id: line.id }, data: { quantity: resolved.quantity.toDecimal(), unit: resolved.unit, unitPrice: Money.from(resolved.price.amount).toDecimal(), lineSubtotal: resolved.lineTotal.toDecimal(), lineTotal: resolved.lineTotal.toDecimal(), priceVersionId: resolved.price.priceVersionId, pricingExplanation: resolved.price.explanation, catalogVersion: resolved.catalogVersion } });
    const updated = await recalculateOrderTotals(tx, order.id, input.actor.id, now);
    await appendAuditEvent(tx, { actorId: input.actor.id, branchId: order.branchId, action: "ORDER_LINE_UPDATED", entityType: "Pos2OrderLine", entityId: line.id, operationId: input.operationId, metadata: { orderId: order.id, quantity: resolved.quantity.toString(), priceVersionId: resolved.price.priceVersionId, version: updated.version } });
    return orderJson(updated);
  } });
}

export async function removeOrderLine(input: { orderId: string; lineId: string; expectedOrderVersion: number; actor: CommandActor; operationId: string }) {
  const payload = { orderId: input.orderId, lineId: input.lineId, expectedOrderVersion: input.expectedOrderVersion };
  return executeIdempotent({ operationId: input.operationId, command: "RemoveOrderLine", payload, receiptContext: { actorId: input.actor.id }, execute: async (tx) => {
    const order = await lockOrder(tx, input.orderId); authorizeEdit(input.actor, order.branchId); await requireCapability(tx, input.actor, "pos.order.edit", order.branchId); requireOpenOrder(order); requireExpectedVersion(order, input.expectedOrderVersion);
    const line = order.lines.find((item) => item.id === input.lineId); if (line) await tx.pos2OrderLine.delete({ where: { id: line.id } });
    const updated = await recalculateOrderTotals(tx, order.id, input.actor.id, new Date());
    await appendAuditEvent(tx, { actorId: input.actor.id, branchId: order.branchId, action: "ORDER_LINE_REMOVED", entityType: "Pos2Order", entityId: order.id, operationId: input.operationId, metadata: { lineId: input.lineId, existed: Boolean(line), version: updated.version } });
    return orderJson(updated);
  } });
}

type RepriceFinding = { lineId: string; targetKey: string; status: "UNCHANGED" | "PRICE_CHANGED" | "PRICE_NOT_CONFIGURED" | "PRODUCT_UNAVAILABLE"; storedPriceVersionId: string; currentPriceVersionId?: string };

async function repriceLocked(tx: Prisma.TransactionClient, order: Awaited<ReturnType<typeof lockOrder>>, actorId: string, apply: boolean) {
  const at = new Date();
  const productIds = order.lines.map((line) => line.productId).filter((id): id is string => Boolean(id)); const variantIds = order.lines.map((line) => line.variantId).filter((id): id is string => Boolean(id));
  const products = await tx.posProduct.findMany({ where: { id: { in: productIds } }, include: { branchOverrides: { where: { branchId: order.branchId }, take: 1 } } });
  const variants = await tx.posProductVariant.findMany({ where: { id: { in: variantIds } }, include: { product: { include: { branchOverrides: { where: { branchId: order.branchId }, take: 1 } } } } });
  const prices = await resolvePricesBatch(order.lines.map((line) => ({ ...(line.variantId ? { variantId: line.variantId } : { productId: line.productId! }), branchId: order.branchId, at })), tx);
  const productMap = new Map(products.map((item) => [item.id, item])); const variantMap = new Map(variants.map((item) => [item.id, item])); const findings: RepriceFinding[] = [];
  for (let index = 0; index < order.lines.length; index += 1) {
    const line = order.lines[index]; const product = line.variantId ? variantMap.get(line.variantId)?.product : productMap.get(line.productId!); const variant = line.variantId ? variantMap.get(line.variantId) : null;
    const override = product?.branchOverrides[0]; const available = Boolean(product?.active && product.sellable && !product.archivedAt && (!override || override.enabled && override.visibleInPos && override.availability === "AVAILABLE") && (!variant || variant.active));
    const price = prices[index]; const status: RepriceFinding["status"] = !available ? "PRODUCT_UNAVAILABLE" : !price ? "PRICE_NOT_CONFIGURED" : price.priceVersionId === line.priceVersionId ? "UNCHANGED" : "PRICE_CHANGED";
    findings.push({ lineId: line.id, targetKey: line.targetKey, status, storedPriceVersionId: line.priceVersionId, ...(price ? { currentPriceVersionId: price.priceVersionId } : {}) });
    if (apply && price && available && status === "PRICE_CHANGED") {
      const total = Money.from(price.amount).multiply(line.quantity);
      await tx.pos2OrderLine.update({ where: { id: line.id }, data: { unitPrice: Money.from(price.amount).toDecimal(), lineSubtotal: total.toDecimal(), lineTotal: total.toDecimal(), priceVersionId: price.priceVersionId, pricingExplanation: price.explanation } });
    }
  }
  const blocking = findings.find((item) => item.status === "PRICE_NOT_CONFIGURED" || item.status === "PRODUCT_UNAVAILABLE");
  if (blocking) throw new DomainError(blocking.status === "PRICE_NOT_CONFIGURED" ? "PRICE_NOT_CONFIGURED" : "PRODUCT_UNAVAILABLE", { orderId: order.id, lineId: blocking.lineId });
  const changed = findings.find((item) => item.status === "PRICE_CHANGED");
  if (!apply && changed) throw new DomainError("PRICE_CHANGED", { orderId: order.id, lineId: changed.lineId, storedPriceVersionId: changed.storedPriceVersionId, currentPriceVersionId: changed.currentPriceVersionId ?? null });
  const updated = apply ? await recalculateOrderTotals(tx, order.id, actorId, at) : order;
  return { findings, updated, at };
}

export async function repriceOrder(input: { orderId: string; expectedOrderVersion: number; actor: CommandActor; operationId: string }) {
  return executeIdempotent({ operationId: input.operationId, command: "RepriceOrder", payload: { orderId: input.orderId, expectedOrderVersion: input.expectedOrderVersion }, receiptContext: { actorId: input.actor.id }, execute: async (tx) => {
    const order = await lockOrder(tx, input.orderId); authorizeEdit(input.actor, order.branchId); await requireCapability(tx, input.actor, "pos.order.edit", order.branchId); requireExpectedVersion(order, input.expectedOrderVersion);
    if (order.status !== "OPEN" && order.status !== "PAYMENT_PENDING") throw new DomainError("ORDER_NOT_OPEN", { orderId: order.id });
    const result = await repriceLocked(tx, order, input.actor.id, order.status === "OPEN");
    await appendAuditEvent(tx, { actorId: input.actor.id, branchId: order.branchId, action: "ORDER_REPRICED", entityType: "Pos2Order", entityId: order.id, operationId: input.operationId, metadata: { changed: result.findings.filter((item) => item.status === "PRICE_CHANGED").length, version: result.updated.version } });
    return { ...orderJson(result.updated), findings: result.findings } as Prisma.InputJsonObject;
  } });
}

export async function beginPayment(input: { orderId: string; expectedOrderVersion: number; actor: CommandActor; operationId: string }) {
  return executeIdempotent({ operationId: input.operationId, command: "BeginPayment", payload: { orderId: input.orderId, expectedOrderVersion: input.expectedOrderVersion }, receiptContext: { actorId: input.actor.id }, execute: async (tx) => {
    const order = await lockOrder(tx, input.orderId); authorizeEdit(input.actor, order.branchId); await requireCapability(tx, input.actor, "pos.payment.begin", order.branchId); requireOpenOrder(order); requireExpectedVersion(order, input.expectedOrderVersion); if (!order.lines.length) throw new DomainError("ORDER_EMPTY", { orderId: order.id });
    const session = await tx.cashSession.findUnique({ where: { id: order.cashSessionId } }); if (session?.status !== "OPEN") throw new DomainError("CASH_SESSION_NOT_OPEN", { cashSessionId: order.cashSessionId });
    const repriced = await repriceLocked(tx, order, input.actor.id, true);
    const updated = await tx.pos2Order.update({ where: { id: order.id }, data: { status: "PAYMENT_PENDING", version: { increment: 1 }, lastModifiedById: input.actor.id }, include: { lines: true } });
    await appendAuditEvent(tx, { actorId: input.actor.id, branchId: order.branchId, terminalId: order.terminalId, action: "ORDER_PAYMENT_STARTED", entityType: "Pos2Order", entityId: order.id, operationId: input.operationId, metadata: { version: updated.version, repriced: repriced.findings.filter((item) => item.status === "PRICE_CHANGED").length } }); return orderJson(updated);
  } });
}

export async function resumeOrder(input: { orderId: string; expectedOrderVersion: number; actor: CommandActor; operationId: string }) { return transition(input, "ResumeOrder", "OPEN", "ORDER_PAYMENT_ABORTED", "pos.order.edit"); }
export async function voidOrder(input: { orderId: string; expectedOrderVersion: number; actor: CommandActor; operationId: string; reason: string }) {
  if (input.reason.trim().length < 3) throw new DomainError("VALIDATION_ERROR", { field: "reason" }); return transition(input, "VoidOrder", "VOIDED", "ORDER_VOIDED", "pos.order.void", input.reason.trim());
}
export async function expireOrder(input: { orderId: string; expectedOrderVersion: number; actor: CommandActor; operationId: string }) { return transition(input, "ExpireOrder", "EXPIRED", "ORDER_EXPIRED", "pos.order.edit"); }

async function transition(input: { orderId: string; expectedOrderVersion: number; actor: CommandActor; operationId: string }, command: string, target: "OPEN" | "VOIDED" | "EXPIRED", action: string, capability: "pos.order.edit" | "pos.order.void", reason?: string) {
  return executeIdempotent({ operationId: input.operationId, command, payload: { orderId: input.orderId, expectedOrderVersion: input.expectedOrderVersion, reason: reason ?? null }, receiptContext: { actorId: input.actor.id }, execute: async (tx) => {
    const order = await lockOrder(tx, input.orderId); authorizeEdit(input.actor, order.branchId); await requireCapability(tx, input.actor, capability, order.branchId); requireExpectedVersion(order, input.expectedOrderVersion);
    if (!canTransitionOrder(order.status, target)) throw new DomainError(order.status === "FINALIZED" ? "ORDER_ALREADY_FINALIZED" : "INVALID_STATE_TRANSITION", { orderId: order.id, from: order.status, to: target });
    if (target === "EXPIRED" && (!order.expiresAt || order.expiresAt > new Date())) throw new DomainError("INVALID_STATE_TRANSITION", { orderId: order.id, reason: "not_expired" });
    const updated = await tx.pos2Order.update({ where: { id: order.id }, data: { status: target, lastModifiedById: input.actor.id, version: { increment: 1 }, ...(target === "VOIDED" ? { voidedAt: new Date(), voidReason: reason } : {}) } });
    await appendAuditEvent(tx, { actorId: input.actor.id, branchId: order.branchId, terminalId: order.terminalId, action, entityType: "Pos2Order", entityId: order.id, operationId: input.operationId, metadata: { from: order.status, to: target, reason: reason ?? null, version: updated.version } }); return orderJson(updated);
  } });
}

function authorizeEdit(actor: CommandActor, branchId: string) { requireActorBranch(actor, branchId); }

/** Reserved exclusively for future CompleteSale; deliberately not exported from any route. */
export async function finalizeOrderFromCompleteSale(tx: Prisma.TransactionClient, input: { orderId: string; expectedVersion: number; actorId: string }) {
  const order = await lockOrder(tx, input.orderId); requireExpectedVersion(order, input.expectedVersion); if (!canTransitionOrder(order.status, "FINALIZED")) throw new DomainError("INVALID_STATE_TRANSITION", { orderId: order.id });
  return tx.pos2Order.update({ where: { id: order.id }, data: { status: "FINALIZED", finalizedAt: new Date(), lastModifiedById: input.actorId, version: { increment: 1 } } });
}
