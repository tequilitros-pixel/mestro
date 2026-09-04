import "server-only";
import type { CatalogBaseUnit, Prisma } from "@prisma/client";
import { DomainError } from "@/lib/domain/errors";
import { Money } from "@/lib/domain/money";
import { resolveEffectiveProduct } from "@/lib/pos2/catalog/domain";
import { resolvePrice } from "@/lib/pos2/pricing/resolvePrice";
import { parseOrderQuantity } from "./domain";
import { recalculateAutomaticAdjustments } from "@/lib/pos2/adjustments/service";

export type OrderTarget = { productId: string; variantId?: never } | { variantId: string; productId?: never };

export async function resolveOrderTarget(tx: Prisma.TransactionClient, input: OrderTarget & { branchId: string; quantity: string; at: Date }) {
  const product = input.variantId
    ? (await tx.posProductVariant.findUnique({ where: { id: input.variantId }, include: { product: { include: { branchOverrides: { where: { branchId: input.branchId }, take: 1 } } } } }))?.product
    : await tx.posProduct.findUnique({ where: { id: input.productId }, include: { branchOverrides: { where: { branchId: input.branchId }, take: 1 } } });
  const variant = input.variantId ? await tx.posProductVariant.findUnique({ where: { id: input.variantId } }) : null;
  if (!product || (input.variantId && !variant)) throw new DomainError("PRODUCT_UNAVAILABLE", { target: input.variantId ?? input.productId! });
  const effective = resolveEffectiveProduct(product, product.branchOverrides[0] ?? null);
  if (!effective.effective.enabled || !effective.effective.visibleInPos || (variant && !variant.active)) throw new DomainError("PRODUCT_UNAVAILABLE", { productId: product.id });
  const unit: CatalogBaseUnit = variant?.baseUnit ?? product.baseUnit;
  let quantity;
  try { quantity = parseOrderQuantity(input.quantity, unit); } catch { throw new DomainError("INVALID_QUANTITY", { unit }); }
  const price = await resolvePrice({ branchId: input.branchId, at: input.at, ...(input.variantId ? { variantId: input.variantId } : { productId: input.productId }) }, tx);
  const lineTotal = Money.from(price.amount).multiply(quantity.toDecimal());
  return { product, variant, unit, quantity, price, lineTotal, displayName: variant ? `${product.name} · ${variant.name}` : product.name, catalogVersion: variant?.version ?? product.version };
}

export async function recalculateOrderTotals(tx: Prisma.TransactionClient, orderId: string, actorId: string, pricingTimestamp: Date) {
  return recalculateAutomaticAdjustments(tx, orderId, actorId, pricingTimestamp);
}
