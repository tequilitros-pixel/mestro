import { NextResponse } from "next/server";
import { getCurrentCommandActor } from "@/lib/pos2/currentActor";
import { pos2ErrorResponse, requireTerminalBranch, requireTerminalRequest } from "@/lib/pos2/http";
import { getReceipt } from "@/lib/pos2/sales/queries";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) { try { const terminalId=await requireTerminalRequest(request); const receipt=await getReceipt(await getCurrentCommandActor(), (await context.params).id); await requireTerminalBranch(terminalId,receipt.branchId); const {branchId: _branchId,...dto}=receipt; void _branchId; return NextResponse.json(dto); } catch (error) { return pos2ErrorResponse(error); } }
