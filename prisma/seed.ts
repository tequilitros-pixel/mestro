import {
  PrismaClient,
  EquipmentStatus,
  EquipmentType,
  UserRole,
  LotStage,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🧹 Limpiando base de datos...");

  await prisma.lot.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.user.deleteMany();

  console.log("👤 Creando usuario...");

  await prisma.user.createMany({
  data: [
    {
      name: "Adán Sánchez",
      username: "adan",
      email: "adan@maestro.local",
      password: "adan123",
      role: UserRole.ADMIN,
      active: true,
    },
    {
      name: "Adrián Sánchez",
      username: "adrian",
      email: "adrian@maestro.local",
      password: "adrian123",
      role: UserRole.ADMIN,
      active: true,
    },
    {
      name: "Rubí Ramos",
      username: "rubi",
      email: "rubi@maestro.local",
      password: "rubi123",
      role: UserRole.OPERATOR,
      active: true,
    },
    {
      name: "Operador 1",
      username: "operador1",
      email: "operador1@maestro.local",
      password: "operador123",
      role: UserRole.OPERATOR,
      active: true,
    },
  ],
});

  const user = await prisma.user.findUnique({
  where: {
    username: "adan",
  },
});

if (!user) {
  throw new Error("No se encontró el usuario administrador inicial");
}

  console.log("🏭 Creando equipos...");

  await prisma.equipment.createMany({
    data: [
      {
        name: "Horno 1",
        type: EquipmentType.HORNO,
        status: EquipmentStatus.OPERANDO,
        capacity: 7000,
        currentLoad: 3500,
        unit: "kg",
        location: "Cocción",
        active: true,
      },
      {
        name: "Desgarradora",
        type: EquipmentType.DESGARRADORA,
        status: EquipmentStatus.DISPONIBLE,
        capacity: 1000,
        currentLoad: 0,
        unit: "kg/h",
        location: "Molienda",
        active: true,
      },
      {
        name: "Prensa 1",
        type: EquipmentType.PRENSA,
        status: EquipmentStatus.DISPONIBLE,
        capacity: 1000,
        currentLoad: 0,
        unit: "kg/h",
        location: "Molienda",
        active: true,
      },
      {
        name: "Prensa 2",
        type: EquipmentType.PRENSA,
        status: EquipmentStatus.DISPONIBLE,
        capacity: 1000,
        currentLoad: 0,
        unit: "kg/h",
        location: "Molienda",
        active: true,
      },
      {
        name: "Tina 1",
        type: EquipmentType.TINA,
        status: EquipmentStatus.DISPONIBLE,
        capacity: 6000,
        currentLoad: 0,
        unit: "L",
        location: "Fermentación",
        active: true,
      },
      {
        name: "Tina 2",
        type: EquipmentType.TINA,
        status: EquipmentStatus.DISPONIBLE,
        capacity: 6000,
        currentLoad: 0,
        unit: "L",
        location: "Fermentación",
        active: true,
      },
      {
        name: "Tina 3",
        type: EquipmentType.TINA,
        status: EquipmentStatus.DISPONIBLE,
        capacity: 6000,
        currentLoad: 0,
        unit: "L",
        location: "Fermentación",
        active: true,
      },
      {
        name: "Tina 4",
        type: EquipmentType.TINA,
        status: EquipmentStatus.DISPONIBLE,
        capacity: 6000,
        currentLoad: 0,
        unit: "L",
        location: "Fermentación",
        active: true,
      },
      {
        name: "Alambique 1",
        type: EquipmentType.ALAMBIQUE,
        status: EquipmentStatus.DISPONIBLE,
        capacity: 850,
        currentLoad: 0,
        unit: "L",
        location: "Destilación",
        active: true,
      },
      {
        name: "Alambique 2",
        type: EquipmentType.ALAMBIQUE,
        status: EquipmentStatus.DISPONIBLE,
        capacity: 850,
        currentLoad: 0,
        unit: "L",
        location: "Destilación",
        active: true,
      },
      {
        name: "Alambique 3",
        type: EquipmentType.ALAMBIQUE,
        status: EquipmentStatus.DISPONIBLE,
        capacity: 850,
        currentLoad: 0,
        unit: "L",
        location: "Destilación",
        active: true,
      },
    ],
  });

  console.log("📦 Creando lote inicial...");

  await prisma.lot.create({
    data: {
      code: "AG-2026-001",
      stage: LotStage.RECEPCION,
      agaveKg: 3500,
      art: 28,
      startedAt: new Date(),
      observations: "Lote inicial del sistema MAESTRO.",
      ownerId: user.id,
    },
  });

  console.log("✅ Base de datos inicializada.");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });