import { NextResponse } from "next/server";
import { DomainError } from "@/lib/domain/errors";
import { getCurrentCommandActor } from "@/lib/pos2/currentActor";
import { pos2ErrorResponse, requireTerminalBranch, requireTerminalRequest } from "@/lib/pos2/http";
import { listSales } from "@/lib/pos2/sales/queries";
export async function GET(request: Request) { try { const actor = await getCurrentCommandActor(); const terminalId = await requireTerminalRequest(request); const p = new URL(request.url).searchParams; const branchId = p.get("branchId") ?? ""; if (!branchId) throw new DomainError("VALIDATION_ERROR", { field: "branchId" }); await requireTerminalBranch(terminalId, branchId); return NextResponse.json({ sales: await listSales(actor, { branchId, cashSessionId: p.get("cashSessionId") ?? undefined, take: Number(p.get("take") ?? 50) }) }); } catch (error) { return pos2ErrorResponse(error); } }
