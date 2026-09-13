import { NextResponse } from "next/server";
import { DomainError } from "@/lib/domain/errors";
import { getCurrentCommandActor } from "@/lib/pos2/currentActor";
import { pos2ErrorResponse } from "@/lib/pos2/http";
import { createPriceVersion } from "@/lib/pos2/pricing/managePrices";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const actor = await getCurrentCommandActor();
    const validFrom = new Date(body.validFrom);
    const validTo = body.validTo ? new Date(body.validTo) : null;
    if (!!body.productId === !!body.variantId || !["GLOBAL", "BRANCH"].includes(body.scope) || (body.scope === "BRANCH" && !body.branchId)) throw new DomainError("VALIDATION_ERROR", { field: "body" });
    const target = body.variantId ? { variantId: String(body.variantId) } : { productId: String(body.productId) };
    const scope = body.scope === "BRANCH" ? { scope: "BRANCH" as const, branchId: String(body.branchId) } : { scope: "GLOBAL" as const };
    const outcome = await createPriceVersion({ ...target, ...scope, operationId: String(body.operationId), actor, amount: String(body.amount), validFrom, validTo });
    return NextResponse.json(outcome.result, { status: outcome.replayed ? 200 : 201 });
  } catch (error) { return pos2ErrorResponse(error); }
}
