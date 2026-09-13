-- Keep legacy POS outbox writes scoped to the sale's real branch.
DROP POLICY IF EXISTS "pos2_branch_isolation" ON "OutboxEvent";

CREATE POLICY "pos2_branch_isolation" ON "OutboxEvent"
  USING (
    EXISTS (
      SELECT 1
      FROM "OperationReceipt" r
      WHERE r."operationId" = "OutboxEvent"."operationId"
        AND pos2_branch_allowed(r."branchId")
    )
    OR (
      "aggregate" = 'CashSession'
      AND EXISTS (
        SELECT 1
        FROM "CashSession" s
        WHERE s.id = "OutboxEvent"."aggregateId"
      )
    )
    OR (
      "aggregate" = 'Pos2Sale'
      AND EXISTS (
        SELECT 1
        FROM "Pos2Sale" s
        WHERE s.id = "OutboxEvent"."aggregateId"
      )
    )
    OR (
      "aggregate" = 'PosSale'
      AND EXISTS (
        SELECT 1
        FROM "PosSale" s
        WHERE s.id = "OutboxEvent"."aggregateId"
          AND s."branchId" = ("OutboxEvent"."payload"->>'branchId')
          AND pos2_branch_allowed(s."branchId")
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "OperationReceipt" r
      WHERE r."operationId" = "OutboxEvent"."operationId"
        AND pos2_branch_allowed(r."branchId")
    )
    OR (
      "aggregate" = 'CashSession'
      AND EXISTS (
        SELECT 1
        FROM "CashSession" s
        WHERE s.id = "OutboxEvent"."aggregateId"
      )
    )
    OR (
      "aggregate" = 'Pos2Sale'
      AND EXISTS (
        SELECT 1
        FROM "Pos2Sale" s
        WHERE s.id = "OutboxEvent"."aggregateId"
      )
    )
    OR (
      "aggregate" = 'PosSale'
      AND EXISTS (
        SELECT 1
        FROM "PosSale" s
        WHERE s.id = "OutboxEvent"."aggregateId"
          AND s."branchId" = ("OutboxEvent"."payload"->>'branchId')
          AND pos2_branch_allowed(s."branchId")
      )
    )
  );
