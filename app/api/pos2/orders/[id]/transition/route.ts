import { NextResponse } from "next/server";
import { DomainError } from "@/lib/domain/errors";
import { getCurrentCommandActor } from "@/lib/pos2/currentActor";
import { pos2ErrorResponse, requireOrderTerminal, requireTerminalRequest } from "@/lib/pos2/http";
import { beginPayment, expireOrder, repriceOrder, resumeOrder, voidOrder } from "@/lib/pos2/orders/manageOrders";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { try { const terminalId = await requireTerminalRequest(request); const actor = await getCurrentCommandActor(); const body = await request.json(); const { id } = await context.params; await requireOrderTerminal(terminalId, id); const common = { orderId: id, actor, operationId: String(body.operationId), expectedOrderVersion: Number(body.expectedOrderVersion) }; const outcome = body.action === "BEGIN_PAYMENT" ? await beginPayment(common) : body.action === "RESUME" ? await resumeOrder(common) : body.action === "VOID" ? await voidOrder({ ...common, reason: String(body.reason ?? "") }) : body.action === "EXPIRE" ? await expireOrder(common) : body.action === "REPRICE" ? await repriceOrder(common) : (() => { throw new DomainError("VALIDATION_ERROR", { field: "action" }); })(); return NextResponse.json(outcome.result); } catch (error) { return pos2ErrorResponse(error); } }
