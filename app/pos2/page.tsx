import { requireModuleAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { evaluateCapability, PHASE3A_CAPABILITIES, type CapabilityKey } from "@/lib/pos2/capabilityPolicy";
import { resolveBranchCatalog } from "@/lib/pos2/catalog/resolveBranchCatalog";
import { resolvePricesBatch } from "@/lib/pos2/pricing/resolvePrice";
import Pos2CashierApp from "@/components/pos2/Pos2CashierApp";
import type { AdjustmentRuleDto, CatalogCategoryDto } from "@/lib/pos2/ui/types";
import { readPos2RolloutConfig } from "@/lib/pos2/certification/rollout";
import { getPosAccessibleBranchIds } from "@/lib/pos2/currentActor";
import { canAccessModule } from "@/lib/permission-modules";
import { buildPos2Contexts, initialPos2ContextIndex } from "@/lib/pos2/context";

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
  const user = await requireModuleAccess("/pos");
  const branchIds = await getPosAccessibleBranchIds();
  const branches = await prisma.branch.findMany({
    where: { active: true, ...(branchIds === null ? {} : { id: { in: branchIds } }) },
    orderBy: { name: "asc" },
    include: {
      registers: { where: { active: true }, orderBy: { name: "asc" } },
      terminals: { orderBy: { name: "asc" } },
      cashSessionsV2: { where: { status: { in: ["OPEN", "CLOSING"] } }, select: { id: true, registerId: true, openingTerminalId: true, status: true } },
      cashCuts: { where: { status: "ABIERTO" }, select: { id: true }, orderBy: { openedAt: "asc" } },
    },
  });
  const rollout = readPos2RolloutConfig();
  const contexts = buildPos2Contexts(branches, rollout);
  const initialContextIndex = initialPos2ContextIndex(contexts);
  const initialBranchId = initialContextIndex === null ? undefined : contexts[initialContextIndex]?.branchId;
  const now = new Date();
  const [catalog, adjustmentVersions, people, grants] = await Promise.all([
    initialBranchId ? loadCatalog(initialBranchId) : Promise.resolve([]),
    prisma.adjustmentVersion.findMany({
      where: { kind: { in: ["DISCOUNT", "COURTESY"] }, validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gt: now } }],
        AND: [{ OR: [{ scope: "GLOBAL" }, { scope: "BRANCH", ...(branchIds === null ? {} : { branchId: { in: branchIds } }) }] }], definition: { active: true }, termination: null },
      include: { definition: { select: { name: true } } }, orderBy: [{ kind: "asc" }, { priority: "desc" }],
    }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.capabilityGrant.findMany({
      where: { capability: { key: { in: [...PHASE3A_CAPABILITIES] }, active: true }, OR: [{ userId: user.id }, { role: user.role }], validFrom: { lte: now }, AND: [{ OR: [{ validTo: null }, { validTo: { gt: now } }] }] },
      select: { userId: true, role: true, scope: true, branchId: true, capability: { select: { key: true } } },
    }),
  ]);
  const actor = { id: user.id, role: user.role, branchIds };
  const capabilityRows = grants.map((grant) => ({ ...grant, capabilityKey: grant.capability.key }));
  const capabilitiesByBranch = Object.fromEntries(
    [...new Set(contexts.map((context) => context.branchId))].map((branchId) => [
      branchId,
      Object.fromEntries(PHASE3A_CAPABILITIES.map((key) => [key, evaluateCapability(actor, key, branchId, capabilityRows)])) as Record<CapabilityKey, boolean>,
    ]),
  ) as Record<string, Record<CapabilityKey, boolean>>;
  const legacyNavigationKeys = [
    "/cash-cuts",
    "/pos/sales",
    "/pos/discounts/courtesies",
    "/pos/categories",
    "/pos/products",
  ] as const;
  const legacyNavigationPermissions = user.role === "ADMIN"
    ? [...legacyNavigationKeys]
    : (await prisma.modulePermission.findMany({
        where: { userId: user.id, moduleKey: { in: [...legacyNavigationKeys] } },
        select: { moduleKey: true },
      })).map((permission) => permission.moduleKey);
  const legacyNavigation = Object.fromEntries(
    legacyNavigationKeys.map((key) => [key, canAccessModule(user.role, legacyNavigationPermissions, key)]),
  );
  const rulesByBranch = Object.fromEntries(
    [...new Set(contexts.map((context) => context.branchId))].map((branchId) => [
      branchId,
      adjustmentVersions
        .filter((version) => version.scope === "GLOBAL" || version.branchId === branchId)
        .map((version) => ({ id: version.id, kind: version.kind as "DISCOUNT" | "COURTESY", name: version.definition.name, requiresBeneficiary: version.requiresBeneficiary, requiresAuthorization: version.requiresAuthorization } satisfies AdjustmentRuleDto)),
    ]),
  ) as Record<string, AdjustmentRuleDto[]>;

  return <Pos2CashierApp userId={user.id} contexts={contexts} initialContextIndex={initialContextIndex} initialCatalog={catalog} rulesByBranch={rulesByBranch} people={people} capabilitiesByBranch={capabilitiesByBranch} legacyNavigation={legacyNavigation} />;
}
