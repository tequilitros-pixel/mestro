import { NextResponse } from "next/server";
import { openCashSession } from "@/lib/pos2/cash/openCashSession";
import { getCurrentCommandActor } from "@/lib/pos2/currentActor";
import { pos2ErrorResponse, requireTerminalBranch, requireTerminalRequest } from "@/lib/pos2/http";

export async function POST(request: Request) {
  try {
    const terminalId = await requireTerminalRequest(request);
    const actor = await getCurrentCommandActor();
    const body = await request.json();
    await requireTerminalBranch(terminalId, String(body.branchId), String(body.registerId));
    const outcome = await openCashSession({ operationId: body.operationId, branchId: body.branchId, registerId: body.registerId, terminalId, actor, openingCash: String(body.openingCash) });
    return NextResponse.json({ ...outcome.result, replayed: outcome.replayed }, { status: outcome.replayed ? 200 : 201 });
  } catch (error) { return pos2ErrorResponse(error); }
}
