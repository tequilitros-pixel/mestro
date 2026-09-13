import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCapability, type CommandActor } from "@/lib/pos2/authorization";
import { requireActorBranch } from "@/lib/pos2/cash/guards";
import { reconcileValues } from "./domain";

function contentMultiplier(contentUnit: string | null): Prisma.Decimal | null {
  if (!contentUnit) return null;
  switch (contentUnit.toUpperCase()) {
    case "ML":
      return new Prisma.Decimal(1);
    case "L":
      return new Prisma.Decimal(1000);
    case "G":
      return new Prisma.Decimal(1);
    case "KG":
      return new Prisma.Decimal(1000);
    case "PIEZAS":
    case "PIEZA":
      return new Prisma.Decimal(1);
    default:
      return null;
  }
}

async function resolveLegacyBalanceSourceUnitFactor(inventoryProductId: string): Promise<Prisma.Decimal | null> {
  const product = await prisma.inventoryProduct.findUnique({ where: { id: inventoryProductId }, select: { unit: true, inventoryBaseUnit: true, normalizedContentPerUnit: true } });
  if (!product || !product.inventoryBaseUnit) {
    return null;
  }
  if ((product.unit ?? "").toLowerCase() === product.inventoryBaseUnit.toLowerCase()) return null;
  return product.normalizedContentPerUnit ?? null;
}

function toLegacyBaseUnit(quantity: Prisma.Decimal, contentPerUnit: Prisma.Decimal | null, contentUnit: string | null, productFactor: Prisma.Decimal | null) {
  const rowFactor = contentPerUnit && contentMultiplier(contentUnit) ? contentPerUnit.times(contentMultiplier(contentUnit)!) : null;
  const conversionFactor = rowFactor ?? productFactor;
  return conversionFactor ? quantity.times(conversionFactor) : quantity;
}

export async function getBranchInventory(actor: CommandActor, branchId: string) { requireActorBranch(actor, branchId); await prisma.$transaction((tx) => requireCapability(tx, actor, "inventory.view", branchId)); return prisma.inventoryBalance.findMany({ where: { branchId }, include: { inventoryProduct: true }, orderBy: { inventoryProduct: { name: "asc" } } }); }
export async function getInventoryMovements(actor: CommandActor, input: { branchId: string; inventoryProductId?: string; movementType?: never; sourceType?: never; sourceId?: string; cursor?: string; take?: number }) { requireActorBranch(actor, input.branchId); await prisma.$transaction((tx) => requireCapability(tx, actor, "inventory.view", input.branchId)); return prisma.inventoryMovement.findMany({ where: { branchId: input.branchId, inventoryProductId: input.inventoryProductId, sourceId: input.sourceId }, include: { inventoryProduct: { select: { name: true, code: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: Math.min(input.take ?? 50, 200), ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}) }); }
export async function reconcileInventoryProduct(actor: CommandActor, branchId: string, inventoryProductId: string) { requireActorBranch(actor, branchId); await prisma.$transaction((tx) => requireCapability(tx, actor, "inventory.reconcile", branchId)); const balance = await prisma.inventoryBalance.findUnique({ where: { branchId_inventoryProductId: { branchId, inventoryProductId } } }); const sum = await prisma.inventoryMovement.aggregate({ where: { branchId, inventoryProductId }, _sum: { quantityDelta: true } }); const projected = balance?.quantity ?? new Prisma.Decimal(0); const ledger = sum._sum.quantityDelta ?? new Prisma.Decimal(0); return { branchId, inventoryProductId, balance: projected.toFixed(6), ledger: ledger.toFixed(6), status: reconcileValues(projected.toString(), ledger.toString()) }; }
export async function reconcileBranchInventory(actor: CommandActor, branchId: string) { const balances = await getBranchInventory(actor, branchId); return Promise.all(balances.map((b) => reconcileInventoryProduct(actor, branchId, b.inventoryProductId))); }

export async function getLegacyBalance(branchId: string, inventoryProductId: string) {
  const count = await prisma.inventoryCount.findFirst({
    where: { branchId, status: "CERRADO" },
    orderBy: { countDate: "desc" },
    include: { items: { where: { productId: inventoryProductId } } },
  });
  const since = count?.countDate ?? new Date(0);
  const [entries, productFactor] = await Promise.all([
    prisma.inventoryEntry.findMany({ where: { branchId, productId: inventoryProductId, entryDate: { gt: since } } }),
    resolveLegacyBalanceSourceUnitFactor(inventoryProductId),
  ]);
  const counted = count?.items[0]?.quantityCounted ?? new Prisma.Decimal(0);
  const baseCounted = toLegacyBaseUnit(counted, null, null, productFactor);
  const sumEntries = entries.reduce((sum, entry) => sum.plus(toLegacyBaseUnit(entry.quantity, entry.contentPerUnit, entry.contentUnit, productFactor)), new Prisma.Decimal(0));
  return baseCounted.plus(sumEntries);
}
