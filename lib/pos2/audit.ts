import "server-only";
import { Prisma } from "@prisma/client";
import { sanitizeAuditMetadata } from "./auditMetadata";
export { sanitizeAuditMetadata } from "./auditMetadata";

export async function appendAuditEvent(
  tx: Prisma.TransactionClient,
  event: {
    actorId?: string;
    branchId?: string;
    terminalId?: string;
    action: string;
    entityType: string;
    entityId: string;
    operationId?: string;
    correlationId?: string;
    metadata?: Record<string, unknown>;
  },
) {
  return tx.auditEvent.create({
    data: { ...event, metadata: sanitizeAuditMetadata(event.metadata) },
  });
}
