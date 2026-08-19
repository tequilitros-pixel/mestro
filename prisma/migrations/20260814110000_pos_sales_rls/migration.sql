-- POS sales contain financial and employee-benefit information. Enforce the
-- same branch boundary in PostgreSQL that the application already applies.
ALTER TABLE "PosSale" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PosSale" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PosSaleItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PosSaleItem" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PosSalePayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PosSalePayment" FORCE ROW LEVEL SECURITY;

CREATE POLICY "pos_sale_branch_access" ON "PosSale"
  FOR ALL
  USING (
    COALESCE(current_setting('app.is_admin', true), 'false') = 'true'
    OR EXISTS (
      SELECT 1 FROM "UserBranch"
      WHERE "UserBranch"."userId" = current_setting('app.current_user_id', true)
        AND "UserBranch"."branchId" = "PosSale"."branchId"
    )
  )
  WITH CHECK (
    COALESCE(current_setting('app.is_admin', true), 'false') = 'true'
    OR EXISTS (
      SELECT 1 FROM "UserBranch"
      WHERE "UserBranch"."userId" = current_setting('app.current_user_id', true)
        AND "UserBranch"."branchId" = "PosSale"."branchId"
    )
  );

CREATE POLICY "pos_sale_item_parent_access" ON "PosSaleItem"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "PosSale" WHERE "PosSale"."id" = "PosSaleItem"."saleId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "PosSale" WHERE "PosSale"."id" = "PosSaleItem"."saleId"));

CREATE POLICY "pos_sale_payment_parent_access" ON "PosSalePayment"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "PosSale" WHERE "PosSale"."id" = "PosSalePayment"."saleId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "PosSale" WHERE "PosSale"."id" = "PosSalePayment"."saleId"));
