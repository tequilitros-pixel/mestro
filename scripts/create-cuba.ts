import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const apply = process.argv.includes("--apply");
const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const VARIANTS = [
  { name: "Mediano", priceFrom: "Mediano", ice: 250, cup: "POS-ING-VASO-MED", soda: 180, tequila: 30 },
  { name: "Grande", priceFrom: "Grande", ice: 500, cup: "POS-ING-VASO-GDE", soda: 360, tequila: 60 },
  { name: "Mediano sin tequila", priceFrom: "Mediano sin tequila", ice: 250, cup: "POS-ING-VASO-MED", soda: 180 },
  { name: "Grande sin tequila", priceFrom: "Grande sin tequila", ice: 500, cup: "POS-ING-VASO-GDE", soda: 360 },
] as const;

async function main() {
  const [paloma, cuba, ingredients] = await Promise.all([
    prisma.posProduct.findFirst({
      where: { name: "Paloma", active: true },
      include: { category: { select: { id: true } }, variants: { select: { name: true, price: true, position: true } } },
    }),
    prisma.posProduct.findFirst({ where: { name: "Cuba" }, select: { id: true, active: true } }),
    prisma.inventoryProduct.findMany({
      where: { code: { in: ["POS-ING-TORONJA-REF", "POS-ING-TEQUILA", "EXTRA-HIELO", "POS-ING-VASO-MED", "POS-ING-VASO-GDE"] } },
      select: { id: true, code: true, isActive: true, trackStock: true, inventoryBaseUnit: true },
    }),
  ]);

  if (!paloma) throw new Error("Paloma must be an active POS product.");
  if (cuba) throw new Error(`Cuba already exists (${cuba.active ? "active" : "inactive"}).`);
  const prices = new Map(paloma.variants.map((variant) => [variant.name, variant]));
  const inventory = new Map(ingredients.map((item) => [item.code, item]));
  for (const code of ["POS-ING-TORONJA-REF", "POS-ING-TEQUILA", "EXTRA-HIELO", "POS-ING-VASO-MED", "POS-ING-VASO-GDE"]) {
    const item = inventory.get(code);
    if (!item?.isActive || !item.trackStock || !item.inventoryBaseUnit) throw new Error(`${code} is not ready for inventory recipes.`);
  }
  for (const variant of VARIANTS) {
    if (!prices.has(variant.priceFrom)) throw new Error(`Paloma / ${variant.priceFrom} is missing.`);
  }

  const recipe = VARIANTS.map((variant) => ({
    name: variant.name,
    price: prices.get(variant.priceFrom)!.price,
    ingredients: [
      { code: "POS-ING-TORONJA-REF", quantity: variant.soda, unit: "ML" },
      ...(variant.tequila ? [{ code: "POS-ING-TEQUILA", quantity: variant.tequila, unit: "ML" }] : []),
      { code: "EXTRA-HIELO", quantity: variant.ice, unit: "G" },
      { code: variant.cup, quantity: 1, unit: "UNIT" },
    ],
  }));
  if (!apply) {
    console.log(JSON.stringify({ apply, product: "Cuba", recipe }, null, 2));
    return;
  }

  const operationId = randomUUID();
  const created = await prisma.$transaction(async (tx) => {
    const last = await tx.posProduct.findFirst({
      where: { categoryId: paloma.category.id },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const product = await tx.posProduct.create({
      data: {
        categoryId: paloma.category.id,
        name: "Cuba",
        description: "Refresco de toronja, tequila y hielo.",
        icon: "#7C3AED",
        active: true,
        sellable: true,
        inventoryTracked: true,
        baseUnit: paloma.baseUnit,
        position: (last?.position ?? -1) + 1,
        variants: {
          create: VARIANTS.map((variant, position) => ({
            name: variant.name,
            price: prices.get(variant.priceFrom)!.price,
            position,
            baseUnit: paloma.baseUnit,
            ingredients: {
              create: [
                { inventoryProductId: inventory.get("POS-ING-TORONJA-REF")!.id, quantity: variant.soda, unit: "ML", unitStatus: "RESOLVED" as const },
                ...(variant.tequila ? [{ inventoryProductId: inventory.get("POS-ING-TEQUILA")!.id, quantity: variant.tequila, unit: "ML", unitStatus: "RESOLVED" as const }] : []),
                { inventoryProductId: inventory.get("EXTRA-HIELO")!.id, quantity: variant.ice, unit: "G", unitStatus: "RESOLVED" as const },
                { inventoryProductId: inventory.get(variant.cup)!.id, quantity: 1, unit: "UNIT", unitStatus: "RESOLVED" as const },
              ],
            },
          })),
        },
      },
      select: { id: true, name: true },
    });
    await tx.auditEvent.create({
      data: {
        action: "POS_CUBA_CREATED",
        entityType: "PosProduct",
        entityId: product.id,
        operationId,
        metadata: { sourcePrices: "Paloma", iceGrams: { mediano: 250, grande: 500 }, variants: VARIANTS.map((variant) => variant.name) },
      },
    });
    return product;
  });
  console.log(JSON.stringify({ apply, created, operationId }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
