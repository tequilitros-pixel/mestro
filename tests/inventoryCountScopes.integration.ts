import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { withDatabaseActor } from "@/lib/database-context";
import { executeIdempotent } from "@/lib/pos2/idempotency";
import { reconcileWeeklyCountCutover } from "@/lib/inventory/weeklyCountCutover";
import { generateOperationId } from "@/lib/pos2/operationId";

const owner = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.OWNER_DATABASE_URL! }),
});

test("los cierres por alcance sólo ajustan las partidas del conteo", async () => {
  const suffix = Date.now().toString();
  const branchId = `scope-branch-${suffix}`;
  const adminId = `scope-admin-${suffix}`;
  const weeklyIngredientId = `scope-weekly-a-${suffix}`;
  const weeklyDrinkId = `scope-weekly-b-${suffix}`;
  const monthlyTableId = `scope-monthly-c-${suffix}`;
  const monthlyMulticontactId = `scope-monthly-d-${suffix}`;
  const weeklyCountId = `scope-weekly-count-${suffix}`;
  const monthlyCountId = `scope-monthly-count-${suffix}`;
  const actor = { id: adminId, role: "ADMIN" as const };

  await owner.$transaction(async (tx) => {
    await tx.branch.create({
      data: { id: branchId, name: "Scope Test Branch", code: `SC${suffix}` },
    });
    await tx.user.create({
      data: {
        id: adminId,
        name: "Scope Test Admin",
        username: `scope-${suffix}`,
        password: "fixture",
        role: "ADMIN",
      },
    });
    await tx.inventoryProduct.createMany({
      data: [
        {
          id: weeklyIngredientId,
          code: `SCOPE-A-${suffix}`,
          name: "Ingrediente semanal A",
          category: "TEST",
          unit: "ml",
          itemType: "CONSUMABLE",
          countFrequency: "WEEKLY",
          trackStock: true,
          inventoryBaseUnit: "ML",
          handlingUnit: "BOTELLA",
          contentPerUnit: 1800,
          contentUnit: "ML",
          normalizedContentPerUnit: 1800,
        },
        {
          id: weeklyDrinkId,
          code: `SCOPE-B-${suffix}`,
          name: "Bebida semanal B",
          category: "TEST",
          unit: "Pza",
          itemType: "CONSUMABLE",
          countFrequency: "WEEKLY",
          trackStock: true,
          inventoryBaseUnit: "UNIT",
          handlingUnit: "PAQUETE",
          contentPerUnit: 25,
          contentUnit: "PIEZAS",
          normalizedContentPerUnit: 25,
        },
        {
          id: monthlyTableId,
          code: `SCOPE-C-${suffix}`,
          name: "Mesa mensual C",
          category: "TEST",
          unit: "Pza",
          itemType: "EQUIPMENT",
          countFrequency: "MONTHLY_ONLY",
          trackStock: true,
          inventoryBaseUnit: "UNIT",
        },
        {
          id: monthlyMulticontactId,
          code: `SCOPE-D-${suffix}`,
          name: "Multicontacto mensual D",
          category: "TEST",
          unit: "Pza",
          itemType: "EQUIPMENT",
          countFrequency: "MONTHLY_ONLY",
          trackStock: true,
          inventoryBaseUnit: "UNIT",
        },
      ],
    });
    await tx.inventoryBalance.createMany({
      data: [weeklyIngredientId, weeklyDrinkId, monthlyTableId, monthlyMulticontactId].map(
        (inventoryProductId) => ({
          branchId,
          inventoryProductId,
          quantity: 10,
          unit: inventoryProductId === weeklyIngredientId ? "ML" as const : "UNIT" as const,
        }),
      ),
    });
    await tx.inventoryCount.create({
      data: {
        id: weeklyCountId,
        code: `SCOPE-W-${suffix}`,
        branchId,
        countDate: new Date(),
        countType: "WEEKLY",
        items: {
          create: [
            { productId: weeklyIngredientId, quantityCounted: 7 },
            { productId: weeklyDrinkId, quantityCounted: 8 },
          ],
        },
      },
    });
  });

  const close = (countId: string, operationId: string) =>
    withDatabaseActor(actor, () =>
      executeIdempotent({
        operationId,
        command: "CloseInventoryCountV2",
        payload: { countId },
        receiptContext: { actorId: adminId, branchId },
        execute: (tx) =>
          reconcileWeeklyCountCutover(tx, {
            countId,
            actorId: adminId,
            operationId,
          }),
      }),
    );

  const weeklyOperationId = generateOperationId();
  await close(weeklyCountId, weeklyOperationId);

  const weeklyBalances = await owner.inventoryBalance.findMany({
    where: { branchId, inventoryProductId: { in: [weeklyIngredientId, weeklyDrinkId, monthlyTableId, monthlyMulticontactId] } },
    orderBy: { inventoryProductId: "asc" },
  });
  const weeklyBalanceByProduct = new Map(
    weeklyBalances.map((balance) => [balance.inventoryProductId, balance.quantity.toString()]),
  );
  assert.equal(weeklyBalanceByProduct.get(weeklyIngredientId), "7");
  assert.equal(weeklyBalanceByProduct.get(weeklyDrinkId), "8");
  assert.equal(weeklyBalanceByProduct.get(monthlyTableId), "10");
  assert.equal(weeklyBalanceByProduct.get(monthlyMulticontactId), "10");
  assert.equal(await owner.inventoryMovement.count({ where: { sourceId: weeklyCountId } }), 2);
  assert.equal(await owner.inventoryCountDeclaration.count({ where: { countId: weeklyCountId } }), 2);

  await owner.inventoryCount.create({
    data: {
      id: monthlyCountId,
      code: `SCOPE-M-${suffix}`,
      branchId,
      countDate: new Date(Date.now() + 1000),
      countType: "MONTHLY",
      items: {
        create: [weeklyIngredientId, weeklyDrinkId, monthlyTableId, monthlyMulticontactId].map(
          (productId) => ({ productId, quantityCounted: 6 }),
        ),
      },
    },
  });

  const monthlyOperationId = generateOperationId();
  await close(monthlyCountId, monthlyOperationId);

  const monthlyBalances = await owner.inventoryBalance.findMany({
    where: { branchId, inventoryProductId: { in: [weeklyIngredientId, weeklyDrinkId, monthlyTableId, monthlyMulticontactId] } },
  });
  for (const balance of monthlyBalances) assert.equal(balance.quantity.toString(), "6");
  assert.equal(await owner.inventoryMovement.count({ where: { sourceId: monthlyCountId } }), 4);
  assert.equal(await owner.inventoryCountDeclaration.count({ where: { countId: monthlyCountId } }), 4);
});
