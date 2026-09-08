import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { INGREDIENTS, PRODUCTS } from "../lib/pos/tequilitrosSeedData";

const connectionString = process.env.DATABASE_URL;
const actorId = process.env.POS2_RECIPE_SYNC_ACTOR_ID;
if (!connectionString) throw new Error("DATABASE_URL is required.");
if (!actorId) throw new Error("POS2_RECIPE_SYNC_ACTOR_ID is required for an auditable change.");
const apply = process.argv.includes("--apply");
const pool = new Pool({ connectionString });
const quote = (value: unknown) => `'${String(value).replaceAll("'", "''")}'`;
const json = (value: Record<string, unknown>) => `${quote(JSON.stringify(value))}::jsonb`;
const sourceToPos2Code = new Map([["EXTRA-PENAFIEL", "POS-ING-TORONJA-REF"]]);
const existingPos2Recipes = [
  {
    name: "4/100",
    variants: [{ name: "Único", ingredients: [
      { ingredientCode: "POS-ING-TORONJA-REF", quantity: 120 },
      { ingredientCode: "POS-ING-TEQUILA", quantity: 60 },
      { ingredientCode: "POS-ING-LIMON", quantity: 60 },
    ] }],
  },
] as const;

function resolution(sourceUnit: string, sourceQuantity: number, normalizedContentPerUnit: string | null, contentUnit: string | null) {
  if (sourceUnit === "ml") return { unit: "ML", quantity: sourceQuantity.toString() };
  if (sourceUnit === "g") return { unit: "G", quantity: sourceQuantity.toString() };
  if (sourceUnit === "Pza") return { unit: "UNIT", quantity: sourceQuantity.toString() };
  if (sourceUnit === "bolsa" && contentUnit === "KG" && normalizedContentPerUnit) return { unit: "G", quantity: (sourceQuantity * Number(normalizedContentPerUnit)).toString() };
  if (sourceUnit === "botella" && contentUnit && normalizedContentPerUnit) return { unit: contentUnit, quantity: (sourceQuantity * Number(normalizedContentPerUnit)).toString() };
  return null;
}

async function main() {
  const rows = (await pool.query(`SELECT p."id" AS "productId",p."name" AS "productName",p."inventoryTracked",v."id" AS "variantId",v."name" AS "variantName",i."id" AS "ingredientId",i."inventoryProductId",i."quantity"::text AS "currentQuantity",i."unit" AS "currentUnit",i."unitStatus" AS "currentStatus",ip."code",ip."name" AS "inventoryName",ip."inventoryBaseUnit",ip."normalizedContentPerUnit"::text AS "normalizedContentPerUnit",ip."contentUnit" FROM "PosProduct" p JOIN "PosProductVariant" v ON v."productId"=p."id" JOIN "PosVariantIngredient" i ON i."variantId"=v."id" JOIN "InventoryProduct" ip ON ip."id"=i."inventoryProductId" WHERE p."active"=true AND p."sellable"=true AND v."active"=true ORDER BY p."name",v."position",i."id"`)).rows;
  const statements: string[] = [];
  const report: Array<{ product: string; variant: string; status: string; blockers: string[] }> = [];
  const operationId = randomUUID();
  for (const productDef of [...PRODUCTS, ...existingPos2Recipes]) {
    const productRows = rows.filter((row) => row.productName === productDef.name);
    const product = productRows[0];
    if (!product || new Set(productRows.map((row) => row.productId)).size !== 1) throw new Error(`Expected one active POS product: ${productDef.name}`);
    if (!product.inventoryTracked && apply) { statements.push(`UPDATE "PosProduct" SET "inventoryTracked"=true,"updatedAt"=NOW() WHERE "id"=${quote(product.productId)}`); statements.push(`INSERT INTO "AuditEvent" ("id","actorId","action","entityType","entityId","operationId","metadata") VALUES (${quote(randomUUID())},${quote(actorId)},'POS2_PRODUCT_INVENTORY_TRACKING_ENABLED','PosProduct',${quote(product.productId)},${quote(operationId)},${json({ product: product.name })})`); }
    for (const variantDef of productDef.variants) {
      const variantRows = productRows.filter((row) => row.variantName === variantDef.name);
      if (!variantRows.length) throw new Error(`Missing POS variant: ${productDef.name} / ${variantDef.name}`);
      const expectedIds = new Set<string>();
      const blockers: string[] = [];
      for (const ingredientDef of variantDef.ingredients) {
        const source = INGREDIENTS.find((item) => item.code === ingredientDef.ingredientCode);
        if (!source) throw new Error(`Missing versioned ingredient source: ${ingredientDef.ingredientCode}`);
        const pos2Code = sourceToPos2Code.get(source.code) ?? source.code;
        const row = variantRows.find((item) => item.code === pos2Code);
        if (!row) throw new Error(`Missing recipe ingredient row: ${productDef.name} / ${variantDef.name} / ${source.code}`);
        expectedIds.add(row.inventoryProductId);
        const resolved = resolution(source.unit, ingredientDef.quantity, row.normalizedContentPerUnit, row.contentUnit);
        if (!resolved) { blockers.push(`${row.inventoryName}: falta equivalencia física para ${source.unit}`); continue; }
        if (apply && row.inventoryBaseUnit !== resolved.unit) { statements.push(`UPDATE "InventoryProduct" SET "inventoryBaseUnit"=${quote(resolved.unit)}::"CatalogBaseUnit","updatedAt"=NOW() WHERE "id"=${quote(row.inventoryProductId)}`); statements.push(`INSERT INTO "AuditEvent" ("id","actorId","action","entityType","entityId","operationId","metadata") VALUES (${quote(randomUUID())},${quote(actorId)},'POS2_INVENTORY_BASE_UNIT_CONFIGURED','InventoryProduct',${quote(row.inventoryProductId)},${quote(operationId)},${json({ sourceCode: source.code, pos2Code, unit: resolved.unit, sourceUnit: source.unit })})`); }
        if (apply && (row.currentUnit !== resolved.unit || row.currentStatus !== "RESOLVED" || row.currentQuantity !== resolved.quantity)) { statements.push(`UPDATE "PosVariantIngredient" SET "quantity"=${quote(resolved.quantity)},"unit"=${quote(resolved.unit)}::"CatalogBaseUnit","unitStatus"='RESOLVED'::"RecipeIngredientUnitStatus" WHERE "id"=${quote(row.ingredientId)}`); statements.push(`INSERT INTO "AuditEvent" ("id","actorId","action","entityType","entityId","operationId","metadata") VALUES (${quote(randomUUID())},${quote(actorId)},'POS2_RECIPE_INGREDIENT_CONFIGURED','PosVariantIngredient',${quote(row.ingredientId)},${quote(operationId)},${json({ product: productDef.name, variant: variantDef.name, sourceCode: source.code, pos2Code, sourceUnit: source.unit, quantity: resolved.quantity, unit: resolved.unit })})`); }
      }
      const extras = variantRows.filter((row) => !expectedIds.has(row.inventoryProductId));
      if (extras.length) blockers.push(`ingredientes no definidos por fuente: ${extras.length}`);
      report.push({ product: productDef.name, variant: variantDef.name, status: blockers.length ? "FAIL" : "PASS", blockers });
    }
  }
  const payload = { variants: report.length, pass: report.filter((item) => item.status === "PASS").length, fail: report.filter((item) => item.status === "FAIL").length };
  if (apply) { statements.push(`INSERT INTO "AuditEvent" ("id","actorId","action","entityType","entityId","operationId","metadata") VALUES (${quote(randomUUID())},${quote(actorId)},'POS2_RECIPE_CONFIGURATION_SYNCHRONIZED','Pos2RecipeConfiguration',${quote(operationId)},${quote(operationId)},${json(payload)})`); statements.push(`INSERT INTO "OutboxEvent" ("id","topic","aggregate","aggregateId","operationId","payload") VALUES (${quote(randomUUID())},'pos2.recipe-configuration.synchronized','Pos2RecipeConfiguration',${quote(operationId)},${quote(operationId)},${json(payload)})`); await pool.query(["BEGIN", ...statements, "COMMIT"].join(";")); }
  console.log(JSON.stringify({ apply, ...payload, blockers: report.filter((item) => item.status === "FAIL") }, null, 2));
  if (payload.fail) process.exitCode = 2;
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => pool.end());
