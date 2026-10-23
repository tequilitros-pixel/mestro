import pg from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { collectPilotReadiness } from "../lib/pos2/certification/collectReadiness";

async function main() {
  const databaseUrl = process.env.POS2_CERTIFICATION_DATABASE_URL;
  if (!databaseUrl) throw new Error("POS2_CERTIFICATION_DATABASE_URL is required; DATABASE_URL is deliberately ignored.");
  if (!process.argv.includes("--migration-clean")) throw new Error("Run prisma migrate diff/status first, then pass --migration-clean.");
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const report = await collectPilotReadiness(prisma, { migrationDrift: false });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.status === "FAIL") process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "POS2 certification failed.");
  process.exitCode = 1;
});
