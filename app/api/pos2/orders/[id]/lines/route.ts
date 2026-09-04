import { NextResponse } from "next/server";
import { getCurrentCommandActor } from "@/lib/pos2/currentActor";
import { pos2ErrorResponse, requireOrderTerminal, requireTerminalRequest } from "@/lib/pos2/http";
import { addOrderLine } from "@/lib/pos2/orders/manageOrders";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { try { const terminalId = await requireTerminalRequest(request); const actor = await getCurrentCommandActor(); const body = await request.json(); const { id } = await context.params; await requireOrderTerminal(terminalId, id); const target = body.variantId ? { variantId: String(body.variantId) } : { productId: String(body.productId) }; const outcome = await addOrderLine({ ...target, orderId: id, actor, operationId: String(body.operationId), quantity: String(body.quantity), expectedOrderVersion: Number(body.expectedOrderVersion) }); return NextResponse.json(outcome.result); } catch (error) { return pos2ErrorResponse(error); } }
