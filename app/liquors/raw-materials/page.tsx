import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import RawMaterialsClient from "./RawMaterialsClient";

export default async function RawMaterialsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const canEdit = user.role === "ADMIN" || user.role === "GERENTE";

  const [materials, movements, branches, inventoryProducts] = await Promise.all([
    prisma.rawMaterial.findMany({
      orderBy: [{ active: "desc" }, { category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        baseUnit: true,
        currentStock: true,
        minimumStock: true,
        averageCost: true,
        active: true,
        receivesLotOutput: true,
        bottleable: true,
        bottlePrefix: true,
        defaultShelfLifeDays: true,
        yellowAlertDays: true,
        redAlertDays: true,
        showExpirationOnLabel: true,
        inventoryProductId: true,
        _count: { select: { recipeIngredients: true } },
      },
    }),

    prisma.rawMaterialMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 150,
      select: {
        id: true,
        type: true,
        quantity: true,
        unitCost: true,
        notes: true,
        createdAt: true,
        rawMaterial: { select: { name: true, baseUnit: true } },
        lot: { select: { code: true } },
        liquorBatch: { select: { code: true } },
        branch: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    }),

    prisma.branch.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),

    prisma.inventoryProduct.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true },
    }),
  ]);

  return (
    <RawMaterialsClient
      canEdit={canEdit}
      materials={materials.map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        category: m.category,
        baseUnit: m.baseUnit,
        currentStock: m.currentStock,
        minimumStock: m.minimumStock,
        averageCost: m.averageCost,
        active: m.active,
        receivesLotOutput: m.receivesLotOutput,
        usedInRecipes: m._count.recipeIngredients,
        bottleable: m.bottleable,
        bottlePrefix: m.bottlePrefix,
        defaultShelfLifeDays: m.defaultShelfLifeDays,
        yellowAlertDays: m.yellowAlertDays,
        redAlertDays: m.redAlertDays,
        showExpirationOnLabel: m.showExpirationOnLabel,
        inventoryProductId: m.inventoryProductId,
      }))}
      movements={movements.map((mv) => ({
        id: mv.id,
        type: mv.type,
        quantity: mv.quantity,
        unitCost: mv.unitCost,
        notes: mv.notes,
        createdAt: mv.createdAt.toISOString(),
        materialName: mv.rawMaterial.name,
        materialUnit: mv.rawMaterial.baseUnit,
        lotCode: mv.lot?.code ?? null,
        batchCode: mv.liquorBatch?.code ?? null,
        branchName: mv.branch?.name ?? null,
        userName: mv.createdBy?.name ?? null,
      }))}
      branches={branches}
      inventoryProducts={inventoryProducts}
    />
  );
}
