import {
  EquipmentStatus,
  EquipmentType,
  PrismaClient,
  UserRole,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "No existe DATABASE_URL. Revisa las variables de entorno."
  );
}

const pool = new Pool({
  connectionString,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

type EquipmentSeed = {
  name: string;
  type: EquipmentType;
  status: EquipmentStatus;
  capacity: number;
  currentLoad: number;
  unit: string;
  location: string;
  active: boolean;
};

const EQUIPMENT: EquipmentSeed[] = [
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
    capacity: 1000,
    currentLoad: 0,
    unit: "L",
    location: "Destilación",
    active: true,
  },
  {
    name: "Alambique 2",
    type: EquipmentType.ALAMBIQUE,
    status: EquipmentStatus.DISPONIBLE,
    capacity: 1000,
    currentLoad: 0,
    unit: "L",
    location: "Destilación",
    active: true,
  },
  {
    name: "Alambique 3",
    type: EquipmentType.ALAMBIQUE,
    status: EquipmentStatus.DISPONIBLE,
    capacity: 1000,
    currentLoad: 0,
    unit: "L",
    location: "Destilación",
    active: true,
  },
];

const LIQUOR_PRODUCTS = [
  {
    name: "Zarzamora",
    slug: "zarzamora",
    prefix: "LZ",
    icon: "🍇",
    description: "Licor de zarzamora de Destiladora del Norte.",
  },
  {
    name: "Mango",
    slug: "mango",
    prefix: "LM",
    icon: "🥭",
    description: "Licor de mango de Destiladora del Norte.",
  },
  {
    name: "Café",
    slug: "cafe",
    prefix: "LC",
    icon: "☕",
    description: "Licor de café de Destiladora del Norte.",
  },
  {
    name: "Jamaica",
    slug: "jamaica",
    prefix: "LJ",
    icon: "🌺",
    description: "Licor de jamaica de Destiladora del Norte.",
  },
  {
    name: "Mojito",
    slug: "mojito",
    prefix: "LMO",
    icon: "🌿",
    description: "Preparado para mojito de Destiladora del Norte.",
  },
  {
    name: "Granada",
    slug: "granada",
    prefix: "LG",
    icon: "🍎",
    description: "Licor de granada de Destiladora del Norte.",
  },
  {
    name: "Tequimiche",
    slug: "tequimiche",
    prefix: "LTQ",
    icon: "🌶️",
    description: "Preparado para Tequimiche de Destiladora del Norte.",
  },
  {
    name: "Sangría",
    slug: "sangria",
    prefix: "LS",
    icon: "🍷",
    description: "Sangría para preparar Tequilitros.",
  },
  {
    name: "Destilado para Coscorrón",
    slug: "destilado-coscorron",
    prefix: "LDC",
    icon: "🥃",
    description:
      "Destilado utilizado para la elaboración del Coscorrón.",
  },
];

async function ensureInitialAdmin() {
  const existingUser = await prisma.user.findUnique({
    where: {
      username: "adan",
    },
  });

  if (existingUser) {
    console.log("✅ El usuario administrador ya existe.");

    return existingUser;
  }

  const password = await bcrypt.hash("adan123", 12);

  const user = await prisma.user.create({
    data: {
      name: "Adán Sánchez",
      username: "adan",
      email: "adan@maestro.local",
      password,
      role: UserRole.ADMIN,
      active: true,
    },
  });

  console.log("✅ Usuario administrador inicial creado.");

  return user;
}

async function ensureEquipment(item: EquipmentSeed) {
  const existingEquipment = await prisma.equipment.findFirst({
    where: {
      name: item.name,
    },
  });

  if (existingEquipment) {
    await prisma.equipment.update({
      where: {
        id: existingEquipment.id,
      },
      data: {
        type: item.type,
        capacity: item.capacity,
        unit: item.unit,
        location: item.location,
        active: item.active,
      },
    });

    return;
  }

  await prisma.equipment.create({
    data: item,
  });
}

async function seedEquipment() {
  console.log("🏭 Revisando equipos...");

  for (const item of EQUIPMENT) {
    await ensureEquipment(item);
  }

  console.log("✅ Equipos listos.");
}

async function seedLiquorProducts(createdById: string) {
  console.log("🍹 Cargando catálogo de licores...");

  for (const product of LIQUOR_PRODUCTS) {
    await prisma.liquorProduct.upsert({
      where: {
        slug: product.slug,
      },
      update: {
        name: product.name,
        prefix: product.prefix,
        icon: product.icon,
        description: product.description,
        active: true,
      },
      create: {
        name: product.name,
        slug: product.slug,
        prefix: product.prefix,
        icon: product.icon,
        description: product.description,
        active: true,
        createdById,
      },
    });
  }

  console.log(
    `✅ ${LIQUOR_PRODUCTS.length} productos de licores listos.`
  );
}

async function main() {
  console.log("🚀 Inicializando datos base de MAESTRO...");

  /*
   * Este seed NO borra lotes, procesos, usuarios ni información
   * histórica. Puede ejecutarse varias veces.
   */
  const admin = await ensureInitialAdmin();

  await seedEquipment();

  await seedLiquorProducts(admin.id);

  console.log("✅ Seed de MAESTRO terminado correctamente.");
}

main()
  .catch((error) => {
    console.error("❌ Error al ejecutar el seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });