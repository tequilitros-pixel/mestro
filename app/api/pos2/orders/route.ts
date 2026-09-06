import { NextResponse } from "next/server";
import { DomainError } from "@/lib/domain/errors";
import { getCurrentCommandActor } from "@/lib/pos2/currentActor";
import { pos2ErrorResponse, requireTerminalBranch, requireTerminalRequest } from "@/lib/pos2/http";
import { createOrder } from "@/lib/pos2/orders/manageOrders";
import { getOpenOrders } from "@/lib/pos2/orders/queries";

export async function GET(request: Request) {
  try { const actor = await getCurrentCommandActor(); const terminalId = await requireTerminalRequest(request); const p = new URL(request.url).searchParams; const branchId = p.get("branchId") ?? "", registerId = p.get("registerId") ?? undefined; if (!branchId) throw new DomainError("VALIDATION_ERROR", { field: "branchId" }); await requireTerminalBranch(terminalId, branchId, registerId); const orders = await getOpenOrders({ actor, branchId, registerId, userId: p.get("userId") ?? undefined, status: p.get("status") === "PAYMENT_PENDING" ? "PAYMENT_PENDING" : p.get("status") === "OPEN" ? "OPEN" : undefined }); return NextResponse.json({ orders }); } catch (error) { return pos2ErrorResponse(error); }
}

export async function POST(request: Request) {
  try { const actor = await getCurrentCommandActor(); const terminalId = await requireTerminalRequest(request); const body = await request.json(), branchId = String(body.branchId), registerId = String(body.registerId); await requireTerminalBranch(terminalId, branchId, registerId); const outcome = await createOrder({ actor, terminalId, operationId: String(body.operationId), branchId, registerId, cashSessionId: String(body.cashSessionId), expiresAt: body.expiresAt ? new Date(body.expiresAt) : null }); return NextResponse.json(outcome.result, { status: outcome.replayed ? 200 : 201 }); } catch (error) { return pos2ErrorResponse(error); }
}
