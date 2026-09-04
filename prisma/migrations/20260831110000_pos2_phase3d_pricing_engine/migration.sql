-- POS 2.0 Phase 3D: immutable, scheduled, branch-aware base pricing.
CREATE TYPE "PriceTargetType" AS ENUM ('PRODUCT', 'VARIANT');
CREATE TYPE "PriceScope" AS ENUM ('GLOBAL', 'BRANCH');

CREATE TABLE "PriceVersion" (
  "id" TEXT NOT NULL,
  "targetType" "PriceTargetType" NOT NULL,
  "targetKey" TEXT NOT NULL,
  "productId" TEXT,
  "variantId" TEXT,
  "scope" "PriceScope" NOT NULL,
  "branchId" TEXT,
  "branchKey" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'MXN',
  "taxIncluded" BOOLEAN NOT NULL DEFAULT true,
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validTo" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "operationId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PriceVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PriceVersion_positive_amount" CHECK ("amount" >= 0),
  CONSTRAINT "PriceVersion_currency_mxn" CHECK ("currency" = 'MXN'),
  CONSTRAINT "PriceVersion_tax_included" CHECK ("taxIncluded" = true),
  CONSTRAINT "PriceVersion_valid_window" CHECK ("validTo" IS NULL OR "validTo" > "validFrom"),
  CONSTRAINT "PriceVersion_target_contract" CHECK (
    ("targetType" = 'PRODUCT' AND "productId" IS NOT NULL AND "variantId" IS NULL AND "targetKey" = 'PRODUCT:' || "productId") OR
    ("targetType" = 'VARIANT' AND "variantId" IS NOT NULL AND "productId" IS NULL AND "targetKey" = 'VARIANT:' || "variantId")
  ),
  CONSTRAINT "PriceVersion_scope_contract" CHECK (
    ("scope" = 'GLOBAL' AND "branchId" IS NULL AND "branchKey" = 'GLOBAL') OR
    ("scope" = 'BRANCH' AND "branchId" IS NOT NULL AND "branchKey" = 'BRANCH:' || "branchId")
  )
);

CREATE TABLE "PriceVersionTermination" (
  "id" TEXT NOT NULL,
  "priceVersionId" TEXT NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "operationId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PriceVersionTermination_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PriceVersionTermination_reason" CHECK (length(btrim("reason")) >= 3)
);

CREATE UNIQUE INDEX "PriceVersion_operationId_key" ON "PriceVersion"("operationId");
CREATE INDEX "PriceVersion_targetKey_branchKey_currency_validFrom_idx" ON "PriceVersion"("targetKey", "branchKey", "currency", "validFrom");
CREATE INDEX "PriceVersion_productId_validFrom_idx" ON "PriceVersion"("productId", "validFrom");
CREATE INDEX "PriceVersion_variantId_validFrom_idx" ON "PriceVersion"("variantId", "validFrom");
CREATE INDEX "PriceVersion_branchId_validFrom_idx" ON "PriceVersion"("branchId", "validFrom");
CREATE UNIQUE INDEX "PriceVersionTermination_priceVersionId_key" ON "PriceVersionTermination"("priceVersionId");
CREATE UNIQUE INDEX "PriceVersionTermination_operationId_key" ON "PriceVersionTermination"("operationId");
CREATE INDEX "PriceVersionTermination_effectiveAt_idx" ON "PriceVersionTermination"("effectiveAt");

ALTER TABLE "PriceVersion" ADD CONSTRAINT "PriceVersion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PosProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PriceVersion" ADD CONSTRAINT "PriceVersion_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "PosProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PriceVersion" ADD CONSTRAINT "PriceVersion_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PriceVersionTermination" ADD CONSTRAINT "PriceVersionTermination_priceVersionId_fkey" FOREIGN KEY ("priceVersionId") REFERENCES "PriceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- All writers, including raw SQL, serialize on the same timeline and reject overlaps.
CREATE FUNCTION pos2_price_version_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE conflict_id TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."targetKey" || '|' || NEW."branchKey" || '|' || NEW."currency", 0));
  SELECT pv."id" INTO conflict_id
  FROM "PriceVersion" pv
  LEFT JOIN "PriceVersionTermination" pvt ON pvt."priceVersionId" = pv."id"
  WHERE pv."targetKey" = NEW."targetKey"
    AND pv."branchKey" = NEW."branchKey"
    AND pv."currency" = NEW."currency"
    AND tstzrange(pv."validFrom", LEAST(COALESCE(pv."validTo", 'infinity'), COALESCE(pvt."effectiveAt", 'infinity')), '[)')
        && tstzrange(NEW."validFrom", COALESCE(NEW."validTo", 'infinity'), '[)')
  LIMIT 1;
  IF conflict_id IS NOT NULL THEN
    RAISE EXCEPTION 'PRICE_WINDOW_OVERLAP:%', conflict_id USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "PriceVersion_no_overlap" BEFORE INSERT ON "PriceVersion"
FOR EACH ROW EXECUTE FUNCTION pos2_price_version_guard();

CREATE FUNCTION pos2_price_termination_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pv "PriceVersion"%ROWTYPE;
BEGIN
  SELECT * INTO pv FROM "PriceVersion" WHERE "id" = NEW."priceVersionId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRICE_VERSION_NOT_FOUND' USING ERRCODE = '23503'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(pv."targetKey" || '|' || pv."branchKey" || '|' || pv."currency", 0));
  IF NEW."effectiveAt" < pv."validFrom" OR (pv."validTo" IS NOT NULL AND NEW."effectiveAt" > pv."validTo") THEN
    RAISE EXCEPTION 'INVALID_PRICE_TERMINATION' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "PriceVersionTermination_validate" BEFORE INSERT ON "PriceVersionTermination"
FOR EACH ROW EXECUTE FUNCTION pos2_price_termination_guard();

CREATE FUNCTION pos2_reject_pricing_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'PUBLISHED_PRICE_IS_IMMUTABLE' USING ERRCODE = '55000'; END $$;
CREATE TRIGGER "PriceVersion_immutable" BEFORE UPDATE OR DELETE ON "PriceVersion" FOR EACH ROW EXECUTE FUNCTION pos2_reject_pricing_mutation();
CREATE TRIGGER "PriceVersionTermination_immutable" BEFORE UPDATE OR DELETE ON "PriceVersionTermination" FOR EACH ROW EXECUTE FUNCTION pos2_reject_pricing_mutation();

INSERT INTO "Capability" ("id", "key", "description", "active", "createdAt", "updatedAt") VALUES
  ('cap-pricing-view', 'pricing.view', 'Consultar precios V2', true, NOW(), NOW()),
  ('cap-pricing-create', 'pricing.create', 'Publicar versiones de precio', true, NOW(), NOW()),
  ('cap-pricing-edit-future', 'pricing.edit_future', 'Sustituir precios futuros mediante nuevas versiones', true, NOW(), NOW()),
  ('cap-pricing-end', 'pricing.end', 'Finalizar anticipadamente una versión de precio', true, NOW(), NOW()),
  ('cap-pricing-branch-override', 'pricing.branch_override', 'Publicar precios por sucursal', true, NOW(), NOW()),
  ('cap-pricing-history-view', 'pricing.history.view', 'Consultar historial de precios', true, NOW(), NOW());

INSERT INTO "CapabilityGrant" ("id", "capabilityId", "role", "scope", "validFrom", "createdAt")
SELECT 'grant-admin-' || replace("key", '.', '-'), "id", 'ADMIN', 'GLOBAL', NOW(), NOW()
FROM "Capability" WHERE "key" IN ('pricing.view','pricing.create','pricing.edit_future','pricing.end','pricing.branch_override','pricing.history.view');
