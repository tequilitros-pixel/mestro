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

const VARIANTS = ["Mediano", "Grande", "Mediano sin tequila", "Grande sin tequila"] as const;

async function main() {
  const [paloma, charroNegro, rc] = await Promise.all([
    prisma.posProduct.findFirst({
      where: { name: "Paloma", active: true },
      include: {
        variants: {
          include: { ingredients: { include: { inventoryProduct: { select: { code: true, name: true } } } } },
        },
      },
    }),
    prisma.posProduct.findFirst({
      where: { name: "Charro Negro", active: true },
      include: {
        variants: {
          include: {
            ingredients: { include: { inventoryProduct: { select: { code: true, name: true } } } },
            saleItems: { select: { id: true }, take: 1 },
            pos2SaleLines: { select: { id: true }, take: 1 },
          },
        },
      },
    }),
    prisma.inventoryProduct.findUnique({
      where: { code: "POS-ING-RC" },
      select: { id: true, name: true, isActive: true, trackStock: true, inventoryBaseUnit: true },
    }),
  ]);

  if (!paloma || !charroNegro) throw new Error("Paloma and Charro Negro must both be active POS products.");
  if (!rc?.isActive || !rc.trackStock || !rc.inventoryBaseUnit) throw new Error("POS-ING-RC is not ready for inventory recipes.");

  const palomaVariants = new Map(paloma.variants.map((variant) => [variant.name, variant]));
  const charroVariants = new Map(charroNegro.variants.map((variant) => [variant.name, variant]));
  for (const name of VARIANTS) {
    const source = palomaVariants.get(name);
    const target = charroVariants.get(name);
    if (!source || !target) throw new Error(`Expected the ${name} variant on both products.`);
    if (target.saleItems.length || target.pos2SaleLines.length) {
      throw new Error(`Charro Negro / ${name} already has sales and cannot be rewritten automatically.`);
    }
    if (source.ingredients.filter((ingredient) => ingredient.inventoryProduct.code === "POS-ING-TORONJA-REF").length !== 1) {
      throw new Error(`Paloma / ${name} must contain exactly one Refresco de toronja ingredient.`);
    }
  }

  const recipe = VARIANTS.map((name) => {
    const source = palomaVariants.get(name)!;
    return {
      name,
      price: source.price,
      ingredients: source.ingredients.map((ingredient) => ({
        code: ingredient.inventoryProduct.code === "POS-ING-TORONJA-REF" ? "POS-ING-RC" : ingredient.inventoryProduct.code,
        name: ingredient.inventoryProduct.code === "POS-ING-TORONJA-REF" ? rc.name : ingredient.inventoryProduct.name,
        quantity: ingredient.quantity,
        unit: ingredient.inventoryProduct.code === "POS-ING-TORONJA-REF" ? rc.inventoryBaseUnit : ingredient.unit,
      })),
    };
  });

  if (!apply) {
    const currentRecipe = VARIANTS.map((name) => {
      const variant = charroVariants.get(name)!;
      return {
        name,
        price: variant.price,
        ingredients: variant.ingredients.map((ingredient) => ({
          code: ingredient.inventoryProduct.code,
          name: ingredient.inventoryProduct.name,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
        })),
      };
    });
    console.log(JSON.stringify({ apply, product: charroNegro.name, expectedRecipe: recipe, currentRecipe }, null, 2));
    return;
  }

  const operationId = randomUUID();
  await prisma.$transaction(async (tx) => {
    for (const name of VARIANTS) {
      const source = palomaVariants.get(name)!;
      const target = charroVariants.get(name)!;
      await tx.posProductVariant.update({
        where: { id: target.id },
        data: { price: source.price, position: source.position, baseUnit: source.baseUnit, version: { increment: 1 } },
      });
      await tx.posVariantIngredient.deleteMany({ where: { variantId: target.id } });
      await tx.posVariantIngredient.createMany({
        data: source.ingredients.map((ingredient) => ({
          variantId: target.id,
          inventoryProductId: ingredient.inventoryProduct.code === "POS-ING-TORONJA-REF" ? rc.id : ingredient.inventoryProductId,
          quantity: ingredient.quantity,
          unit: ingredient.inventoryProduct.code === "POS-ING-TORONJA-REF" ? rc.inventoryBaseUnit! : ingredient.unit,
          unitStatus: "RESOLVED" as const,
        })),
      });
    }
    await tx.posProduct.update({
      where: { id: charroNegro.id },
      data: {
        description: "Paloma con Refresco RC, limón, sal y tequila.",
        inventoryTracked: true,
        version: { increment: 1 },
      },
    });
    await tx.auditEvent.create({
      data: {
        action: "POS_CHARRO_NEGRO_SYNCHRONIZED_FROM_PALOMA",
        entityType: "PosProduct",
        entityId: charroNegro.id,
        operationId,
        metadata: { sourceProduct: paloma.id, substitutedIngredient: "POS-ING-TORONJA-REF", replacementIngredient: "POS-ING-RC", variants: [...VARIANTS] },
      },
    });
  });

  console.log(JSON.stringify({ apply, product: charroNegro.name, variants: recipe, operationId }, null, 2));
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
