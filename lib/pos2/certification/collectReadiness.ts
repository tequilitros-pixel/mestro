import type { PrismaClient } from "@prisma/client";
import { evaluatePilotReadiness, type ReadinessInput } from "./readiness";

type CountRow = { count: bigint };
const count = (rows: CountRow[]) => Number(rows[0]?.count ?? 0);

export async function collectPilotReadiness(prisma: PrismaClient, options: { migrationDrift: boolean }) {
  const [staleReceipts, failedOutbox, processingOutbox, inventoryMismatches, paymentMismatches, orphanSales, duplicateOpenSessions] = await Promise.all([
    prisma.$queryRaw<CountRow[]>`SELECT COUNT(*)::bigint AS count FROM "OperationReceipt" WHERE "status" = 'IN_PROGRESS' AND "createdAt" < NOW() - INTERVAL '5 minutes'`,
    prisma.$queryRaw<CountRow[]>`SELECT COUNT(*)::bigint AS count FROM "OutboxEvent" WHERE "status" = 'FAILED'`,
    prisma.$queryRaw<CountRow[]>`SELECT COUNT(*)::bigint AS count FROM "OutboxEvent" WHERE "status" = 'PROCESSING' AND "createdAt" < NOW() - INTERVAL '5 minutes'`,
    prisma.$queryRaw<CountRow[]>`
      WITH ledger AS (
        SELECT "branchId", "inventoryProductId", COALESCE(SUM("quantityDelta"), 0) AS quantity
        FROM "InventoryMovement" GROUP BY "branchId", "inventoryProductId"
      )
      SELECT COUNT(*)::bigint AS count FROM "InventoryBalance" balance
      FULL OUTER JOIN ledger ON ledger."branchId" = balance."branchId" AND ledger."inventoryProductId" = balance."inventoryProductId"
      WHERE COALESCE(balance."quantity", 0) <> COALESCE(ledger.quantity, 0)`,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS count FROM (
        SELECT sale."id" FROM "Pos2Sale" sale
        LEFT JOIN "Pos2Payment" payment ON payment."saleId" = sale."id" AND payment."status" = 'CAPTURED'
        GROUP BY sale."id", sale."total" HAVING sale."total" <> COALESCE(SUM(payment."amount"), 0)
      ) mismatches`,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS count FROM "Pos2Sale" sale
      JOIN "Pos2Order" orders ON orders."id" = sale."orderId"
      WHERE orders."status" <> 'FINALIZED' OR orders."finalizedAt" IS NULL`,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS count FROM (
        SELECT "registerId" FROM "CashSession" WHERE "status" IN ('OPEN', 'CLOSING')
        GROUP BY "registerId" HAVING COUNT(*) > 1
      ) duplicates`,
  ]);
  const input: ReadinessInput = {
    migrationDrift: options.migrationDrift,
    staleInProgressReceipts: count(staleReceipts),
    failedOutboxEvents: count(failedOutbox),
    processingOutboxEvents: count(processingOutbox),
    inventoryMismatches: count(inventoryMismatches),
    paymentMismatches: count(paymentMismatches),
    orphanSales: count(orphanSales),
    openPilotRegisters: count(duplicateOpenSessions),
  };
  return { generatedAt: new Date().toISOString(), input, ...evaluatePilotReadiness(input) };
}
