import "dotenv/config";
import { defineConfig, env } from "prisma/config";

const migrationDatabaseUrl =
  process.env.MIGRATION_DATABASE_URL ??
  process.env.DATABASE_URL_UNPOOLED ??
  env("DATABASE_URL");

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    seed: "tsx prisma/seed.ts",
  },

  datasource: {
    // La aplicación usa un rol runtime sin BYPASSRLS. Las migraciones deben
    // conservar una conexión owner separada para poder aplicar DDL.
    url: migrationDatabaseUrl,
  },
});
