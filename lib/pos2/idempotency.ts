import "server-only";
import { Prisma, type OperationReceipt } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/domain/errors";
import { hashPayload } from "./payloadHash";
import { isUuidV7 } from "./operationId";

type ReceiptContext = {
  actorId?: string;
  branchId?: string;
  context?: Prisma.InputJsonValue;
};

type StableResult = Prisma.InputJsonObject;

export type IdempotentOutcome<T extends StableResult> = {
  result: T;
  replayed: boolean;
  receipt: OperationReceipt;
};

export async function executeIdempotent<T extends StableResult>(params: {
  operationId: string;
  command: string;
  payload: unknown;
  receiptContext?: ReceiptContext;
  execute: (tx: Prisma.TransactionClient) => Promise<T>;
}): Promise<IdempotentOutcome<T>> {
  if (!isUuidV7(params.operationId)) {
    throw new DomainError("VALIDATION_ERROR", { field: "operationId" });
  }
  const payloadHash = hashPayload(params.payload);

  return prisma.$transaction(async (tx) => {
    const inserted = await tx.$queryRaw<Array<{ operationId: string }>>`
      INSERT INTO "OperationReceipt" (
        "operationId", "command", "payloadHash", "status", "actorId",
        "branchId", "context", "createdAt", "updatedAt"
      ) VALUES (
        ${params.operationId}::uuid, ${params.command}, ${payloadHash},
        'IN_PROGRESS'::"OperationReceiptStatus", ${params.receiptContext?.actorId ?? null},
        ${params.receiptContext?.branchId ?? null},
        ${params.receiptContext?.context ? JSON.stringify(params.receiptContext.context) : null}::jsonb,
        NOW(), NOW()
      )
      ON CONFLICT ("operationId") DO NOTHING
      RETURNING "operationId"::text
    `;

    if (inserted.length === 0) {
      const rows = await tx.$queryRaw<OperationReceipt[]>`
        SELECT * FROM "OperationReceipt"
        WHERE "operationId" = ${params.operationId}::uuid
        FOR UPDATE
      `;
      const existing = rows[0];
      if (!existing || existing.command !== params.command || existing.payloadHash !== payloadHash) {
        throw new DomainError("IDEMPOTENCY_KEY_REUSED", { operationId: params.operationId });
      }
      if (existing.status !== "COMPLETED" || !existing.result) {
        throw new DomainError("CONFLICT", { operationId: params.operationId }, "La operación todavía está en proceso.");
      }
      return { result: existing.result as T, replayed: true, receipt: existing };
    }

    const result = await params.execute(tx);
    const receipt = await tx.operationReceipt.update({
      where: { operationId: params.operationId },
      data: {
        status: "COMPLETED",
        result,
        resultType: typeof result.type === "string" ? result.type : null,
        resultId: typeof result.id === "string" ? result.id : null,
        completedAt: new Date(),
      },
    });
    return { result, replayed: false, receipt };
  });
}
