import { redirect } from "next/navigation";
import { getAccessibleBranchIds, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { evaluateCapability, PHASE3A_CAPABILITIES, type CapabilityKey } from "@/lib/pos2/capabilityPolicy";
import { resolveBranchCatalog } from "@/lib/pos2/catalog/resolveBranchCatalog";
import { resolvePricesBatch } from "@/lib/pos2/pricing/resolvePrice";
import Pos2CashierApp from "@/components/pos2/Pos2CashierApp";
import type { AdjustmentRuleDto, CatalogCategoryDto, PosContextDto } from "@/lib/pos2/ui/types";
import { isPos2ContextEnabled, readPos2RolloutConfig } from "@/lib/pos2/certification/rollout";

export const dynamic = "force-dynamic";

async function loadCatalog(branchId: string): Promise<CatalogCategoryDto[]> {
  const source = await resolveBranchCatalog(branchId);
  const targets: Array<{ key: string; productId?: string; variantId?: string }> = [];
  for (const category of source) for (const product of category.products) {
    if (product.variants.length) for (const variant of product.variants) targets.push({ key: `V:${variant.id}`, variantId: variant.id });
    else targets.push({ key: `P:${product.id}`, productId: product.id });
  }
  const pricingAt = new Date();
  const prices = await resolvePricesBatch(targets.map((target) => ({
    ...(target.variantId ? { variantId: target.variantId } : { productId: target.productId! }), branchId, at: pricingAt,
  })));
  const priceByTarget = new Map<string, string | null>(targets.map((target, index) => [target.key, prices[index]?.amount ?? null]));
  return source.map((category) => ({
    id: category.id, name: category.name, icon: category.icon,
    products: category.products.map((product) => ({
      id: product.id, name: product.name, sku: product.sku, internalCode: product.internalCode,
      barcode: product.barcode, icon: product.icon, imageAlt: product.imageAlt, available: product.effective.enabled && product.effective.availability === "AVAILABLE",
      price: product.variants.length ? null : priceByTarget.get(`P:${product.id}`) ?? null,
      variants: product.variants.map((variant) => ({
        id: variant.id, name: variant.name, sku: variant.sku, available: variant.active && product.effective.enabled && product.effective.availability === "AVAILABLE",
        price: priceByTarget.get(`V:${variant.id}`) ?? null,
      })),
    })),
  }));
}

export default async function Pos2Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const branchIds = await getAccessibleBranchIds();
  const branches = await prisma.branch.findMany({
    where: { active: true, ...(branchIds ? { id: { in: branchIds } } : {}) },
    orderBy: { name: "asc" },
    include: {
      registers: { where: { active: true }, orderBy: { name: "asc" } },
      terminals: { where: { status: "ACTIVE" }, orderBy: { name: "asc" } },
      cashSessionsV2: { where: { status: { in: ["OPEN", "CLOSING"] } }, select: { id: true, registerId: true, openingTerminalId: true, status: true } },
    },
  });
  const rollout = readPos2RolloutConfig();
  const contexts: PosContextDto[] = branches.flatMap((branch) => branch.terminals.flatMap((terminal) => branch.registers.filter((register) => isPos2ContextEnabled(rollout, branch.id, register.id)).map((register) => ({
    branchId: branch.id, branchName: branch.name, registerId: register.id, registerName: register.name,
    terminalId: terminal.id, terminalName: terminal.name,
    cashSessionId: branch.cashSessionsV2.find((session) => session.registerId === register.id && session.status === "OPEN")?.id ?? null,
  }))));
  const initialBranchId = contexts[0]?.branchId ?? branches[0]?.id;
  const now = new Date();
  const [catalog, adjustmentVersions, people, grants] = await Promise.all([
    initialBranchId ? loadCatalog(initialBranchId) : Promise.resolve([]),
    initialBranchId ? prisma.adjustmentVersion.findMany({
      where: { kind: { in: ["DISCOUNT", "COURTESY"] }, validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gt: now } }],
        AND: [{ OR: [{ scope: "GLOBAL" }, { scope: "BRANCH", branchId: initialBranchId }] }], definition: { active: true }, termination: null },
      include: { definition: { select: { name: true } } }, orderBy: [{ kind: "asc" }, { priority: "desc" }],
    }) : Promise.resolve([]),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.capabilityGrant.findMany({
      where: { capability: { key: { in: [...PHASE3A_CAPABILITIES] }, active: true }, OR: [{ userId: user.id }, { role: user.role }], validFrom: { lte: now }, AND: [{ OR: [{ validTo: null }, { validTo: { gt: now } }] }] },
      select: { userId: true, role: true, scope: true, branchId: true, capability: { select: { key: true } } },
    }),
  ]);
  const actor = { id: user.id, role: user.role, branchIds };
  const capabilityRows = grants.map((grant) => ({ ...grant, capabilityKey: grant.capability.key }));
  const capabilities = Object.fromEntries(PHASE3A_CAPABILITIES.map((key) => [key, evaluateCapability(actor, key, initialBranchId, capabilityRows)])) as Record<CapabilityKey, boolean>;
  const rules: AdjustmentRuleDto[] = adjustmentVersions.map((version) => ({ id: version.id, kind: version.kind as "DISCOUNT" | "COURTESY", name: version.definition.name, requiresBeneficiary: version.requiresBeneficiary, requiresAuthorization: version.requiresAuthorization }));

  return <Pos2CashierApp userId={user.id} userName={user.name} contexts={contexts} initialCatalog={catalog} rules={rules} people={people} capabilities={capabilities} />;
}
