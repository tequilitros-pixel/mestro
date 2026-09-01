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

function verifiedDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL no está configurada.");
  const url = new URL(value);
  // pg 9 dejará de tratar `require` como verificación completa. Fijarlo aquí
  // mantiene validación de certificado aunque una integración regenere la URL.
  url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}

const pool = new Pool({ connectionString: verifiedDatabaseUrl() });
const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
