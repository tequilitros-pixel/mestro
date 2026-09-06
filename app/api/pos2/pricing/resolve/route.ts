import { NextResponse } from "next/server";
import { DomainError } from "@/lib/domain/errors";
import { prisma } from "@/lib/prisma";
import { getCurrentCommandActor } from "@/lib/pos2/currentActor";
import { requireCapability } from "@/lib/pos2/authorization";
import { requireActorBranch } from "@/lib/pos2/cash/guards";
import { pos2ErrorResponse } from "@/lib/pos2/http";
import { resolvePrice } from "@/lib/pos2/pricing/resolvePrice";

export async function GET(request: Request) {
  try {
    const actor = await getCurrentCommandActor();
    const params = new URL(request.url).searchParams;
    const branchId = params.get("branchId") ?? "";
    const productId = params.get("productId") ?? undefined;
    const variantId = params.get("variantId") ?? undefined;
    const at = new Date(params.get("at") ?? new Date().toISOString());
    if (!branchId || (!!productId === !!variantId) || !Number.isFinite(at.getTime())) throw new DomainError("VALIDATION_ERROR", { field: "query" });
    requireActorBranch(actor, branchId);
    await prisma.$transaction((tx) => requireCapability(tx, actor, "pricing.view", branchId));
    return NextResponse.json(await resolvePrice({ branchId, productId, variantId, at }));
  } catch (error) { return pos2ErrorResponse(error); }
}
