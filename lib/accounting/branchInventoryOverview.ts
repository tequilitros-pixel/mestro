import { addDaysToDateOnly, businessDayStart } from "@/lib/dateOnly";
import { prisma } from "@/lib/prisma";
import { costPerInventoryBaseUnit, inventoryBaseUnitLabel } from "./inventoryCost";
import { summarizeBranchInventory, type BranchInventoryOverview, type InventoryConsumptionRow, type InventoryTheoreticalRow } from "./branchInventorySummary";

export type { BranchInventoryOverview } from "./branchInventorySummary";

export async function getBranchInventoryOverview(input: {
  branchId: string;
  from: string;
  to: string;
}): Promise<BranchInventoryOverview> {
  const start = businessDayStart(input.from);
  const end = businessDayStart(addDaysToDateOnly(input.to, 1));
  const [entries, movements, balances, sales] = await Promise.all([
    prisma.inventoryEntry.findMany({
      where: {
        branchId: input.branchId,
        entryDate: { gte: start, lt: end },
        type: { in: ["VENTA_POS", "DEVOLUCION_POS"] },
      },
      select: {
        productId: true,
        type: true,
        quantity: true,
        unitCost: true,
        product: { select: { code: true, name: true, category: true, unit: true, unitCost: true } },
      },
    }),
    prisma.inventoryMovement.findMany({
      where: {
        branchId: input.branchId,
        createdAt: { gte: start, lt: end },
        movementType: { in: ["SALE_CONSUMPTION", "SALE_REVERSAL"] },
      },
      select: {
        inventoryProductId: true,
        movementType: true,
        quantityDelta: true,
        inventoryProduct: { select: { code: true, name: true, category: true, unit: true, unitCost: true, inventoryBaseUnit: true, normalizedContentPerUnit: true } },
      },
    }),
    prisma.inventoryBalance.findMany({
      where: { branchId: input.branchId },
      select: { inventoryProductId: true },
    }),
    prisma.posSale.findMany({
      where: {
        branchId: input.branchId,
        status: "COMPLETADA",
        createdAt: { gte: start, lt: end },
      },
      select: {
        items: {
          where: { isCustom: false },
          select: {
            quantity: true,
            variant: {
              select: {
                ingredients: {
                  select: {
                    quantity: true,
                    unit: true,
                    unitStatus: true,
                    inventoryProduct: { select: { id: true, code: true, name: true, category: true, unit: true, unitCost: true, inventoryBaseUnit: true, normalizedContentPerUnit: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const v2ProductIds = new Set(balances.map((balance) => balance.inventoryProductId));
  const actualRows: InventoryConsumptionRow[] = [
    ...entries
      .filter((entry) => !v2ProductIds.has(entry.productId))
      .map((entry) => ({
        productId: entry.productId,
        code: entry.product.code,
        name: entry.product.name,
        category: entry.product.category,
        unit: entry.product.unit,
        quantity: Number(entry.quantity),
        unitCost: entry.unitCost === null ? (entry.product.unitCost === null ? null : Number(entry.product.unitCost)) : Number(entry.unitCost),
        direction: entry.type === "DEVOLUCION_POS" || Number(entry.quantity) > 0 ? "reversal" as const : "consumption" as const,
      })),
    ...movements.map((movement) => ({
      productId: movement.inventoryProductId,
      code: movement.inventoryProduct.code,
      name: movement.inventoryProduct.name,
      category: movement.inventoryProduct.category,
      unit: inventoryBaseUnitLabel(movement.inventoryProduct.inventoryBaseUnit, movement.inventoryProduct.unit),
      quantity: Number(movement.quantityDelta),
      unitCost: costPerInventoryBaseUnit(movement.inventoryProduct),
      direction: movement.movementType === "SALE_REVERSAL" || Number(movement.quantityDelta) > 0 ? "reversal" as const : "consumption" as const,
    })),
  ];
  const theoreticalRows: InventoryTheoreticalRow[] = sales.flatMap((sale) => sale.items.flatMap((item) =>
    item.variant?.ingredients.map((ingredient) => {
      const isBaseUnitRecipe = ingredient.unitStatus === "RESOLVED" && ingredient.unit === ingredient.inventoryProduct.inventoryBaseUnit;
      return {
        productId: ingredient.inventoryProduct.id,
        code: ingredient.inventoryProduct.code,
        name: ingredient.inventoryProduct.name,
        category: ingredient.inventoryProduct.category,
        unit: isBaseUnitRecipe ? inventoryBaseUnitLabel(ingredient.inventoryProduct.inventoryBaseUnit, ingredient.inventoryProduct.unit) : ingredient.inventoryProduct.unit,
        quantity: Number(ingredient.quantity) * item.quantity,
        unitCost: isBaseUnitRecipe ? costPerInventoryBaseUnit(ingredient.inventoryProduct) : (ingredient.inventoryProduct.unitCost === null ? null : Number(ingredient.inventoryProduct.unitCost)),
      };
    }) ?? [],
  ));

  return summarizeBranchInventory({ actualRows, theoreticalRows, saleCount: sales.length });
}
