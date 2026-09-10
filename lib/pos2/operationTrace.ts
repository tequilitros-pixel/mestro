import "server-only";
import { withRlsContext } from "@/lib/rls";
import { appendAuditEvent } from "./audit";
import { isUuidV7 } from "./operationId";

type TraceActor = { id: string; role: string };

export type Pos2OperationTrace = {
  actor: TraceActor;
  operation?: string;
  operationId?: string;
  branchId?: string;
  terminalId?: string;
  registerId?: string;
  cashSessionId?: string;
  orderId?: string;
  saleId?: string;
  paymentIds?: string[];
  correlationId?: string;
};

function databaseOperationId(operationId?: string) {
  return operationId && isUuidV7(operationId) ? operationId : undefined;
}

function safeTechnicalMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted-url]")
    .replace(/(password|secret|token)=\S+/gi, "$1=[redacted]")
    .slice(0, 240);
}

export function pos2ErrorDetails(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    const code = String(error.code);
    if (code && code !== "undefined") return { errorCode: code, technicalMessage: safeTechnicalMessage(error) };
  }
  return { errorCode: "INTERNAL_ERROR", technicalMessage: safeTechnicalMessage(error) };
}

export async function recordPos2OperationTrace(input: Pos2OperationTrace & {
  outcome: "ATTEMPTED" | "SUCCESS" | "FAIL";
  error?: unknown;
}) {
  const operationId = databaseOperationId(input.operationId);
  const details = input.error ? pos2ErrorDetails(input.error) : undefined;

  try {
    await withRlsContext(input.actor, (tx) => appendAuditEvent(tx, {
      actorId: input.actor.id,
      branchId: input.branchId,
      terminalId: input.terminalId,
      action: `POS2_OPERATION_${input.outcome}`,
      entityType: "Pos2Operation",
      entityId: input.operationId || "unknown",
      operationId,
      correlationId: input.correlationId,
      metadata: {
        status: input.outcome === "FAIL" ? "FAIL" : input.outcome === "SUCCESS" ? "SUCCESS" : "IN_PROGRESS",
        operation: input.operation ?? null,
        clientOperationId: input.operationId ?? null,
        userId: input.actor.id,
        branchId: input.branchId ?? null,
        terminalId: input.terminalId ?? null,
        registerId: input.registerId ?? null,
        cashSessionId: input.cashSessionId ?? null,
        orderId: input.orderId ?? null,
        saleId: input.saleId ?? null,
        paymentIds: input.paymentIds ?? [],
        ...(details ?? {}),
      },
    }));
  } catch (traceError) {
    console.error("POS2 operation trace failed", traceError);
  }
}
