import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

/**
 * El seed de Tequilitros (scripts/seed-pos-tequilitros.ts) busca cada
 * producto por NOMBRE con `findFirst`. Si ya existían productos
 * duplicados con el mismo nombre (de antes de este script), solo
 * actualiza UNO de ellos a la receta nueva (4 variantes: Mediano,
 * Grande, Mediano sin tequila, Grande sin tequila) y deja el resto
 * intacto con la receta vieja (2 variantes: Mediano, Grande).
 *
 * Este script encuentra esos sobrantes y los limpia:
 * - Si el duplicado NUNCA se vendió, se elimina por completo.
 * - Si ya tiene ventas registradas, se desactiva en vez de borrarse
 *   (mismo criterio que deleteProductAction en app/pos/products/actions.ts)
 *   para no perder el historial de ventas.
 */

const TEQUILITRO_NAMES = [
  "Vampiro",
  "Cantarito",
  "Paloma",
  "Tequimiche",
  "Tequimora",
  "Tequimojito",
];

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("No existe DATABASE_URL. Revisa tu archivo .env.");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🧹 Buscando tequilitros duplicados...\n");

  let totalDeleted = 0;
  let totalDeactivated = 0;

  for (const name of TEQUILITRO_NAMES) {
    const products = await prisma.posProduct.findMany({
      where: { name },
      include: { variants: true },
      orderBy: { createdAt: "asc" },
    });

    if (products.length <= 1) {
      console.log(`  = ${name}: sin duplicados (${products.length} producto).`);
      continue;
    }

    const maxVariants = Math.max(...products.map((p) => p.variants.length));
    const keeper = products.find((p) => p.variants.length === maxVariants)!;
    const duplicates = products.filter((p) => p.id !== keeper.id);

    console.log(
      `  ⚠ ${name}: ${products.length} productos encontrados. Conservando el de ${keeper.variants.length} variantes (id ${keeper.id}).`,
    );

    for (const dup of duplicates) {
      const saleItemCount = await prisma.posSaleItem.count({
        where: { variant: { productId: dup.id } },
      });

      if (saleItemCount > 0) {
        await prisma.posProduct.update({
          where: { id: dup.id },
          data: { active: false },
        });
        totalDeactivated++;
        console.log(
          `    → Desactivado (id ${dup.id}, ${dup.variants.length} variantes) — tiene ${saleItemCount} venta(s) registradas, no se borra.`,
        );
      } else {
        await prisma.posProduct.delete({ where: { id: dup.id } });
        totalDeleted++;
        console.log(
          `    → Eliminado (id ${dup.id}, ${dup.variants.length} variantes) — sin ventas registradas.`,
        );
      }
    }
  }

  console.log(
    `\n✅ Listo. ${totalDeleted} producto(s) eliminado(s), ${totalDeactivated} desactivado(s) por tener ventas.`,
  );
}

main()
  .catch((error) => {
    console.error("\n❌ Error limpiando duplicados:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
