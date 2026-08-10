import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const user = await prisma.user.findUnique({
  where: { email: "adan@maestro.local" },
  select: { id: true, name: true, active: true, failedLoginAttempts: true, lockedUntil: true },
});
console.log(JSON.stringify(user, null, 2));
await prisma.$disconnect();
