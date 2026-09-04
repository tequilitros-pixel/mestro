-- POS 2.0 Phase 3G: explicit recipe units and immutable Sale/Payment facts.
CREATE TYPE "RecipeIngredientUnitStatus" AS ENUM ('RESOLVED','UNRESOLVED');
CREATE TYPE "Pos2SaleStatus" AS ENUM ('COMPLETED','PARTIALLY_RETURNED','RETURNED','CANCELLED');
CREATE TYPE "Pos2PaymentMethod" AS ENUM ('CASH','CARD','TRANSFER');
CREATE TYPE "Pos2PaymentStatus" AS ENUM ('CAPTURED','VOIDED');

ALTER TABLE "PosVariantIngredient" ADD COLUMN "unit" "CatalogBaseUnit";
ALTER TABLE "PosVariantIngredient" ADD COLUMN "unitStatus" "RecipeIngredientUnitStatus" NOT NULL DEFAULT 'UNRESOLVED';
UPDATE "PosVariantIngredient" ingredient
SET "unit"=product."inventoryBaseUnit", "unitStatus"='RESOLVED'
FROM "InventoryProduct" product
WHERE product."id"=ingredient."inventoryProductId" AND product."inventoryBaseUnit" IS NOT NULL;
ALTER TABLE "PosVariantIngredient" ADD CONSTRAINT "PosVariantIngredient_unit_resolution_check"
CHECK (("unitStatus"='RESOLVED' AND "unit" IS NOT NULL) OR ("unitStatus"='UNRESOLVED' AND "unit" IS NULL));

CREATE SEQUENCE pos2_sale_number_seq START 1;
CREATE TABLE "Pos2Sale" (
 "id" TEXT PRIMARY KEY, "saleNumber" TEXT NOT NULL, "orderId" TEXT NOT NULL,
 "branchId" TEXT NOT NULL, "registerId" TEXT NOT NULL, "terminalId" TEXT NOT NULL, "cashSessionId" TEXT NOT NULL, "cashierId" TEXT NOT NULL,
 "currency" TEXT NOT NULL DEFAULT 'MXN', "subtotal" DECIMAL(18,2) NOT NULL, "discountTotal" DECIMAL(18,2) NOT NULL,
 "total" DECIMAL(18,2) NOT NULL, "status" "Pos2SaleStatus" NOT NULL DEFAULT 'COMPLETED', "operationId" UUID NOT NULL,
 "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Pos2Sale_totals_nonnegative" CHECK ("subtotal">=0 AND "discountTotal">=0 AND "total">=0),
 CONSTRAINT "Pos2Sale_total_equation" CHECK ("total"="subtotal"-"discountTotal")
);
CREATE TABLE "Pos2SaleLine" (
 "id" TEXT PRIMARY KEY, "saleId" TEXT NOT NULL, "orderLineId" TEXT NOT NULL, "productId" TEXT, "variantId" TEXT,
 "productNameSnapshot" TEXT NOT NULL, "variantNameSnapshot" TEXT, "skuSnapshot" TEXT,
 "quantity" DECIMAL(18,6) NOT NULL, "unit" "CatalogBaseUnit" NOT NULL, "unitPrice" DECIMAL(18,2) NOT NULL,
 "lineSubtotal" DECIMAL(18,2) NOT NULL, "discountTotal" DECIMAL(18,2) NOT NULL, "lineTotal" DECIMAL(18,2) NOT NULL,
 "priceVersionId" TEXT NOT NULL, "pricingExplanation" "Pos2PricingExplanation" NOT NULL, "taxIncluded" BOOLEAN NOT NULL DEFAULT true,
 "position" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Pos2SaleLine_exact_target" CHECK (("productId" IS NOT NULL)::int+("variantId" IS NOT NULL)::int=1),
 CONSTRAINT "Pos2SaleLine_values_check" CHECK ("quantity">0 AND "unitPrice">=0 AND "lineSubtotal">=0 AND "discountTotal">=0 AND "lineTotal">=0),
 CONSTRAINT "Pos2SaleLine_total_equation" CHECK ("lineTotal"="lineSubtotal"-"discountTotal")
);
CREATE TABLE "Pos2Payment" (
 "id" TEXT PRIMARY KEY, "saleId" TEXT NOT NULL, "branchId" TEXT NOT NULL, "terminalId" TEXT NOT NULL, "actorId" TEXT NOT NULL,
 "method" "Pos2PaymentMethod" NOT NULL, "status" "Pos2PaymentStatus" NOT NULL DEFAULT 'CAPTURED', "amount" DECIMAL(18,2) NOT NULL,
 "cashTendered" DECIMAL(18,2), "changeGiven" DECIMAL(18,2), "currency" TEXT NOT NULL DEFAULT 'MXN', "reference" TEXT,
 "position" INTEGER NOT NULL, "operationId" UUID NOT NULL, "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Pos2Payment_amount_positive" CHECK ("amount">0),
 CONSTRAINT "Pos2Payment_cash_fields" CHECK (("method"='CASH' AND "cashTendered" IS NOT NULL AND "changeGiven" IS NOT NULL AND "cashTendered">="amount" AND "changeGiven"="cashTendered"-"amount") OR ("method"<>'CASH' AND "cashTendered" IS NULL AND "changeGiven" IS NULL))
);
CREATE UNIQUE INDEX "Pos2Sale_saleNumber_key" ON "Pos2Sale"("saleNumber");
CREATE UNIQUE INDEX "Pos2Sale_orderId_key" ON "Pos2Sale"("orderId");
CREATE UNIQUE INDEX "Pos2Sale_operationId_key" ON "Pos2Sale"("operationId");
CREATE INDEX "Pos2Sale_branchId_completedAt_idx" ON "Pos2Sale"("branchId","completedAt");
CREATE INDEX "Pos2Sale_registerId_completedAt_idx" ON "Pos2Sale"("registerId","completedAt");
CREATE INDEX "Pos2Sale_cashSessionId_completedAt_idx" ON "Pos2Sale"("cashSessionId","completedAt");
CREATE UNIQUE INDEX "Pos2SaleLine_orderLineId_key" ON "Pos2SaleLine"("orderLineId");
CREATE INDEX "Pos2SaleLine_saleId_position_idx" ON "Pos2SaleLine"("saleId","position");
CREATE INDEX "Pos2SaleLine_productId_idx" ON "Pos2SaleLine"("productId");
CREATE INDEX "Pos2SaleLine_variantId_idx" ON "Pos2SaleLine"("variantId");
CREATE UNIQUE INDEX "Pos2Payment_saleId_position_key" ON "Pos2Payment"("saleId","position");
CREATE INDEX "Pos2Payment_branchId_capturedAt_idx" ON "Pos2Payment"("branchId","capturedAt");
CREATE INDEX "Pos2Payment_operationId_idx" ON "Pos2Payment"("operationId");
ALTER TABLE "Pos2Sale" ADD FOREIGN KEY ("orderId") REFERENCES "Pos2Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pos2Sale" ADD FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pos2Sale" ADD FOREIGN KEY ("registerId") REFERENCES "Register"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pos2Sale" ADD FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pos2Sale" ADD FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pos2Sale" ADD FOREIGN KEY ("cashierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pos2SaleLine" ADD FOREIGN KEY ("saleId") REFERENCES "Pos2Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pos2SaleLine" ADD FOREIGN KEY ("productId") REFERENCES "PosProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pos2SaleLine" ADD FOREIGN KEY ("variantId") REFERENCES "PosProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pos2SaleLine" ADD FOREIGN KEY ("priceVersionId") REFERENCES "PriceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pos2Payment" ADD FOREIGN KEY ("saleId") REFERENCES "Pos2Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pos2Payment" ADD FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pos2Payment" ADD FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pos2Payment" ADD FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION pos2_reject_sale_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'POS2_FINANCIAL_FACT_IS_IMMUTABLE' USING ERRCODE='55000'; END $$;
CREATE TRIGGER "Pos2Sale_immutable" BEFORE UPDATE OR DELETE ON "Pos2Sale" FOR EACH ROW EXECUTE FUNCTION pos2_reject_sale_mutation();
CREATE TRIGGER "Pos2SaleLine_immutable" BEFORE UPDATE OR DELETE ON "Pos2SaleLine" FOR EACH ROW EXECUTE FUNCTION pos2_reject_sale_mutation();
CREATE TRIGGER "Pos2Payment_immutable" BEFORE UPDATE OR DELETE ON "Pos2Payment" FOR EACH ROW EXECUTE FUNCTION pos2_reject_sale_mutation();

INSERT INTO "Capability" ("id","key","description","active","createdAt","updatedAt") VALUES
 ('cap-pos-sale-complete','pos.sale.complete','Completar Sale V2',true,NOW(),NOW()),
 ('cap-pos-payment-cash','pos.payment.cash','Capturar pago efectivo V2',true,NOW(),NOW()),
 ('cap-pos-payment-card','pos.payment.card','Capturar pago tarjeta V2',true,NOW(),NOW()),
 ('cap-pos-payment-transfer','pos.payment.transfer','Capturar transferencia V2',true,NOW(),NOW());
INSERT INTO "CapabilityGrant" ("id","capabilityId","role","scope","validFrom","createdAt")
SELECT 'grant-admin-'||replace("key",'.','-'),"id",'ADMIN','GLOBAL',NOW(),NOW() FROM "Capability"
WHERE "key" IN ('pos.sale.complete','pos.payment.cash','pos.payment.card','pos.payment.transfer');
