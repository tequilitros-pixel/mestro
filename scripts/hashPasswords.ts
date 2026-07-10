import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany();

  for (const user of users) {
    // Si ya está hasheada (empieza con $2), la saltamos
    if (user.password.startsWith("$2")) {
      console.log(`Ya hasheada: ${user.username}`);
      continue;
    }

    const hashed = await bcrypt.hash(user.password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    console.log(`✅ Hasheada: ${user.username}`);
  }

  console.log("Listo.");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
