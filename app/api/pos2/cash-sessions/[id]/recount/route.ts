import { NextResponse } from "next/server";
import { recountCash } from "@/lib/pos2/cash/recountCash";
import { getCurrentCommandActor } from "@/lib/pos2/currentActor";
import { pos2ErrorResponse, requireTerminalRequest } from "@/lib/pos2/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const terminalId = await requireTerminalRequest(request);
    const actor = await getCurrentCommandActor();
    const body = await request.json();
    const { id } = await params;
    const outcome = await recountCash({ operationId: body.operationId, cashSessionId: id, terminalId, actor, declaredCash: String(body.declaredCash), reason: String(body.reason ?? "") });
    return NextResponse.json({ ...outcome.result, replayed: outcome.replayed }, { status: outcome.replayed ? 200 : 201 });
  } catch (error) { return pos2ErrorResponse(error); }
}
