import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { contextualPrisma } from "@/lib/contextual-prisma";

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

// Pass the connection explicitly: Pool instanceof checks can fail when the
// deployment loads distinct pg modules and silently fall back to PG* defaults.
// next.config.ts externalizes the adapter and pg so its native constructor works.
const adapter = new PrismaPg({ connectionString: verifiedDatabaseUrl() });

export const rawPrisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

export const prisma = contextualPrisma(rawPrisma);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = rawPrisma;
}
