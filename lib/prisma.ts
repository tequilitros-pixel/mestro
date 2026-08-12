import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

/*
 * Se importa "pg" como default y se desestructura Pool desde ahí
 * (en vez de `import { Pool } from "pg"`) porque bajo bundlers como
 * Webpack la importación nombrada puede resolver a un valor que no
 * es la clase real, rompiendo el constructor interno de pg-pool
 * ("this.Client is not a constructor"). Pasar un Pool ya construido
 * a PrismaPg (en vez de un objeto de configuración) evita que el
 * adaptador tenga que crear el Pool internamente.
 */
const { Pool } = pg;

const globalForPrisma = globalThis as {
  prisma?: PrismaClient;
};

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
