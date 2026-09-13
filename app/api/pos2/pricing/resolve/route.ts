import { NextResponse } from "next/server";
import { DomainError } from "@/lib/domain/errors";
import { prisma } from "@/lib/prisma";
import { getCurrentCommandActor } from "@/lib/pos2/currentActor";
import { requireCapability } from "@/lib/pos2/authorization";
import { requireActorBranch } from "@/lib/pos2/cash/guards";
import { pos2ErrorResponse } from "@/lib/pos2/http";
import { resolvePrice } from "@/lib/pos2/pricing/resolvePrice";
import { parseBusinessDateTimeLocal } from "@/lib/dateTime";

export async function GET(request: Request) {
  try {
    const actor = await getCurrentCommandActor();
    const params = new URL(request.url).searchParams;
    const branchId = params.get("branchId") ?? "";
    const productId = params.get("productId") ?? undefined;
    const variantId = params.get("variantId") ?? undefined;
    const rawAt = params.get("at");
    const at = rawAt
      ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(rawAt)
        ? parseBusinessDateTimeLocal(rawAt)
        : new Date(rawAt)
      : new Date();
    if (!branchId || (!!productId === !!variantId) || !Number.isFinite(at.getTime())) throw new DomainError("VALIDATION_ERROR", { field: "query" });
    requireActorBranch(actor, branchId);
    await prisma.$transaction((tx) => requireCapability(tx, actor, "pricing.view", branchId));
    return NextResponse.json(await resolvePrice({ branchId, productId, variantId, at }));
  } catch (error) { return pos2ErrorResponse(error); }
}
