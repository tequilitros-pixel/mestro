import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/domain/errors";
import { getCurrentCommandActor } from "@/lib/pos2/currentActor";
import { requireCapability } from "@/lib/pos2/authorization";
import { requireActorBranch } from "@/lib/pos2/cash/guards";
import { pos2ErrorResponse } from "@/lib/pos2/http";
import { resolveBranchCatalog } from "@/lib/pos2/catalog/resolveBranchCatalog";

export async function GET(request: Request) {
  try {
    const actor = await getCurrentCommandActor();
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId") ?? "";
    if (!branchId) throw new DomainError("VALIDATION_ERROR", { field: "branchId" });
    requireActorBranch(actor, branchId);
    await prisma.$transaction((tx) => requireCapability(tx, actor, "catalog.view", branchId));
    const catalog = await resolveBranchCatalog(branchId, { search: searchParams.get("q") ?? undefined });
    return NextResponse.json({ branchId, categories: catalog });
  } catch (error) { return pos2ErrorResponse(error); }
}
