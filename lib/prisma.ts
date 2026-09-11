import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { contextualPrisma } from "@/lib/contextual-prisma";

const globalForPrisma = globalThis as {
  prisma?: PrismaClient;
};

function verifiedDatabaseUrl() {
  const value = process.env.MAESTRO_RUNTIME_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL no está configurada.");
  if (process.env.VERCEL === "1" && !process.env.MAESTRO_RUNTIME_DATABASE_URL) {
    throw new Error("MAESTRO_RUNTIME_DATABASE_URL no está configurada.");
  }
  const url = new URL(value);
  if (process.env.VERCEL === "1" && url.username !== "maestro_scheduler_login_377326ac" && url.username !== "maestro_runtime") {
    throw new Error("RUNTIME_CONNECTION_PRINCIPAL_MUST_BE_RESTRICTED");
  }
  // pg 9 dejará de tratar `require` como verificación completa. Fijarlo aquí
  // mantiene validación de certificado aunque una integración regenere la URL.
  // La instancia efímera de QA local no expone TLS; las conexiones remotas,
  // incluida toda producción, conservan verificación estricta del certificado.
  const localDevelopment = ["localhost", "127.0.0.1"].includes(url.hostname);
  url.searchParams.set("sslmode", localDevelopment ? "disable" : "verify-full");
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
