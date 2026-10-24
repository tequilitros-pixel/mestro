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

const PRODUCTS = [
  { name: "Tequi Mango", description: "Tequimora con licor de mango.", ingredientCode: "LIC-MANGO", icon: "#F59E0B" },
  { name: "Tequi Jamaica", description: "Tequimora con licor de Jamaica.", ingredientCode: "LIC-JAMAICA", icon: "#DC2626" },
] as const;

async function main() {
  const [tequimora, existing, replacements] = await Promise.all([
    prisma.posProduct.findFirst({
      where: { name: "Tequimora", active: true },
      include: {
        category: { select: { id: true } },
        variants: {
          orderBy: { position: "asc" },
          include: { ingredients: { include: { inventoryProduct: { select: { code: true } } } } },
        },
      },
    }),
    prisma.posProduct.findMany({ where: { name: { in: PRODUCTS.map((product) => product.name) } }, select: { name: true } }),
    prisma.inventoryProduct.findMany({
      where: { code: { in: ["POS-ING-ZARZAMORA", ...PRODUCTS.map((product) => product.ingredientCode)] } },
      select: { id: true, code: true, isActive: true, trackStock: true, inventoryBaseUnit: true },
    }),
  ]);

  if (!tequimora) throw new Error("Tequimora must be an active POS product.");
  if (existing.length) throw new Error(`Products already exist: ${existing.map((product) => product.name).join(", ")}`);
  const inventoryByCode = new Map(replacements.map((product) => [product.code, product]));
  const zarzamora = inventoryByCode.get("POS-ING-ZARZAMORA");
  if (!zarzamora) throw new Error("POS-ING-ZARZAMORA is missing.");
  for (const product of PRODUCTS) {
    const inventory = inventoryByCode.get(product.ingredientCode);
    if (!inventory?.isActive || !inventory.trackStock || !inventory.inventoryBaseUnit) {
      throw new Error(`${product.ingredientCode} is not ready for inventory recipes.`);
    }
  }
  for (const variant of tequimora.variants) {
    if (variant.ingredients.filter((ingredient) => ingredient.inventoryProduct.code === zarzamora.code).length !== 1) {
      throw new Error(`Tequimora / ${variant.name} must contain exactly one Licor de Zarzamora ingredient.`);
    }
  }

  const recipe = tequimora.variants.map((variant) => ({
    name: variant.name,
    price: variant.price,
    ingredients: variant.ingredients.map((ingredient) => ({ code: ingredient.inventoryProduct.code, quantity: ingredient.quantity, unit: ingredient.unit })),
  }));
  if (!apply) {
    console.log(JSON.stringify({ apply, source: tequimora.name, products: PRODUCTS, recipe }, null, 2));
    return;
  }

  const operationId = randomUUID();
  const created = await prisma.$transaction(async (tx) => {
    const last = await tx.posProduct.findFirst({
      where: { categoryId: tequimora.category.id },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const products = [];
    for (const [index, definition] of PRODUCTS.entries()) {
      const replacement = inventoryByCode.get(definition.ingredientCode)!;
      const product = await tx.posProduct.create({
        data: {
          categoryId: tequimora.category.id,
          name: definition.name,
          description: definition.description,
          icon: definition.icon,
          active: true,
          sellable: true,
          inventoryTracked: true,
          baseUnit: tequimora.baseUnit,
          position: (last?.position ?? -1) + index + 1,
          variants: {
            create: tequimora.variants.map((variant) => ({
              name: variant.name,
              price: variant.price,
              position: variant.position,
              active: variant.active,
              baseUnit: variant.baseUnit,
              ingredients: {
                create: variant.ingredients.map((ingredient) => ({
                  inventoryProductId: ingredient.inventoryProduct.code === zarzamora.code ? replacement.id : ingredient.inventoryProductId,
                  quantity: ingredient.quantity,
                  unit: ingredient.inventoryProduct.code === zarzamora.code ? replacement.inventoryBaseUnit! : ingredient.unit,
                  unitStatus: "RESOLVED" as const,
                })),
              },
            })),
          },
        },
        select: { id: true, name: true },
      });
      products.push(product);
    }
    await tx.auditEvent.create({
      data: {
        action: "POS_TEQUI_MANGO_JAMAICA_CREATED_FROM_TEQUIMORA",
        entityType: "PosProduct",
        entityId: tequimora.id,
        operationId,
        metadata: { sourceProduct: tequimora.id, products, replacements: PRODUCTS.map((product) => product.ingredientCode) },
      },
    });
    return products;
  });
  console.log(JSON.stringify({ apply, source: tequimora.name, created, operationId }, null, 2));
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
