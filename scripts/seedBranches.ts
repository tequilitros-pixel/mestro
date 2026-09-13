import { prisma } from "@/lib/prisma";

const BRANCHES = [
  { name: "Veliz", code: "VELIZ" },
  { name: "Colotlán Centro", code: "COLOTLAN" },
  { name: "Canoas", code: "CANOAS" },
  { name: "Huejúcar", code: "HUEJUCAR" },
  { name: "Tlaltenango", code: "TLALTENANGO" },
  { name: "Barra", code: "BARRA" },
];

async function main() {
  for (const branch of BRANCHES) {
    const existing = await prisma.branch.findUnique({ where: { code: branch.code } });
    if (existing) {
      console.log(`Ya existe: ${branch.name}`);
      continue;
    }
    await prisma.branch.create({ data: branch });
    console.log(`Creada: ${branch.name}`);
  }
}

main()
  .then(() => {
    console.log("Listo.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
