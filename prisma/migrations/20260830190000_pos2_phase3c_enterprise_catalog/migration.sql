-- POS 2.0 Phase 3C: evolve the existing global POS catalog and add branch overrides.
-- Prices and recipes remain legacy-compatible; no pricing engine is introduced.

CREATE TYPE "CatalogBaseUnit" AS ENUM ('UNIT', 'ML');
CREATE TYPE "BranchProductAvailability" AS ENUM ('AVAILABLE', 'TEMPORARILY_UNAVAILABLE');

ALTER TABLE "PosCategory"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "icon" TEXT,
  ADD COLUMN "imageAlt" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "PosProduct"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "sku" TEXT,
  ADD COLUMN "internalCode" TEXT,
  ADD COLUMN "barcode" TEXT,
  ADD COLUMN "imageAlt" TEXT,
  ADD COLUMN "sellable" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "inventoryTracked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "baseUnit" "CatalogBaseUnit" NOT NULL DEFAULT 'UNIT',
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "PosProductVariant"
  ADD COLUMN "sku" TEXT,
  ADD COLUMN "internalCode" TEXT,
  ADD COLUMN "barcode" TEXT,
  ADD COLUMN "baseUnit" "CatalogBaseUnit" NOT NULL DEFAULT 'UNIT',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "BranchProductOverride" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "visibleInPos" BOOLEAN NOT NULL DEFAULT true,
  "availability" "BranchProductAvailability" NOT NULL DEFAULT 'AVAILABLE',
  "sortOrder" INTEGER,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BranchProductOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PosCategory_slug_key" ON "PosCategory"("slug");
CREATE INDEX "PosCategory_active_position_idx" ON "PosCategory"("active", "position");
CREATE UNIQUE INDEX "PosProduct_sku_key" ON "PosProduct"("sku");
CREATE UNIQUE INDEX "PosProduct_internalCode_key" ON "PosProduct"("internalCode");
CREATE UNIQUE INDEX "PosProduct_barcode_key" ON "PosProduct"("barcode");
CREATE INDEX "PosProduct_active_sellable_idx" ON "PosProduct"("active", "sellable");
CREATE INDEX "PosProduct_name_idx" ON "PosProduct"("name");
CREATE INDEX "PosProduct_categoryId_position_idx" ON "PosProduct"("categoryId", "position");
CREATE UNIQUE INDEX "PosProductVariant_sku_key" ON "PosProductVariant"("sku");
CREATE UNIQUE INDEX "PosProductVariant_internalCode_key" ON "PosProductVariant"("internalCode");
CREATE UNIQUE INDEX "PosProductVariant_barcode_key" ON "PosProductVariant"("barcode");
CREATE INDEX "PosProductVariant_productId_active_position_idx" ON "PosProductVariant"("productId", "active", "position");
CREATE INDEX "PosProductVariant_name_idx" ON "PosProductVariant"("name");
CREATE UNIQUE INDEX "BranchProductOverride_branchId_productId_key" ON "BranchProductOverride"("branchId", "productId");
CREATE INDEX "BranchProductOverride_branchId_enabled_visibleInPos_idx" ON "BranchProductOverride"("branchId", "enabled", "visibleInPos");
CREATE INDEX "BranchProductOverride_productId_idx" ON "BranchProductOverride"("productId");

ALTER TABLE "BranchProductOverride" ADD CONSTRAINT "BranchProductOverride_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BranchProductOverride" ADD CONSTRAINT "BranchProductOverride_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PosProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BranchProductOverride" ADD CONSTRAINT "BranchProductOverride_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BranchProductOverride" ADD CONSTRAINT "BranchProductOverride_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Capability" ("id", "key", "description", "active", "createdAt", "updatedAt") VALUES
  ('cap-catalog-view', 'catalog.view', 'Consultar catálogo empresarial', true, NOW(), NOW()),
  ('cap-catalog-create', 'catalog.create', 'Crear productos empresariales', true, NOW(), NOW()),
  ('cap-catalog-archive', 'catalog.archive', 'Archivar productos empresariales', true, NOW(), NOW()),
  ('cap-catalog-category-manage', 'catalog.category.manage', 'Administrar categorías empresariales', true, NOW(), NOW()),
  ('cap-catalog-variant-manage', 'catalog.variant.manage', 'Administrar variantes empresariales', true, NOW(), NOW()),
  ('cap-catalog-branch-override-manage', 'catalog.branch_override.manage', 'Administrar disponibilidad local del catálogo', true, NOW(), NOW());

INSERT INTO "CapabilityGrant" ("id", "capabilityId", "role", "scope", "validFrom", "createdAt") VALUES
  ('grant-admin-catalog-view', 'cap-catalog-view', 'ADMIN', 'GLOBAL', NOW(), NOW()),
  ('grant-admin-catalog-create', 'cap-catalog-create', 'ADMIN', 'GLOBAL', NOW(), NOW()),
  ('grant-admin-catalog-edit', 'cap-catalog-edit', 'ADMIN', 'GLOBAL', NOW(), NOW()),
  ('grant-admin-catalog-archive', 'cap-catalog-archive', 'ADMIN', 'GLOBAL', NOW(), NOW()),
  ('grant-admin-catalog-category-manage', 'cap-catalog-category-manage', 'ADMIN', 'GLOBAL', NOW(), NOW()),
  ('grant-admin-catalog-variant-manage', 'cap-catalog-variant-manage', 'ADMIN', 'GLOBAL', NOW(), NOW()),
  ('grant-admin-catalog-branch-override-manage', 'cap-catalog-branch-override-manage', 'ADMIN', 'GLOBAL', NOW(), NOW());
