import "dotenv/config";

import {
  PrismaClient,
  EquipmentStatus,
  EquipmentType,
} from "@prisma/client";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: "file:./dev.db",
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log("🧹 Limpiando equipos...");

  await prisma.equipment.deleteMany();

  console.log("🏭 Creando equipos...");

  await prisma.equipment.createMany({
    data: [
      {
        name: "Horno 1",
        type: EquipmentType.HORNO,
        status: EquipmentStatus.OPERANDO,
        capacity: 3500,
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

  console.log("✅ Equipos cargados correctamente.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });