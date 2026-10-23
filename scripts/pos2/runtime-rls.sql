-- Apply with the administrative DIRECT connection, never the runtime role.
-- Transactional, repeatable POS2 branch isolation; preserves all business records.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE OR REPLACE FUNCTION public.pos2_branch_allowed(target_branch text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog, public AS $$
 SELECT EXISTS (
   SELECT 1 FROM public."User" u
   WHERE u.id = current_setting('app.current_user_id', true) AND u.active
   AND ((u.role = 'ADMIN' AND current_setting('app.is_admin', true) = 'true')
     OR EXISTS (SELECT 1 FROM public."UserBranch" ub
       WHERE ub."userId" = u.id AND ub."branchId" = target_branch))
 );
$$;
REVOKE ALL ON FUNCTION public.pos2_branch_allowed(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos2_branch_allowed(text) TO maestro_runtime;
GRANT USAGE ON SCHEMA public TO maestro_runtime;

ALTER TABLE public."Register" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Register" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos2_branch_isolation ON public."Register";
CREATE POLICY pos2_branch_isolation ON public."Register" TO maestro_runtime
 USING (public.pos2_branch_allowed("branchId")) WITH CHECK (public.pos2_branch_allowed("branchId"));
REVOKE ALL ON public."Register" FROM maestro_runtime;
GRANT SELECT, INSERT, UPDATE ON public."Register" TO maestro_runtime;

ALTER TABLE public."Terminal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Terminal" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos2_branch_isolation ON public."Terminal";
CREATE POLICY pos2_branch_isolation ON public."Terminal" TO maestro_runtime
 USING (public.pos2_branch_allowed("branchId")) WITH CHECK (public.pos2_branch_allowed("branchId"));
REVOKE ALL ON public."Terminal" FROM maestro_runtime;
GRANT SELECT, INSERT, UPDATE ON public."Terminal" TO maestro_runtime;

ALTER TABLE public."CashSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CashSession" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos2_branch_isolation ON public."CashSession";
CREATE POLICY pos2_branch_isolation ON public."CashSession" TO maestro_runtime
 USING (public.pos2_branch_allowed("branchId")) WITH CHECK (public.pos2_branch_allowed("branchId"));
REVOKE ALL ON public."CashSession" FROM maestro_runtime;
GRANT SELECT, INSERT, UPDATE ON public."CashSession" TO maestro_runtime;

ALTER TABLE public."CashMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CashMovement" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos2_branch_isolation ON public."CashMovement";
CREATE POLICY pos2_branch_isolation ON public."CashMovement" TO maestro_runtime
 USING (public.pos2_branch_allowed("branchId")) WITH CHECK (public.pos2_branch_allowed("branchId"));
REVOKE ALL ON public."CashMovement" FROM maestro_runtime;
GRANT SELECT, INSERT ON public."CashMovement" TO maestro_runtime;

ALTER TABLE public."Pos2Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Pos2Order" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos2_branch_isolation ON public."Pos2Order";
CREATE POLICY pos2_branch_isolation ON public."Pos2Order" TO maestro_runtime
 USING (public.pos2_branch_allowed("branchId")) WITH CHECK (public.pos2_branch_allowed("branchId"));
REVOKE ALL ON public."Pos2Order" FROM maestro_runtime;
GRANT SELECT, INSERT, UPDATE ON public."Pos2Order" TO maestro_runtime;

ALTER TABLE public."Pos2Sale" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Pos2Sale" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos2_branch_isolation ON public."Pos2Sale";
CREATE POLICY pos2_branch_isolation ON public."Pos2Sale" TO maestro_runtime
 USING (public.pos2_branch_allowed("branchId")) WITH CHECK (public.pos2_branch_allowed("branchId"));
REVOKE ALL ON public."Pos2Sale" FROM maestro_runtime;
GRANT SELECT, INSERT, UPDATE ON public."Pos2Sale" TO maestro_runtime;

ALTER TABLE public."Pos2Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Pos2Payment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos2_branch_isolation ON public."Pos2Payment";
CREATE POLICY pos2_branch_isolation ON public."Pos2Payment" TO maestro_runtime
 USING (public.pos2_branch_allowed("branchId")) WITH CHECK (public.pos2_branch_allowed("branchId"));
REVOKE ALL ON public."Pos2Payment" FROM maestro_runtime;
GRANT SELECT, INSERT, UPDATE ON public."Pos2Payment" TO maestro_runtime;

ALTER TABLE public."InventoryBalance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."InventoryBalance" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos2_branch_isolation ON public."InventoryBalance";
CREATE POLICY pos2_branch_isolation ON public."InventoryBalance" TO maestro_runtime
 USING (public.pos2_branch_allowed("branchId")) WITH CHECK (public.pos2_branch_allowed("branchId"));
REVOKE ALL ON public."InventoryBalance" FROM maestro_runtime;
GRANT SELECT, INSERT, UPDATE ON public."InventoryBalance" TO maestro_runtime;

ALTER TABLE public."InventoryMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."InventoryMovement" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos2_branch_isolation ON public."InventoryMovement";
CREATE POLICY pos2_branch_isolation ON public."InventoryMovement" TO maestro_runtime
 USING (public.pos2_branch_allowed("branchId")) WITH CHECK (public.pos2_branch_allowed("branchId"));
REVOKE ALL ON public."InventoryMovement" FROM maestro_runtime;
GRANT SELECT, INSERT ON public."InventoryMovement" TO maestro_runtime;

ALTER TABLE public."InventoryCountDeclaration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."InventoryCountDeclaration" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos2_branch_isolation ON public."InventoryCountDeclaration";
CREATE POLICY pos2_branch_isolation ON public."InventoryCountDeclaration" TO maestro_runtime
 USING (public.pos2_branch_allowed("branchId")) WITH CHECK (public.pos2_branch_allowed("branchId"));
REVOKE ALL ON public."InventoryCountDeclaration" FROM maestro_runtime;
GRANT SELECT, INSERT ON public."InventoryCountDeclaration" TO maestro_runtime;

ALTER TABLE public."TerminalEnrollment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TerminalEnrollment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos2_branch_isolation ON public."TerminalEnrollment";
CREATE POLICY pos2_branch_isolation ON public."TerminalEnrollment" TO maestro_runtime
 USING (EXISTS (SELECT 1 FROM public."Terminal" parent WHERE parent.id = "TerminalEnrollment"."terminalId")) WITH CHECK (EXISTS (SELECT 1 FROM public."Terminal" parent WHERE parent.id = "TerminalEnrollment"."terminalId"));
REVOKE ALL ON public."TerminalEnrollment" FROM maestro_runtime;
GRANT SELECT, INSERT, UPDATE ON public."TerminalEnrollment" TO maestro_runtime;

ALTER TABLE public."CashDeclaration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CashDeclaration" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos2_branch_isolation ON public."CashDeclaration";
CREATE POLICY pos2_branch_isolation ON public."CashDeclaration" TO maestro_runtime
 USING (EXISTS (SELECT 1 FROM public."CashSession" parent WHERE parent.id = "CashDeclaration"."cashSessionId")) WITH CHECK (EXISTS (SELECT 1 FROM public."CashSession" parent WHERE parent.id = "CashDeclaration"."cashSessionId"));
REVOKE ALL ON public."CashDeclaration" FROM maestro_runtime;
GRANT SELECT, INSERT ON public."CashDeclaration" TO maestro_runtime;

ALTER TABLE public."Pos2OrderLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Pos2OrderLine" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos2_branch_isolation ON public."Pos2OrderLine";
CREATE POLICY pos2_branch_isolation ON public."Pos2OrderLine" TO maestro_runtime
 USING (EXISTS (SELECT 1 FROM public."Pos2Order" parent WHERE parent.id = "Pos2OrderLine"."orderId")) WITH CHECK (EXISTS (SELECT 1 FROM public."Pos2Order" parent WHERE parent.id = "Pos2OrderLine"."orderId"));
REVOKE ALL ON public."Pos2OrderLine" FROM maestro_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."Pos2OrderLine" TO maestro_runtime;

ALTER TABLE public."OrderAdjustment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OrderAdjustment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos2_branch_isolation ON public."OrderAdjustment";
CREATE POLICY pos2_branch_isolation ON public."OrderAdjustment" TO maestro_runtime
 USING (EXISTS (SELECT 1 FROM public."Pos2Order" parent WHERE parent.id = "OrderAdjustment"."orderId")) WITH CHECK (EXISTS (SELECT 1 FROM public."Pos2Order" parent WHERE parent.id = "OrderAdjustment"."orderId"));
REVOKE ALL ON public."OrderAdjustment" FROM maestro_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."OrderAdjustment" TO maestro_runtime;

ALTER TABLE public."Pos2SaleLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Pos2SaleLine" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos2_branch_isolation ON public."Pos2SaleLine";
CREATE POLICY pos2_branch_isolation ON public."Pos2SaleLine" TO maestro_runtime
 USING (EXISTS (SELECT 1 FROM public."Pos2Sale" parent WHERE parent.id = "Pos2SaleLine"."saleId")) WITH CHECK (EXISTS (SELECT 1 FROM public."Pos2Sale" parent WHERE parent.id = "Pos2SaleLine"."saleId"));
REVOKE ALL ON public."Pos2SaleLine" FROM maestro_runtime;
GRANT SELECT, INSERT ON public."Pos2SaleLine" TO maestro_runtime;

ALTER TABLE public."SaleAdjustment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SaleAdjustment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos2_branch_isolation ON public."SaleAdjustment";
CREATE POLICY pos2_branch_isolation ON public."SaleAdjustment" TO maestro_runtime
 USING (EXISTS (SELECT 1 FROM public."Pos2Sale" parent WHERE parent.id = "SaleAdjustment"."saleId")) WITH CHECK (EXISTS (SELECT 1 FROM public."Pos2Sale" parent WHERE parent.id = "SaleAdjustment"."saleId"));
REVOKE ALL ON public."SaleAdjustment" FROM maestro_runtime;
GRANT SELECT, INSERT ON public."SaleAdjustment" TO maestro_runtime;

ALTER TABLE public."SaleCancellation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SaleCancellation" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos2_branch_isolation ON public."SaleCancellation";
CREATE POLICY pos2_branch_isolation ON public."SaleCancellation" TO maestro_runtime
 USING (EXISTS (SELECT 1 FROM public."Pos2Sale" parent WHERE parent.id = "SaleCancellation"."saleId")) WITH CHECK (EXISTS (SELECT 1 FROM public."Pos2Sale" parent WHERE parent.id = "SaleCancellation"."saleId"));
REVOKE ALL ON public."SaleCancellation" FROM maestro_runtime;
GRANT SELECT, INSERT ON public."SaleCancellation" TO maestro_runtime;

ALTER TABLE public."Pos2Return" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Pos2Return" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos2_branch_isolation ON public."Pos2Return";
CREATE POLICY pos2_branch_isolation ON public."Pos2Return" TO maestro_runtime
 USING (EXISTS (SELECT 1 FROM public."Pos2Sale" parent WHERE parent.id = "Pos2Return"."saleId")) WITH CHECK (EXISTS (SELECT 1 FROM public."Pos2Sale" parent WHERE parent.id = "Pos2Return"."saleId"));
REVOKE ALL ON public."Pos2Return" FROM maestro_runtime;
GRANT SELECT, INSERT ON public."Pos2Return" TO maestro_runtime;

ALTER TABLE public."Pos2Refund" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Pos2Refund" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos2_branch_isolation ON public."Pos2Refund";
CREATE POLICY pos2_branch_isolation ON public."Pos2Refund" TO maestro_runtime
 USING (EXISTS (SELECT 1 FROM public."Pos2Sale" parent WHERE parent.id = "Pos2Refund"."saleId")) WITH CHECK (EXISTS (SELECT 1 FROM public."Pos2Sale" parent WHERE parent.id = "Pos2Refund"."saleId"));
REVOKE ALL ON public."Pos2Refund" FROM maestro_runtime;
GRANT SELECT, INSERT ON public."Pos2Refund" TO maestro_runtime;

ALTER TABLE public."PaymentReversal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PaymentReversal" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos2_branch_isolation ON public."PaymentReversal";
CREATE POLICY pos2_branch_isolation ON public."PaymentReversal" TO maestro_runtime
 USING (EXISTS (SELECT 1 FROM public."Pos2Payment" parent WHERE parent.id = "PaymentReversal"."paymentId")) WITH CHECK (EXISTS (SELECT 1 FROM public."Pos2Payment" parent WHERE parent.id = "PaymentReversal"."paymentId"));
REVOKE ALL ON public."PaymentReversal" FROM maestro_runtime;
GRANT SELECT, INSERT ON public."PaymentReversal" TO maestro_runtime;

ALTER TABLE public."RefundAllocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RefundAllocation" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos2_branch_isolation ON public."RefundAllocation";
CREATE POLICY pos2_branch_isolation ON public."RefundAllocation" TO maestro_runtime
 USING (EXISTS (SELECT 1 FROM public."Pos2Payment" parent WHERE parent.id = "RefundAllocation"."paymentId")) WITH CHECK (EXISTS (SELECT 1 FROM public."Pos2Payment" parent WHERE parent.id = "RefundAllocation"."paymentId"));
REVOKE ALL ON public."RefundAllocation" FROM maestro_runtime;
GRANT SELECT, INSERT ON public."RefundAllocation" TO maestro_runtime;

ALTER TABLE public."ReturnLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ReturnLine" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos2_branch_isolation ON public."ReturnLine";
CREATE POLICY pos2_branch_isolation ON public."ReturnLine" TO maestro_runtime
 USING (EXISTS (SELECT 1 FROM public."Pos2Return" parent WHERE parent.id = "ReturnLine"."returnId")) WITH CHECK (EXISTS (SELECT 1 FROM public."Pos2Return" parent WHERE parent.id = "ReturnLine"."returnId"));
REVOKE ALL ON public."ReturnLine" FROM maestro_runtime;
GRANT SELECT, INSERT ON public."ReturnLine" TO maestro_runtime;

ALTER TABLE public."OperationReceipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OperationReceipt" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos2_branch_isolation ON public."OperationReceipt";
CREATE POLICY pos2_branch_isolation ON public."OperationReceipt" TO maestro_runtime
 USING (public.pos2_branch_allowed("branchId") OR ("branchId" IS NULL AND "actorId" = current_setting('app.current_user_id', true) AND EXISTS (SELECT 1 FROM public."User" u WHERE u.id = "actorId" AND u.active))) WITH CHECK (public.pos2_branch_allowed("branchId") OR ("branchId" IS NULL AND "actorId" = current_setting('app.current_user_id', true) AND EXISTS (SELECT 1 FROM public."User" u WHERE u.id = "actorId" AND u.active)));
REVOKE ALL ON public."OperationReceipt" FROM maestro_runtime;
GRANT SELECT, INSERT, UPDATE ON public."OperationReceipt" TO maestro_runtime;

ALTER TABLE public."AuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuditEvent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos2_branch_isolation ON public."AuditEvent";
CREATE POLICY pos2_branch_isolation ON public."AuditEvent" TO maestro_runtime
 USING (public.pos2_branch_allowed("branchId") OR ("branchId" IS NULL AND "actorId" = current_setting('app.current_user_id', true) AND EXISTS (SELECT 1 FROM public."User" u WHERE u.id = "actorId" AND u.active))) WITH CHECK (public.pos2_branch_allowed("branchId") OR ("branchId" IS NULL AND "actorId" = current_setting('app.current_user_id', true) AND EXISTS (SELECT 1 FROM public."User" u WHERE u.id = "actorId" AND u.active)));
REVOKE ALL ON public."AuditEvent" FROM maestro_runtime;
GRANT SELECT, INSERT ON public."AuditEvent" TO maestro_runtime;

ALTER TABLE public."OutboxEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OutboxEvent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos2_branch_isolation ON public."OutboxEvent";
CREATE POLICY pos2_branch_isolation ON public."OutboxEvent" TO maestro_runtime
 USING (EXISTS (SELECT 1 FROM public."OperationReceipt" r WHERE r."operationId" = "OutboxEvent"."operationId" AND public.pos2_branch_allowed(r."branchId"))
 OR ("aggregate" = 'CashSession' AND EXISTS (SELECT 1 FROM public."CashSession" s WHERE s.id = "aggregateId"))
 OR ("aggregate" = 'Pos2Sale' AND EXISTS (SELECT 1 FROM public."Pos2Sale" s WHERE s.id = "aggregateId"))) WITH CHECK (EXISTS (SELECT 1 FROM public."OperationReceipt" r WHERE r."operationId" = "OutboxEvent"."operationId" AND public.pos2_branch_allowed(r."branchId"))
 OR ("aggregate" = 'CashSession' AND EXISTS (SELECT 1 FROM public."CashSession" s WHERE s.id = "aggregateId"))
 OR ("aggregate" = 'Pos2Sale' AND EXISTS (SELECT 1 FROM public."Pos2Sale" s WHERE s.id = "aggregateId")));
REVOKE ALL ON public."OutboxEvent" FROM maestro_runtime;
GRANT SELECT, INSERT, UPDATE ON public."OutboxEvent" TO maestro_runtime;

COMMIT;
