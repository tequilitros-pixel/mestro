import { NextResponse } from "next/server";
import { DomainError } from "@/lib/domain/errors";
import { getCurrentCommandActor } from "@/lib/pos2/currentActor";
import { isUuidV7 } from "@/lib/pos2/operationId";
import { prisma } from "@/lib/prisma";
import { pos2ErrorResponse, requireTerminalRequest } from "@/lib/pos2/http";
import { requireActorBranch } from "@/lib/pos2/cash/guards";

export async function GET(request: Request, { params }: { params: Promise<{ operationId: string }> }) {
  try {
    await requireTerminalRequest(request);
    const actor = await getCurrentCommandActor();
    const { operationId } = await params;
    if (!isUuidV7(operationId)) throw new DomainError("VALIDATION_ERROR", { field: "operationId" });
    const receipt = await prisma.operationReceipt.findUnique({ where: { operationId } });
    if (!receipt || receipt.actorId !== actor.id) return NextResponse.json({ status: "RESULT_UNKNOWN", operationId });
    if (receipt.branchId) requireActorBranch(actor, receipt.branchId);
    return NextResponse.json({ operationId, status: receipt.status === "COMPLETED" ? "COMPLETED" : "PROCESSING", result: receipt.result ?? null, completedAt: receipt.completedAt?.toISOString() ?? null });
  } catch (error) { return pos2ErrorResponse(error); }
}
