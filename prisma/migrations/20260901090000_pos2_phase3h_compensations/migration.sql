-- POS 2.0 Phase 3H: immutable cancellation, return and refund documents.
ALTER TYPE "InventoryMovementSourceType" ADD VALUE 'CANCELLATION';
ALTER TYPE "CashMovementType" ADD VALUE 'SALE_CANCEL_REVERSAL';
CREATE TYPE "SaleCancellationReasonCode" AS ENUM ('WRONG_ORDER','DUPLICATE','OPERATOR_ERROR','CUSTOMER_REQUEST','OTHER');
CREATE TYPE "ReturnReasonCode" AS ENUM ('DEFECTIVE','WRONG_ITEM','CUSTOMER_RETURN','OTHER');
CREATE TYPE "RefundReasonCode" AS ENUM ('RETURN','SERVICE_RECOVERY','PRICE_CORRECTION','OTHER');
CREATE TYPE "InventoryDisposition" AS ENUM ('RESTOCK','DAMAGED','DISCARD');

CREATE TABLE "SaleCancellation" (
 "id" TEXT PRIMARY KEY, "saleId" TEXT NOT NULL, "reasonCode" "SaleCancellationReasonCode" NOT NULL, "reasonText" TEXT,
 "actorId" TEXT NOT NULL, "terminalId" TEXT NOT NULL, "cashSessionId" TEXT, "operationId" UUID NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "PaymentReversal" (
 "id" TEXT PRIMARY KEY, "cancellationId" TEXT NOT NULL, "paymentId" TEXT NOT NULL, "method" "Pos2PaymentMethod" NOT NULL,
 "amount" DECIMAL(18,2) NOT NULL, "currency" TEXT NOT NULL DEFAULT 'MXN', "reference" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PaymentReversal_amount_positive" CHECK ("amount">0), CONSTRAINT "PaymentReversal_currency_mxn" CHECK ("currency"='MXN')
);
CREATE TABLE "Pos2Return" (
 "id" TEXT PRIMARY KEY, "saleId" TEXT NOT NULL, "reasonCode" "ReturnReasonCode" NOT NULL, "reasonText" TEXT,
 "actorId" TEXT NOT NULL, "terminalId" TEXT NOT NULL, "operationId" UUID NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "ReturnLine" (
 "id" TEXT PRIMARY KEY, "returnId" TEXT NOT NULL, "saleLineId" TEXT NOT NULL, "quantity" DECIMAL(18,6) NOT NULL,
 "unit" "CatalogBaseUnit" NOT NULL, "disposition" "InventoryDisposition" NOT NULL, "reasonText" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ReturnLine_quantity_positive" CHECK ("quantity">0)
);
CREATE TABLE "Pos2Refund" (
 "id" TEXT PRIMARY KEY, "saleId" TEXT NOT NULL, "amount" DECIMAL(18,2) NOT NULL, "currency" TEXT NOT NULL DEFAULT 'MXN',
 "reasonCode" "RefundReasonCode" NOT NULL, "reasonText" TEXT, "actorId" TEXT NOT NULL, "terminalId" TEXT NOT NULL,
 "cashSessionId" TEXT, "operationId" UUID NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Pos2Refund_amount_positive" CHECK ("amount">0), CONSTRAINT "Pos2Refund_currency_mxn" CHECK ("currency"='MXN')
);
CREATE TABLE "RefundAllocation" (
 "id" TEXT PRIMARY KEY, "refundId" TEXT NOT NULL, "paymentId" TEXT NOT NULL, "method" "Pos2PaymentMethod" NOT NULL,
 "amount" DECIMAL(18,2) NOT NULL, "currency" TEXT NOT NULL DEFAULT 'MXN', "reference" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "RefundAllocation_amount_positive" CHECK ("amount">0), CONSTRAINT "RefundAllocation_currency_mxn" CHECK ("currency"='MXN')
);
CREATE UNIQUE INDEX "SaleCancellation_saleId_key" ON "SaleCancellation"("saleId");
CREATE UNIQUE INDEX "SaleCancellation_operationId_key" ON "SaleCancellation"("operationId");
CREATE INDEX "SaleCancellation_createdAt_idx" ON "SaleCancellation"("createdAt");
CREATE UNIQUE INDEX "PaymentReversal_paymentId_key" ON "PaymentReversal"("paymentId");
CREATE INDEX "PaymentReversal_cancellationId_idx" ON "PaymentReversal"("cancellationId");
CREATE UNIQUE INDEX "Pos2Return_operationId_key" ON "Pos2Return"("operationId");
CREATE INDEX "Pos2Return_saleId_createdAt_idx" ON "Pos2Return"("saleId","createdAt");
CREATE UNIQUE INDEX "ReturnLine_returnId_saleLineId_key" ON "ReturnLine"("returnId","saleLineId");
CREATE INDEX "ReturnLine_saleLineId_idx" ON "ReturnLine"("saleLineId");
CREATE UNIQUE INDEX "Pos2Refund_operationId_key" ON "Pos2Refund"("operationId");
CREATE INDEX "Pos2Refund_saleId_createdAt_idx" ON "Pos2Refund"("saleId","createdAt");
CREATE UNIQUE INDEX "RefundAllocation_refundId_paymentId_key" ON "RefundAllocation"("refundId","paymentId");
CREATE INDEX "RefundAllocation_paymentId_idx" ON "RefundAllocation"("paymentId");
ALTER TABLE "SaleCancellation" ADD FOREIGN KEY ("saleId") REFERENCES "Pos2Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleCancellation" ADD FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleCancellation" ADD FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleCancellation" ADD FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentReversal" ADD FOREIGN KEY ("cancellationId") REFERENCES "SaleCancellation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentReversal" ADD FOREIGN KEY ("paymentId") REFERENCES "Pos2Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pos2Return" ADD FOREIGN KEY ("saleId") REFERENCES "Pos2Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pos2Return" ADD FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pos2Return" ADD FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnLine" ADD FOREIGN KEY ("returnId") REFERENCES "Pos2Return"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnLine" ADD FOREIGN KEY ("saleLineId") REFERENCES "Pos2SaleLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pos2Refund" ADD FOREIGN KEY ("saleId") REFERENCES "Pos2Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pos2Refund" ADD FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pos2Refund" ADD FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pos2Refund" ADD FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundAllocation" ADD FOREIGN KEY ("refundId") REFERENCES "Pos2Refund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundAllocation" ADD FOREIGN KEY ("paymentId") REFERENCES "Pos2Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TRIGGER "Pos2Sale_immutable" ON "Pos2Sale";
CREATE FUNCTION pos2_sale_projection_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'POS2_FINANCIAL_FACT_IS_IMMUTABLE' USING ERRCODE='55000'; END IF;
 IF (to_jsonb(NEW)-'status')<>(to_jsonb(OLD)-'status') THEN RAISE EXCEPTION 'POS2_FINANCIAL_FACT_IS_IMMUTABLE' USING ERRCODE='55000'; END IF;
 IF OLD."status"='COMPLETED' AND NEW."status"='CANCELLED' AND EXISTS(SELECT 1 FROM "SaleCancellation" WHERE "saleId"=OLD."id") THEN RETURN NEW; END IF;
 IF OLD."status" IN ('COMPLETED','PARTIALLY_RETURNED') AND NEW."status" IN ('PARTIALLY_RETURNED','RETURNED') AND EXISTS(SELECT 1 FROM "Pos2Return" WHERE "saleId"=OLD."id") THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'INVALID_POS2_SALE_STATUS_TRANSITION' USING ERRCODE='55000';
END $$;
CREATE TRIGGER "Pos2Sale_projection_guard" BEFORE UPDATE OR DELETE ON "Pos2Sale" FOR EACH ROW EXECUTE FUNCTION pos2_sale_projection_guard();

CREATE FUNCTION pos2_reject_compensation_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'POS2_COMPENSATION_IS_APPEND_ONLY' USING ERRCODE='55000'; END $$;
CREATE TRIGGER "SaleCancellation_immutable" BEFORE UPDATE OR DELETE ON "SaleCancellation" FOR EACH ROW EXECUTE FUNCTION pos2_reject_compensation_mutation();
CREATE TRIGGER "PaymentReversal_immutable" BEFORE UPDATE OR DELETE ON "PaymentReversal" FOR EACH ROW EXECUTE FUNCTION pos2_reject_compensation_mutation();
CREATE TRIGGER "Pos2Return_immutable" BEFORE UPDATE OR DELETE ON "Pos2Return" FOR EACH ROW EXECUTE FUNCTION pos2_reject_compensation_mutation();
CREATE TRIGGER "ReturnLine_immutable" BEFORE UPDATE OR DELETE ON "ReturnLine" FOR EACH ROW EXECUTE FUNCTION pos2_reject_compensation_mutation();
CREATE TRIGGER "Pos2Refund_immutable" BEFORE UPDATE OR DELETE ON "Pos2Refund" FOR EACH ROW EXECUTE FUNCTION pos2_reject_compensation_mutation();
CREATE TRIGGER "RefundAllocation_immutable" BEFORE UPDATE OR DELETE ON "RefundAllocation" FOR EACH ROW EXECUTE FUNCTION pos2_reject_compensation_mutation();

INSERT INTO "Capability" ("id","key","description","active","createdAt","updatedAt") VALUES
 ('cap-pos-refund-cash','pos.refund.cash','Refund efectivo V2',true,NOW(),NOW()),
 ('cap-pos-refund-card','pos.refund.card','Refund tarjeta V2',true,NOW(),NOW()),
 ('cap-pos-refund-transfer','pos.refund.transfer','Refund transferencia V2',true,NOW(),NOW()),
 ('cap-pos-return-restock','pos.return.restock','Reintegrar devolución a inventario V2',true,NOW(),NOW());
INSERT INTO "CapabilityGrant" ("id","capabilityId","role","scope","validFrom","createdAt")
SELECT 'grant-admin-'||replace("key",'.','-'),"id",'ADMIN','GLOBAL',NOW(),NOW() FROM "Capability"
WHERE "key" IN ('pos.refund.cash','pos.refund.card','pos.refund.transfer','pos.return.restock');
INSERT INTO "CapabilityGrant" ("id","capabilityId","role","scope","validFrom","createdAt")
SELECT 'grant-admin-'||replace("key",'.','-'),"id",'ADMIN','GLOBAL',NOW(),NOW() FROM "Capability"
WHERE "key" IN ('pos.sale.cancel','pos.return.create','pos.refund.create')
AND NOT EXISTS (SELECT 1 FROM "CapabilityGrant" g WHERE g."capabilityId"="Capability"."id" AND g."role"='ADMIN' AND g."scope"='GLOBAL');
