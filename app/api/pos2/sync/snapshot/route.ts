import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentCommandActor } from "@/lib/pos2/currentActor";
import { requireCapability } from "@/lib/pos2/authorization";
import { requireTerminalBranch, requireTerminalRequest } from "@/lib/pos2/http";
import { resolveBranchCatalog } from "@/lib/pos2/catalog/resolveBranchCatalog";
import { resolvePricesBatch, type ResolvePriceInput } from "@/lib/pos2/pricing/resolvePrice";

export const dynamic = "force-dynamic";
type Target = { key: string; productId?: string; variantId?: string };

export async function GET(request: Request) {
  const actor = await getCurrentCommandActor();
  const terminalId = await requireTerminalRequest(request);
  const branchId = new URL(request.url).searchParams.get("branchId") ?? "";
  await requireTerminalBranch(terminalId, branchId);
  await prisma.$transaction((tx) => requireCapability(tx, actor, "catalog.view", branchId));
  const at = new Date();
  const categories = await resolveBranchCatalog(branchId);
  const targets: Target[] = categories.flatMap((category) => category.products.flatMap((product): Target[] => product.variants.length
    ? product.variants.map((variant) => ({ key: `VARIANT:${variant.id}`, variantId: variant.id }))
    : [{ key: `PRODUCT:${product.id}`, productId: product.id }]));
  const priceInputs: ResolvePriceInput[] = targets.map((target) => ({ ...(target.variantId ? { variantId: target.variantId } : { productId: target.productId! }), branchId, at }));
  const resolved = await resolvePricesBatch(priceInputs, prisma);
  const prices = Object.fromEntries(targets.map((target, index) => [target.key, resolved[index] ? { amount: resolved[index]!.amount, priceVersionId: resolved[index]!.priceVersionId, explanation: resolved[index]!.explanation } : null]));
  const promotions = await prisma.adjustmentVersion.findMany({ where: { kind: "PROMOTION", validFrom: { lte: at }, OR: [{ validTo: null }, { validTo: { gt: at } }], AND: [{ OR: [{ scope: "GLOBAL" }, { scope: "BRANCH", branchId }] }], definition: { active: true }, termination: null }, include: { definition: { select: { code: true, name: true } } } });
  return NextResponse.json({ branchId, cachedAt: at.toISOString(), estimatesOnly: true, categories, prices, promotions: promotions.map((item) => ({ id: item.id, code: item.definition.code, name: item.definition.name, mechanic: item.mechanic, targetType: item.targetType, targetId: item.targetId, percentage: item.percentage?.toString() ?? null, amount: item.amount?.toFixed(2) ?? null, bundleQuantity: item.bundleQuantity?.toString() ?? null, validFrom: item.validFrom.toISOString(), validTo: item.validTo?.toISOString() ?? null })), inventory: { state: "STALE", items: [] } }, { headers: { "Cache-Control": "private, no-store" } });
}
