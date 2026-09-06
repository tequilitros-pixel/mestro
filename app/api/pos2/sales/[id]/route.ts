import { NextResponse } from "next/server";
import { getCurrentCommandActor } from "@/lib/pos2/currentActor";
import { pos2ErrorResponse, requireTerminalBranch, requireTerminalRequest } from "@/lib/pos2/http";
import { getSale } from "@/lib/pos2/sales/queries";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) { try { const actor = await getCurrentCommandActor(); const terminalId = await requireTerminalRequest(request); const sale = await getSale(actor, (await context.params).id); await requireTerminalBranch(terminalId, sale.branchId, sale.registerId); return NextResponse.json(sale); } catch (error) { return pos2ErrorResponse(error); } }
