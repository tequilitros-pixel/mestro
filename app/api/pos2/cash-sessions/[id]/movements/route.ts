import { NextResponse } from "next/server";
import { createCashIn, createCashOut } from "@/lib/pos2/cash/createCashMovement";
import { getCurrentCommandActor } from "@/lib/pos2/currentActor";
import { pos2ErrorResponse, requireTerminalRequest } from "@/lib/pos2/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const terminalId = await requireTerminalRequest(request);
    const actor = await getCurrentCommandActor();
    const body = await request.json();
    const { id } = await params;
    const command = body.type === "CASH_IN" ? createCashIn : body.type === "CASH_OUT" ? createCashOut : null;
    if (!command) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Tipo de movimiento inválido." } }, { status: 422 });
    const outcome = await command({ operationId: body.operationId, cashSessionId: id, terminalId, actor, amount: String(body.amount), reason: String(body.reason ?? "") });
    return NextResponse.json({ ...outcome.result, replayed: outcome.replayed }, { status: outcome.replayed ? 200 : 201 });
  } catch (error) { return pos2ErrorResponse(error); }
}
