import "dotenv/config";
import { PrismaClient, CookingStatus, MillingStatus, DistillationStatus, DistillationType, LotStage } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const admin = await prisma.user.findUnique({ where: { username: "adan" } });
  if (!admin) throw new Error("No se encontró el usuario adan");

  const equipment = await prisma.equipment.findMany();
  const horno = equipment.find((e) => e.type === "HORNO");
  const alambique = equipment.find((e) => e.type === "ALAMBIQUE");

  if (!horno || !alambique) {
    throw new Error("Faltan equipos (horno o alambique) en la base de datos");
  }

  const startedAt = new Date(Date.now() - 1000 * 60 * 60 * 24 * 5); // hace 5 días
  const cookingStart = startedAt;
  const cookingEnd = new Date(cookingStart.getTime() + 1000 * 60 * 60 * 34); // 34 horas

  const lot = await prisma.lot.create({
    data: {
      code: "AG-TEST-001",
      stage: LotStage.TERMINADO,
      agaveKg: 3500,
      art: 28,
      startedAt,
      finishedAt: new Date(),
      observations: "Lote de prueba para validar comparación histórica.",
      ownerId: admin.id,
    },
  });

  const cooking = await prisma.cooking.create({
    data: {
      lotId: lot.id,
      equipmentId: horno.id,
      agaveKg: 3500,
      status: CookingStatus.TERMINADA,
      startedAt: cookingStart,
      finishedAt: cookingEnd,
      events: {
        create: [
          { type: "TEMPERATURA", temperature: 90, createdAt: cookingStart },
          { type: "TEMPERATURA", temperature: 92, createdAt: new Date(cookingStart.getTime() + 1000 * 60 * 60 * 10) },
          { type: "TEMPERATURA", temperature: 93, createdAt: new Date(cookingStart.getTime() + 1000 * 60 * 60 * 20) },
          { type: "FIN_COCCION", createdAt: cookingEnd },
        ],
      },
    },
  });

  await prisma.milling.create({
    data: {
      lotId: lot.id,
      equipmentId: horno.id,
      status: MillingStatus.TERMINADA,
      cookedKg: 3500,
      mashLiters: 3080, // ~88% extracción
      brix: 12,
      startedAt: cookingEnd,
      finishedAt: new Date(cookingEnd.getTime() + 1000 * 60 * 60 * 4),
    },
  });

  const distillation = await prisma.distillation.create({
    data: {
      lotId: lot.id,
      equipmentId: alambique.id,
      type: DistillationType.RECTIFICACION,
      loadedLiters: 3080,
      initialAlcohol: 6.8,
      headsLiters: 15,
      heartLiters: 540,
      tailsLiters: 40,
      finalAlcohol: 40,
      status: DistillationStatus.TERMINADA,
      startedAt: new Date(cookingEnd.getTime() + 1000 * 60 * 60 * 24),
      finishedAt: new Date(cookingEnd.getTime() + 1000 * 60 * 60 * 30),
    },
  });

  await prisma.lotExpense.createMany({
    data: [
      { lotId: lot.id, category: "Agave", concept: "Compra de agave", amount: 14000 },
      { lotId: lot.id, category: "Gas", concept: "Gas para cocción", amount: 3500 },
      { lotId: lot.id, category: "Mano de obra", concept: "Turnos", amount: 4500 },
    ],
  });

  console.log("✅ Lote de prueba creado:", lot.code);
  console.log("Cooking:", cooking.id, "Distillation:", distillation.id);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
