-- POS2 production verification: READ ONLY.
-- Run only through an operator-authorized production DB connection.
-- Never paste credentials or connection strings into this file or output.

BEGIN READ ONLY;

-- 1. Column and definition.
SELECT table_schema, table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'Pos2Order'
  AND column_name = 'reference';

-- 2. Required index and all indexes on Pos2Order.
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'Pos2Order'
ORDER BY indexname;

-- 3. Migration history, including failures and completion state.
SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count, logs
FROM public."_prisma_migrations"
ORDER BY started_at;

-- 4. Required branch predicate function.
SELECT n.nspname AS schema_name,
       p.oid::regprocedure AS signature,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.oid::regprocedure::text = 'pos2_branch_allowed(text)';

-- 5. RLS state and policies for POS2/audit/cash tables.
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       c.relrowsecurity AS row_security_enabled,
       c.relforcerowsecurity AS force_row_security
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'Pos2Order', 'Pos2OrderLine', 'Pos2Sale', 'Pos2Payment',
    'Pos2Refund', 'Pos2Return', 'RefundAllocation', 'PaymentReversal',
    'InventoryMovement', 'CashMovement', 'OperationReceipt', 'OutboxEvent'
  )
ORDER BY c.relname;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'Pos2Order', 'Pos2OrderLine', 'Pos2Sale', 'Pos2Payment',
    'Pos2Refund', 'Pos2Return', 'RefundAllocation', 'PaymentReversal',
    'InventoryMovement', 'CashMovement', 'OperationReceipt', 'OutboxEvent'
  )
ORDER BY tablename, policyname;

ROLLBACK;
