/*
 * Fusiona dos productos de inventario duplicados en uno solo.
 *
 * El caso que lo motivó: "Peñafiel" y "Refresco de toronja" eran el
 * mismo insumo dado de alta dos veces, así que el stock y el consumo
 * quedaban partidos a la mitad y ninguna de las dos cifras servía.
 *
 * Borrar el duplicado a secas no funciona: sus entradas, conteos,
 * paquetes y recetas del punto de venta apuntan a él y la base lo
 * impide (o peor, se llevaría el historial). Este script reapunta
 * todas esas referencias al producto que se queda, suma las
 * cantidades cuando ambos aparecían en el mismo paquete/receta, y
 * hasta entonces borra el duplicado.
 *
 * El primer argumento es el producto que desaparece y el segundo el
 * que se queda; basta con un pedazo del nombre.
 *
 *   npx tsx scripts/merge-inventory-products.ts "peñafiel" "toronja"
 *   npx tsx scripts/merge-inventory-products.ts "peñafiel" "toronja" --apply
 *
 * Si se miden distinto, --factor=N convierte las cantidades:
 *   ... "peñafiel" "refresco de toronja" --factor=1800 --apply
 */

import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

/*
 * Prisma 7 ya no abre la conexión solo: exige un adaptador explícito.
 * Se arma aquí igual que en lib/prisma.ts, porque ese módulo vive del
 * lado de Next y trae consigo el cacheo en globalThis que no hace
 * falta en un script de una sola corrida.
 */
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const args = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const apply = process.argv.includes("--apply");

const [SOURCE_MATCH, TARGET_MATCH] = args;

/*
 * Cuando los dos productos se miden distinto (uno en botella y otro
 * en ml, por decir), las cantidades del que desaparece se multiplican
 * por este factor al pasarlas al que se queda.
 */
const factor = Number(
  process.argv.find((arg) => arg.startsWith("--factor="))?.split("=")[1] ?? 1
);

async function main() {
  if (!SOURCE_MATCH || !TARGET_MATCH) {
    console.error(
      'Uso: npx tsx scripts/merge-inventory-products.ts "<producto que se borra>" "<producto que se queda>" [--apply]'
    );
    return;
  }

  const candidates = await prisma.inventoryProduct.findMany({
    where: {
      OR: [
        { name: { contains: SOURCE_MATCH, mode: "insensitive" } },
        { name: { contains: TARGET_MATCH, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      code: true,
      name: true,
      category: true,
      unit: true,
      isActive: true,
      _count: {
        select: {
          entries: true,
          countItems: true,
          packageItems: true,
          eventItems: true,
          equipmentKitItems: true,
          posIngredientOf: true,
          rawMaterialLinks: true,
        },
      },
    },
  });

  console.log("\nProductos encontrados:");
  for (const product of candidates) {
    console.log(
      `  ${product.name} [${product.code}] · ${product.category} · ${product.unit} · ${product.isActive ? "activo" : "inactivo"}`
    );
    console.log(`    referencias: ${JSON.stringify(product._count)}`);
  }

  const sources = candidates.filter((product) =>
    product.name.toLowerCase().includes(SOURCE_MATCH.toLowerCase())
  );

  const targets = candidates.filter((product) =>
    product.name.toLowerCase().includes(TARGET_MATCH.toLowerCase())
  );

  if (sources.length !== 1 || targets.length !== 1) {
    console.error(
      `\nSe esperaba exactamente un producto de cada lado. Origen "${SOURCE_MATCH}": ${sources.length}. Destino "${TARGET_MATCH}": ${targets.length}. Afina los términos con la lista de arriba.`
    );
    return;
  }

  const source = sources[0];
  const target = targets[0];

  console.log(
    `\nFusión: "${source.name}" → "${target.name}" (se conserva ${target.code})`
  );

  /*
   * Detalle de las recetas del punto de venta que usan el producto
   * que va a desaparecer. Es lo que más duele equivocarse: si la
   * receta decía "1 botella" y el producto que se queda se mide en
   * ml, la cantidad se vuelve "1 ml" y el descuento de inventario
   * queda mil veces corto sin que nadie se entere.
   */
  const affectedRecipes = await prisma.posVariantIngredient.findMany({
    where: { inventoryProductId: source.id },
    select: {
      quantity: true,
      variant: {
        select: { name: true, product: { select: { name: true } } },
      },
    },
  });

  if (affectedRecipes.length > 0) {
    console.log("\nRecetas del punto de venta que lo usan:");

    for (const ingredient of affectedRecipes) {
      console.log(
        `  ${ingredient.variant.product.name} · ${ingredient.variant.name}: ${ingredient.quantity} ${source.unit}`
      );
    }
  }

  if (source.unit !== target.unit && factor === 1) {
    console.error(
      `\nALTO: las unidades no coinciden ("${source.unit}" vs "${target.unit}"). Las cantidades de arriba están en ${source.unit} y quedarían interpretadas como ${target.unit}. Pasa el equivalente con --factor=<n> (por ejemplo --factor=1800 si cada ${source.unit} son 1800 ${target.unit}).`
    );

    return;
  }

  if (factor !== 1) {
    console.log(
      `\nConversión: cada ${source.unit} se convierte en ${factor} ${target.unit}.`
    );
  }

  if (!apply) {
    console.log(
      "\nModo reporte. Vuelve a correrlo con --apply para ejecutar la fusión."
    );
    return;
  }

  await prisma.$transaction(async (tx) => {
    /*
     * Tablas sin restricción de unicidad: basta con reapuntar. Cuando
     * hay conversión de unidad las cantidades se recalculan una por
     * una, porque `updateMany` no sabe multiplicar por sí mismo.
     */
    const pendingEntries = await tx.inventoryEntry.findMany({
      where: { productId: source.id },
      select: { id: true, quantity: true },
    });

    for (const entry of pendingEntries) {
      await tx.inventoryEntry.update({
        where: { id: entry.id },
        data: {
          productId: target.id,
          quantity: new Prisma.Decimal(String(entry.quantity)).times(factor),
        },
      });
    }

    const entries = { count: pendingEntries.length };

    const pendingEventItems = await tx.serviceEventItem.findMany({
      where: { productId: source.id },
      select: {
        id: true,
        plannedQuantity: true,
        sentQuantity: true,
        returnedQuantity: true,
        damagedQuantity: true,
        lostQuantity: true,
      },
    });

    for (const item of pendingEventItems) {
      const scale = (value: Prisma.Decimal | null) =>
        value === null
          ? null
          : new Prisma.Decimal(String(value)).times(factor);

      await tx.serviceEventItem.update({
        where: { id: item.id },
        data: {
          productId: target.id,
          plannedQuantity: scale(item.plannedQuantity)!,
          sentQuantity: scale(item.sentQuantity),
          returnedQuantity: scale(item.returnedQuantity),
          damagedQuantity: scale(item.damagedQuantity)!,
          lostQuantity: scale(item.lostQuantity)!,
        },
      });
    }

    const eventItems = { count: pendingEventItems.length };

    const rawLinks = await tx.rawMaterial.updateMany({
      where: { inventoryProductId: source.id },
      data: { inventoryProductId: target.id },
    });

    console.log(`  Entradas de inventario reapuntadas: ${entries.count}`);
    console.log(`  Partidas de eventos reapuntadas: ${eventItems.count}`);
    console.log(`  Materias primas ligadas: ${rawLinks.count}`);

    /*
     * En estas cuatro la pareja (contenedor, producto) es única. Si el
     * mismo paquete traía Peñafiel Y refresco de toronja, reapuntar a
     * secas violaría la restricción, así que se suman las cantidades
     * y se borra la fila duplicada.
     */
    await mergeUnique(
      "paquetes de eventos",
      await tx.eventPackageItem.findMany({
        where: { productId: { in: [source.id, target.id] } },
        select: { id: true, packageId: true, productId: true, quantity: true },
      }),
      (row) => row.packageId,
      source.id,
      target.id,
      (id, quantity) =>
        tx.eventPackageItem.update({ where: { id }, data: { quantity } }),
      (id) => tx.eventPackageItem.update({ where: { id }, data: { productId: target.id } }),
      (id) => tx.eventPackageItem.delete({ where: { id } })
    );

    await mergeUnique(
      "kits de equipo",
      await tx.equipmentKitItem.findMany({
        where: { productId: { in: [source.id, target.id] } },
        select: { id: true, kitId: true, productId: true, quantity: true },
      }),
      (row) => row.kitId,
      source.id,
      target.id,
      (id, quantity) =>
        tx.equipmentKitItem.update({ where: { id }, data: { quantity } }),
      (id) => tx.equipmentKitItem.update({ where: { id }, data: { productId: target.id } }),
      (id) => tx.equipmentKitItem.delete({ where: { id } })
    );

    await mergeUnique(
      "conteos de inventario",
      await tx.inventoryCountItem.findMany({
        where: { productId: { in: [source.id, target.id] } },
        select: {
          id: true,
          countId: true,
          productId: true,
          quantityCounted: true,
        },
      }),
      (row) => row.countId,
      source.id,
      target.id,
      (id, quantityCounted) =>
        tx.inventoryCountItem.update({
          where: { id },
          data: { quantityCounted },
        }),
      (id) =>
        tx.inventoryCountItem.update({
          where: { id },
          data: { productId: target.id },
        }),
      (id) => tx.inventoryCountItem.delete({ where: { id } }),
      "quantityCounted"
    );

    await mergeUnique(
      "recetas del punto de venta",
      await tx.posVariantIngredient.findMany({
        where: { inventoryProductId: { in: [source.id, target.id] } },
        select: {
          id: true,
          variantId: true,
          inventoryProductId: true,
          quantity: true,
        },
      }),
      (row) => row.variantId,
      source.id,
      target.id,
      (id, quantity) =>
        tx.posVariantIngredient.update({ where: { id }, data: { quantity } }),
      (id) =>
        tx.posVariantIngredient.update({
          where: { id },
          data: { inventoryProductId: target.id },
        }),
      (id) => tx.posVariantIngredient.delete({ where: { id } }),
      "quantity",
      "inventoryProductId"
    );

    await tx.inventoryProduct.delete({ where: { id: source.id } });

    console.log(`\nListo. "${source.name}" quedó fusionado en "${target.name}".`);
  });
}

type Row = Record<string, unknown> & { id: string };

async function mergeUnique<T extends Row>(
  label: string,
  rows: T[],
  groupOf: (row: T) => string,
  sourceId: string,
  targetId: string,
  setQuantity: (id: string, quantity: Prisma.Decimal) => Promise<unknown>,
  repoint: (id: string) => Promise<unknown>,
  remove: (id: string) => Promise<unknown>,
  quantityField = "quantity",
  productField = "productId"
) {
  let merged = 0;
  let moved = 0;

  const byGroup = new Map<string, T[]>();

  for (const row of rows) {
    const key = groupOf(row);
    byGroup.set(key, [...(byGroup.get(key) ?? []), row]);
  }

  for (const group of byGroup.values()) {
    const fromSource = group.find((row) => row[productField] === sourceId);

    if (!fromSource) {
      continue;
    }

    const fromTarget = group.find((row) => row[productField] === targetId);

    // La cantidad viaja en la unidad del que se queda.
    const converted = new Prisma.Decimal(
      String(fromSource[quantityField])
    ).times(factor);

    if (fromTarget) {
      const total = new Prisma.Decimal(
        String(fromTarget[quantityField])
      ).plus(converted);

      await setQuantity(fromTarget.id, total);
      await remove(fromSource.id);
      merged += 1;
    } else {
      await repoint(fromSource.id);

      if (factor !== 1) {
        await setQuantity(fromSource.id, converted);
      }

      moved += 1;
    }
  }

  console.log(
    `  ${label}: ${moved} reapuntadas, ${merged} sumadas por duplicado`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
