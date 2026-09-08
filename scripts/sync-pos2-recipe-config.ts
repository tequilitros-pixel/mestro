import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { INGREDIENTS, PRODUCTS } from "../lib/pos/tequilitrosSeedData";
import { appendAuditEvent } from "../lib/pos2/audit";
import { appendOutboxEvent } from "../lib/pos2/outbox";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");
const actorId = process.env.POS2_RECIPE_SYNC_ACTOR_ID;
if (!actorId) throw new Error("POS2_RECIPE_SYNC_ACTOR_ID is required for an auditable change.");
const apply = process.argv.includes("--apply");
const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function resolution(sourceUnit: string, sourceQuantity: number, product: { normalizedContentPerUnit: Prisma.Decimal | null; contentUnit: string | null }) {
  if (sourceUnit === "ml") return { unit: "ML", quantity: new Prisma.Decimal(sourceQuantity) };
  if (sourceUnit === "g") return { unit: "G", quantity: new Prisma.Decimal(sourceQuantity) };
  if (sourceUnit === "Pza") return { unit: "UNIT", quantity: new Prisma.Decimal(sourceQuantity) };
  if (sourceUnit === "bolsa" && product.contentUnit === "KG" && product.normalizedContentPerUnit) return { unit: "G", quantity: new Prisma.Decimal(sourceQuantity).times(product.normalizedContentPerUnit) };
  return null;
}

async function main() {
  const expected = new Map<string, { sourceUnit: string; quantity: number; code: string }>();
  for (const product of PRODUCTS) for (const variant of product.variants) for (const ingredient of variant.ingredients) expected.set(`${product.name}\u0000${variant.name}\u0000${ingredient.ingredientCode}`, { sourceUnit: INGREDIENTS.find((item) => item.code === ingredient.ingredientCode)?.unit ?? "", quantity: ingredient.quantity, code: ingredient.ingredientCode });
  const report: Array<{ product: string; variant: string; status: string; blockers: string[] }> = [];
  await prisma.$transaction(async (tx) => {
    const operationId = randomUUID();
    for (const productDef of PRODUCTS) {
      const product = await tx.posProduct.findFirst({ where: { name: productDef.name }, include: { variants: { where: { active: true }, include: { ingredients: { include: { inventoryProduct: true } } } } } });
      if (!product) throw new Error(`Missing POS product: ${productDef.name}`);
      if (product.inventoryTracked !== true) { if (apply) await tx.posProduct.update({ where: { id: product.id }, data: { inventoryTracked: true } }); if (apply) await appendAuditEvent(tx, { actorId, action: "POS2_PRODUCT_INVENTORY_TRACKING_ENABLED", entityType: "PosProduct", entityId: product.id, operationId, metadata: { product: product.name } }); }
      for (const variantDef of productDef.variants) {
        const variant = product.variants.find((item) => item.name === variantDef.name);
        if (!variant) throw new Error(`Missing POS variant: ${productDef.name} / ${variantDef.name}`);
        const blockers: string[] = [];
        const expectedIds = new Set<string>();
        for (const ingredientDef of variantDef.ingredients) {
          const source = expected.get(`${productDef.name}\u0000${variantDef.name}\u0000${ingredientDef.ingredientCode}`)!;
          const inventoryProduct = await tx.inventoryProduct.findUnique({ where: { code: source.code } });
          if (!inventoryProduct) throw new Error(`Missing inventory product: ${source.code}`);
          expectedIds.add(inventoryProduct.id);
          const resolved = resolution(source.sourceUnit, source.quantity, inventoryProduct);
          if (resolved && apply && inventoryProduct.inventoryBaseUnit !== resolved.unit) await tx.inventoryProduct.update({ where: { id: inventoryProduct.id }, data: { inventoryBaseUnit: resolved.unit as never } });
          if (!resolved) { blockers.push(`${inventoryProduct.name}: no existe equivalencia física para ${source.sourceUnit}`); continue; }
          const current = variant.ingredients.find((item) => item.inventoryProductId === inventoryProduct.id);
          if (!current) throw new Error(`Missing recipe ingredient row: ${productDef.name} / ${variantDef.name} / ${source.code}`);
          if (apply && (current.unit !== resolved.unit || current.unitStatus !== "RESOLVED" || current.quantity.toString() !== resolved.quantity.toString())) { await tx.posVariantIngredient.update({ where: { id: current.id }, data: { quantity: resolved.quantity, unit: resolved.unit as never, unitStatus: "RESOLVED" } }); await appendAuditEvent(tx, { actorId, action: "POS2_RECIPE_INGREDIENT_CONFIGURED", entityType: "PosVariantIngredient", entityId: current.id, operationId, metadata: { product: productDef.name, variant: variantDef.name, inventoryProductCode: source.code, sourceUnit: source.sourceUnit, quantity: resolved.quantity.toFixed(6), unit: resolved.unit } }); }
        }
        const extras = variant.ingredients.filter((item) => !expectedIds.has(item.inventoryProductId));
        if (extras.length) blockers.push(`ingredientes no definidos por fuente: ${extras.length}`);
        if (blockers.length) report.push({ product: productDef.name, variant: variantDef.name, status: "FAIL", blockers }); else report.push({ product: productDef.name, variant: variantDef.name, status: "PASS", blockers: [] });
      }
    }
    if (apply) { await appendAuditEvent(tx, { actorId, action: "POS2_RECIPE_CONFIGURATION_SYNCHRONIZED", entityType: "Pos2RecipeConfiguration", entityId: operationId, operationId, metadata: { variants: report.length, pass: report.filter((item) => item.status === "PASS").length, fail: report.filter((item) => item.status === "FAIL").length } }); await appendOutboxEvent(tx, { topic: "pos2.recipe-configuration.synchronized", aggregate: "Pos2RecipeConfiguration", aggregateId: operationId, operationId, payload: { variants: report.length, pass: report.filter((item) => item.status === "PASS").length, fail: report.filter((item) => item.status === "FAIL").length } }); }
  });
  console.log(JSON.stringify({ apply, count: report.length, pass: report.filter((item) => item.status === "PASS").length, fail: report.filter((item) => item.status === "FAIL").length, blockers: report.filter((item) => item.status === "FAIL") }, null, 2));
  if (report.some((item) => item.status === "FAIL")) process.exitCode = 2;
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); await pool.end(); });
