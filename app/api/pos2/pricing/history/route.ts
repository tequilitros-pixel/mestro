import { NextResponse } from "next/server";
import { DomainError } from "@/lib/domain/errors";
import { prisma } from "@/lib/prisma";
import { getCurrentCommandActor } from "@/lib/pos2/currentActor";
import { requireCapability, requireGlobalCapability } from "@/lib/pos2/authorization";
import { requireActorBranch } from "@/lib/pos2/cash/guards";
import { pos2ErrorResponse } from "@/lib/pos2/http";
import { getPriceHistory } from "@/lib/pos2/pricing/history";

export async function GET(request: Request) {
  try {
    const actor = await getCurrentCommandActor();
    const params = new URL(request.url).searchParams;
    const branchId = params.get("branchId") ?? undefined;
    const productId = params.get("productId") ?? undefined;
    const variantId = params.get("variantId") ?? undefined;
    const at = new Date(params.get("at") ?? new Date().toISOString());
    if (productId && variantId || !Number.isFinite(at.getTime())) throw new DomainError("VALIDATION_ERROR", { field: "query" });
    await prisma.$transaction(async (tx) => {
      if (branchId) { requireActorBranch(actor, branchId); await requireCapability(tx, actor, "pricing.history.view", branchId); }
      else await requireGlobalCapability(tx, actor, "pricing.history.view");
    });
    const history = await getPriceHistory({ productId, variantId, branchId, at });
    return NextResponse.json({ at: at.toISOString(), history });
  } catch (error) { return pos2ErrorResponse(error); }
}
