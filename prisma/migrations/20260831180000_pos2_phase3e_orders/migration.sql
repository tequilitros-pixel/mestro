-- POS 2.0 Phase 3E: mutable pre-sale Orders with immutable pricing references.
CREATE TYPE "Pos2OrderStatus" AS ENUM ('OPEN', 'PAYMENT_PENDING', 'FINALIZED', 'VOIDED', 'EXPIRED');
CREATE TYPE "Pos2PricingExplanation" AS ENUM ('GLOBAL_BASE_PRICE', 'BRANCH_OVERRIDE');
CREATE SEQUENCE "pos2_order_number_seq";

CREATE TABLE "Pos2Order" (
  "id" TEXT NOT NULL,
  "orderNumber" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "registerId" TEXT NOT NULL,
  "terminalId" TEXT NOT NULL,
  "cashSessionId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "lastModifiedById" TEXT NOT NULL,
  "status" "Pos2OrderStatus" NOT NULL DEFAULT 'OPEN',
  "currency" TEXT NOT NULL DEFAULT 'MXN',
  "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "discountTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "pricingTimestamp" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMP(3),
  "finalizedAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Pos2Order_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Pos2Order_currency_mxn" CHECK ("currency" = 'MXN'),
  CONSTRAINT "Pos2Order_nonnegative_totals" CHECK ("subtotal" >= 0 AND "discountTotal" >= 0 AND "total" >= 0),
  CONSTRAINT "Pos2Order_total_invariant" CHECK ("total" = "subtotal" - "discountTotal"),
  CONSTRAINT "Pos2Order_version_positive" CHECK ("version" > 0),
  CONSTRAINT "Pos2Order_terminal_metadata" CHECK (
    ("status" = 'FINALIZED' AND "finalizedAt" IS NOT NULL) OR "status" <> 'FINALIZED'
  ),
  CONSTRAINT "Pos2Order_void_metadata" CHECK (
    ("status" = 'VOIDED' AND "voidedAt" IS NOT NULL AND length(btrim("voidReason")) >= 3) OR "status" <> 'VOIDED'
  )
);

CREATE TABLE "Pos2OrderLine" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "productId" TEXT,
  "variantId" TEXT,
  "targetKey" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "catalogVersion" INTEGER NOT NULL,
  "quantity" DECIMAL(18,6) NOT NULL,
  "unit" "CatalogBaseUnit" NOT NULL,
  "unitPrice" DECIMAL(18,2) NOT NULL,
  "lineSubtotal" DECIMAL(18,2) NOT NULL,
  "discountTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "lineTotal" DECIMAL(18,2) NOT NULL,
  "priceVersionId" TEXT NOT NULL,
  "pricingExplanation" "Pos2PricingExplanation" NOT NULL,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Pos2OrderLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Pos2OrderLine_target_contract" CHECK (
    ("productId" IS NOT NULL AND "variantId" IS NULL AND "targetKey" = 'PRODUCT:' || "productId") OR
    ("variantId" IS NOT NULL AND "productId" IS NULL AND "targetKey" = 'VARIANT:' || "variantId")
  ),
  CONSTRAINT "Pos2OrderLine_quantity_positive" CHECK ("quantity" > 0),
  CONSTRAINT "Pos2OrderLine_unit_quantity" CHECK ("unit" <> 'UNIT' OR "quantity" = trunc("quantity")),
  CONSTRAINT "Pos2OrderLine_nonnegative_totals" CHECK ("unitPrice" >= 0 AND "lineSubtotal" >= 0 AND "discountTotal" >= 0 AND "lineTotal" >= 0),
  CONSTRAINT "Pos2OrderLine_total_invariant" CHECK ("lineTotal" = "lineSubtotal" - "discountTotal"),
  CONSTRAINT "Pos2OrderLine_catalog_version" CHECK ("catalogVersion" > 0)
);

CREATE UNIQUE INDEX "Pos2Order_orderNumber_key" ON "Pos2Order"("orderNumber");
CREATE INDEX "Pos2Order_branchId_status_createdAt_idx" ON "Pos2Order"("branchId", "status", "createdAt");
CREATE INDEX "Pos2Order_registerId_status_idx" ON "Pos2Order"("registerId", "status");
CREATE INDEX "Pos2Order_cashSessionId_status_idx" ON "Pos2Order"("cashSessionId", "status");
CREATE INDEX "Pos2Order_createdById_status_idx" ON "Pos2Order"("createdById", "status");
CREATE INDEX "Pos2OrderLine_orderId_position_idx" ON "Pos2OrderLine"("orderId", "position");
CREATE INDEX "Pos2OrderLine_productId_idx" ON "Pos2OrderLine"("productId");
CREATE INDEX "Pos2OrderLine_variantId_idx" ON "Pos2OrderLine"("variantId");
CREATE INDEX "Pos2OrderLine_priceVersionId_idx" ON "Pos2OrderLine"("priceVersionId");

ALTER TABLE "Pos2Order" ADD CONSTRAINT "Pos2Order_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pos2Order" ADD CONSTRAINT "Pos2Order_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "Register"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pos2Order" ADD CONSTRAINT "Pos2Order_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pos2Order" ADD CONSTRAINT "Pos2Order_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pos2OrderLine" ADD CONSTRAINT "Pos2OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Pos2Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pos2OrderLine" ADD CONSTRAINT "Pos2OrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PosProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pos2OrderLine" ADD CONSTRAINT "Pos2OrderLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "PosProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pos2OrderLine" ADD CONSTRAINT "Pos2OrderLine_priceVersionId_fkey" FOREIGN KEY ("priceVersionId") REFERENCES "PriceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Capability" ("id", "key", "description", "active", "createdAt", "updatedAt") VALUES
  ('cap-pos-order-create', 'pos.order.create', 'Crear Orders V2', true, NOW(), NOW()),
  ('cap-pos-order-edit', 'pos.order.edit', 'Editar Orders V2 abiertas', true, NOW(), NOW()),
  ('cap-pos-order-void', 'pos.order.void', 'Anular Orders V2', true, NOW(), NOW()),
  ('cap-pos-order-recover', 'pos.order.recover', 'Recuperar Orders V2 de la sucursal', true, NOW(), NOW()),
  ('cap-pos-payment-begin', 'pos.payment.begin', 'Congelar una Order V2 para intento de cobro', true, NOW(), NOW());

INSERT INTO "CapabilityGrant" ("id", "capabilityId", "role", "scope", "validFrom", "createdAt")
SELECT 'grant-admin-' || replace("key", '.', '-'), "id", 'ADMIN', 'GLOBAL', NOW(), NOW()
FROM "Capability" WHERE "key" IN ('pos.order.create','pos.order.edit','pos.order.void','pos.order.recover','pos.payment.begin');
