import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  console.log("=== Inactive inventory products ===");
  const inactive = await prisma.inventoryProduct.findMany({
    where: { isActive: false },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true, category: true, isActive: true, createdAt: true },
  });
  console.log(JSON.stringify(inactive, null, 2));

  console.log("=== Vasos category existing products ===");
  const vasos = await prisma.inventoryProduct.findMany({
    where: { category: "Vasos" },
    select: { id: true, code: true, name: true, isActive: true },
  });
  console.log(JSON.stringify(vasos, null, 2));

  console.log("=== PosCategory list ===");
  const cats = await prisma.posCategory.findMany({
    select: { id: true, name: true, active: true, position: true },
    orderBy: { position: "asc" },
  });
  console.log(JSON.stringify(cats, null, 2));

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
