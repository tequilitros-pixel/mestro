import { NextResponse } from "next/server";
import { DomainError } from "@/lib/domain/errors";
import { getCurrentCommandActor } from "@/lib/pos2/currentActor";
import { pos2ErrorResponse, requireOrderTerminal, requireTerminalRequest } from "@/lib/pos2/http";
import { completeSale } from "@/lib/pos2/sales/completeSale";
import { recordPos2OperationTrace, type Pos2OperationTrace } from "@/lib/pos2/operationTrace";
import { withRlsContext } from "@/lib/rls";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let actor: Awaited<ReturnType<typeof getCurrentCommandActor>> | undefined;
  let operationId: string | undefined;
  let trace: Pos2OperationTrace | undefined;

  try {
    actor = await getCurrentCommandActor();
    const body = await request.json();
    const { id } = await context.params;
    operationId = typeof body.operationId === "string" ? body.operationId : undefined;
    const orderContext = await withRlsContext(actor, (tx) => tx.pos2Order.findUnique({ where: { id }, select: { branchId: true, registerId: true, cashSessionId: true } }));
    trace = {
      actor,
      operationId,
      branchId: orderContext?.branchId,
      registerId: orderContext?.registerId,
      cashSessionId: typeof body.cashSessionId === "string" ? body.cashSessionId : orderContext?.cashSessionId,
      orderId: id,
      terminalId: request.headers.get("x-maestro-terminal-id") ?? undefined,
      correlationId: request.headers.get("x-request-id") ?? request.headers.get("x-vercel-id") ?? undefined,
    };
    await recordPos2OperationTrace({ ...trace, outcome: "ATTEMPTED" });

    const terminalId = await requireTerminalRequest(request);
    trace = { ...trace, terminalId };
    await requireOrderTerminal(terminalId, id);
    if (!Array.isArray(body.payments)) throw new DomainError("VALIDATION_ERROR", { field: "payments" });
    const outcome = await completeSale({
      orderId: id,
      expectedOrderVersion: Number(body.expectedOrderVersion),
      cashSessionId: String(body.cashSessionId),
      terminalId,
      operationId: String(body.operationId),
      actor,
      payments: body.payments.map((payment: Record<string, unknown>) => ({
        method: String(payment.method) as "CASH" | "CARD" | "TRANSFER",
        amount: String(payment.amount),
        ...(payment.cashTendered === undefined ? {} : { cashTendered: String(payment.cashTendered) }),
        ...(payment.reference === undefined ? {} : { reference: String(payment.reference) }),
      })),
    });
    const paymentIds = outcome.result.id
      ? await withRlsContext(actor, (tx) => tx.pos2Payment.findMany({ where: { saleId: String(outcome.result.id) }, select: { id: true }, orderBy: { position: "asc" } })).then((rows) => rows.map((row) => row.id)).catch(() => [])
      : [];
    await recordPos2OperationTrace({ ...trace, terminalId, saleId: String(outcome.result.id), paymentIds, outcome: "SUCCESS" });
    return NextResponse.json(outcome.result, { status: outcome.replayed ? 200 : 201 });
  } catch (error) {
    if (actor && trace) await recordPos2OperationTrace({ ...trace, outcome: "FAIL", error });
    return pos2ErrorResponse(error, operationId);
  }
}
