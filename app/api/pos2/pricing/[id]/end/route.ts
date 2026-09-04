import { NextResponse } from "next/server";
import { getCurrentCommandActor } from "@/lib/pos2/currentActor";
import { pos2ErrorResponse } from "@/lib/pos2/http";
import { endPriceVersion } from "@/lib/pos2/pricing/managePrices";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getCurrentCommandActor();
    const body = await request.json();
    const { id } = await context.params;
    const outcome = await endPriceVersion({ operationId: String(body.operationId), actor, priceVersionId: id, effectiveAt: new Date(body.effectiveAt), reason: String(body.reason ?? "") });
    return NextResponse.json(outcome.result);
  } catch (error) { return pos2ErrorResponse(error); }
}
