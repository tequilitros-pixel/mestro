import { NextResponse } from "next/server";
import { DomainError } from "@/lib/domain/errors";
import { getCurrentCommandActor } from "@/lib/pos2/currentActor";
import { pos2ErrorResponse, requireOrderTerminal, requireTerminalRequest } from "@/lib/pos2/http";
import { completeSale } from "@/lib/pos2/sales/completeSale";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const terminalId = await requireTerminalRequest(request); const actor = await getCurrentCommandActor(); const body = await request.json(); const { id } = await context.params; await requireOrderTerminal(terminalId, id); if (!Array.isArray(body.payments)) throw new DomainError("VALIDATION_ERROR", { field: "payments" }); const outcome = await completeSale({ orderId: id, expectedOrderVersion: Number(body.expectedOrderVersion), cashSessionId: String(body.cashSessionId), terminalId, operationId: String(body.operationId), actor, payments: body.payments.map((payment: Record<string, unknown>) => ({ method: String(payment.method) as "CASH" | "CARD" | "TRANSFER", amount: String(payment.amount), ...(payment.cashTendered === undefined ? {} : { cashTendered: String(payment.cashTendered) }), ...(payment.reference === undefined ? {} : { reference: String(payment.reference) }) })) }); return NextResponse.json(outcome.result, { status: outcome.replayed ? 200 : 201 }); } catch (error) { return pos2ErrorResponse(error); }
}
