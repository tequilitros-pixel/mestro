const { CatalogBaseUnit } = require("@prisma/client");

if (CatalogBaseUnit?.G !== "G") {
  throw new Error("PRISMA_CLIENT_CATALOG_BASE_UNIT_G_MISSING");
}

console.log("Prisma CatalogBaseUnit includes G");
