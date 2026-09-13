import { NextResponse } from "next/server";
import { getCurrentCommandActor } from "@/lib/pos2/currentActor";
import { pos2ErrorResponse } from "@/lib/pos2/http";
import { endAdjustmentVersion } from "@/lib/pos2/adjustments/manageRules";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { try { const body = await request.json(), { id } = await context.params; const outcome = await endAdjustmentVersion({ versionId: id, effectiveAt: new Date(body.effectiveAt), reason: String(body.reason ?? ""), operationId: String(body.operationId), actor: await getCurrentCommandActor() }); return NextResponse.json(outcome.result); } catch (error) { return pos2ErrorResponse(error); } }
