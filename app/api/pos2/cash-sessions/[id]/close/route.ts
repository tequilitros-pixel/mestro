import { NextResponse } from "next/server";
import { closeCashSession } from "@/lib/pos2/cash/closeCashSession";
import { getCurrentCommandActor } from "@/lib/pos2/currentActor";
import { pos2ErrorResponse, requireTerminalRequest } from "@/lib/pos2/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const terminalId = await requireTerminalRequest(request);
    const actor = await getCurrentCommandActor();
    const body = await request.json();
    const { id } = await params;
    const outcome = await closeCashSession({ operationId: body.operationId, cashSessionId: id, terminalId, actor, declaredCash: String(body.declaredCash), envelopeAmount: body.envelopeAmount === undefined ? undefined : String(body.envelopeAmount) });
    return NextResponse.json({ ...outcome.result, replayed: outcome.replayed });
  } catch (error) { return pos2ErrorResponse(error); }
}
