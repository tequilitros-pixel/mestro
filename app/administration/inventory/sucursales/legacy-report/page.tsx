import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/auth";
import { computeStockMatrix } from "../../lib/stock";
import {
  formatCommercialPresentation,
  formatCommercialQuantity,
  getNormalizedContentPerUnit,
  hasValidCommercialConversion,
} from "@/lib/inventory/units";
import { classifyLegacyInventoryRow } from "@/lib/inventory/legacyReport";
import { getInventoryProductState } from "@/lib/inventory/productState";
import { formatBusinessDateTime } from "@/lib/dateTime";

type ReportProduct = {
  id: string;
  code: string;
  name: string;
  unit: string;
  inventoryBaseUnit: string | null;
  handlingUnit: string | null;
  contentPerUnit: unknown;
  contentUnit: string | null;
  normalizedContentPerUnit: unknown;
  isActive: boolean;
  archivedAt: Date | null;
};

type ReportRow = {
  id: string;
  branchName: string;
  productName: string;
  code: string;
  state: string;
  source: string;
  classification: string;
  reason: string;
  baseUnit: string;
  currentBase: string;
  commercialEquivalent: string;
  presentation: string;
  historicalFactor: string;
  lastEvidence: string;
};

function factorLabel(contentPerUnit: unknown, contentUnit: string | null) {
  if (contentPerUnit === null || contentPerUnit === undefined || !contentUnit) return "No observado";
  return `${String(contentPerUnit)} ${contentUnit.toLowerCase()}`;
}

export default async function LegacyInventoryReportPage() {
  const allowedBranchIds = await getAccessibleBranchIds();
  const branchWhere = {
    active: true,
    ...(allowedBranchIds === null ? {} : { id: { in: allowedBranchIds } }),
  };
  const [branches, products] = await Promise.all([
    prisma.branch.findMany({ where: branchWhere, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.inventoryProduct.findMany({
      where: { trackStock: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        unit: true,
        inventoryBaseUnit: true,
        handlingUnit: true,
        contentPerUnit: true,
        contentUnit: true,
        normalizedContentPerUnit: true,
        isActive: true,
        archivedAt: true,
      },
    }),
  ]);

  const branchIds = branches.map((branch) => branch.id);
  const productIds = products.map((product) => product.id);
  const [matrix, balances, entries, latestCounts] = await Promise.all([
    computeStockMatrix(productIds, allowedBranchIds),
    prisma.inventoryBalance.findMany({
      where: {
        branchId: { in: branchIds },
        inventoryProductId: { in: productIds },
      },
      select: { branchId: true, inventoryProductId: true },
    }),
    prisma.inventoryEntry.findMany({
      where: {
        branchId: { in: branchIds },
        productId: { in: productIds },
      },
      orderBy: { entryDate: "desc" },
      select: {
        branchId: true,
        productId: true,
        contentPerUnit: true,
        contentUnit: true,
        entryDate: true,
      },
    }),
    Promise.all(branchIds.map((branchId) => prisma.inventoryCount.findFirst({
      where: { branchId, status: "CERRADO" },
      orderBy: { countDate: "desc" },
      select: {
        id: true,
        branchId: true,
        countDate: true,
        items: { select: { productId: true } },
      },
    }))),
  ]);

  const balanceKeys = new Set(balances.map((balance) => `${balance.branchId}:${balance.inventoryProductId}`));
  const entriesByKey = new Map<string, typeof entries>();
  for (const entry of entries) {
    const key = `${entry.branchId}:${entry.productId}`;
    const current = entriesByKey.get(key) ?? [];
    current.push(entry);
    entriesByKey.set(key, current);
  }
  const lastCountByBranch = new Map(latestCounts.filter(Boolean).map((count) => [count!.branchId, count!]));
  const rows: ReportRow[] = [];

  for (const branch of branches) {
    const count = lastCountByBranch.get(branch.id);
    const countProductIds = new Set(count?.items.map((item) => item.productId) ?? []);
    for (const product of products as ReportProduct[]) {
      const key = `${branch.id}:${product.id}`;
      const productEntries = entriesByKey.get(key) ?? [];
      const hasV2Balance = balanceKeys.has(key);
      const hasLegacyEvidence = countProductIds.has(product.id) || productEntries.length > 0;
      const config = {
        productName: product.name,
        unit: product.unit,
        inventoryBaseUnit: product.inventoryBaseUnit,
        handlingUnit: product.handlingUnit,
        contentPerUnit: product.contentPerUnit,
        contentUnit: product.contentUnit,
        normalizedContentPerUnit: product.normalizedContentPerUnit,
      };
      const currentStock = matrix.stockByBranch.get(branch.id)?.get(product.id) ?? 0;
      const currentFactor = getNormalizedContentPerUnit(config);
      const historicalFactors = productEntries
        .filter((entry) => entry.contentPerUnit !== null && entry.contentUnit !== null)
        .map((entry) => getNormalizedContentPerUnit({
          inventoryBaseUnit: product.inventoryBaseUnit,
          contentPerUnit: entry.contentPerUnit,
          contentUnit: entry.contentUnit,
          normalizedContentPerUnit: null,
        }));
      const historicalFactorPresent = historicalFactors.length > 0;
      const historicalFactorMatches = historicalFactorPresent && currentFactor !== null && historicalFactors.every((factor) => factor !== null && Math.abs(factor - currentFactor) <= Math.max(1e-9, Math.abs(currentFactor) * 1e-9));
      const classification = classifyLegacyInventoryRow({
        hasV2Balance,
        currentStock,
        hasLegacyEvidence,
        hasBaseUnit: Boolean(product.inventoryBaseUnit),
        hasValidPresentation: hasValidCommercialConversion(config),
        historicalFactorPresent,
        historicalFactorMatches,
      });
      if (!classification) continue;

      const validPresentation = hasValidCommercialConversion(config);
      const lastEntry = productEntries[0];
      rows.push({
        id: key,
        branchName: branch.name,
        productName: product.name,
        code: product.code,
        state: getInventoryProductState(product),
        source: classification.source === "V2_LEDGER" ? "Ledger V2" : "Lectura legacy temporal",
        classification: classification.classification,
        reason: classification.reasons.join("; "),
        baseUnit: product.inventoryBaseUnit ?? product.unit,
        currentBase: formatCommercialQuantity(currentStock, { ...config, handlingUnit: null }),
        commercialEquivalent: validPresentation ? formatCommercialQuantity(currentStock, config) : "No disponible",
        presentation: validPresentation ? (formatCommercialPresentation(config) ?? "Presentación por configurar") : "Presentación por configurar",
        historicalFactor: factorLabel(lastEntry?.contentPerUnit, lastEntry?.contentUnit ?? null),
        lastEvidence: lastEntry
          ? `Entrada ${formatBusinessDateTime(lastEntry.entryDate)}`
          : count
            ? `Conteo ${count.id} · ${formatBusinessDateTime(count.countDate)}`
            : "Sin fecha de evidencia",
      });
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <Link href="/administration/inventory/sucursales" className="mb-2 inline-block text-sm font-semibold text-on-surface-variant hover:text-on-surface">← Inventario de sucursales</Link>
          <h1 className="text-3xl font-bold sm:text-4xl">Reporte legacy de inventario</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-on-surface-variant sm:text-base">
            Lectura de evidencia histórica y saldos que todavía no tienen un balance V2. Este reporte es sólo lectura: no cambia cantidades, factores, movimientos ni conteos.
          </p>
        </div>

        <div className="rounded-2xl border border-secondary/30 bg-secondary/10 p-5 text-sm text-on-surface">
          <strong>Revisión manual requerida.</strong> Una clasificación consistente no autoriza por sí sola una reparación. Cualquier acción futura deberá ser explícita, confirmada por un administrador y quedar auditada.
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-outline-variant bg-surface-container p-8 text-center text-sm text-on-surface-variant">
            No hay filas legacy o alertas V2 para las ubicaciones autorizadas.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container">
            <table className="w-full min-w-[1250px] text-sm">
              <thead>
                <tr className="border-b border-outline-variant text-left text-xs text-on-surface-variant">
                  <th className="px-3 py-3">Ubicación / producto</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Origen</th>
                  <th className="px-3 py-3">Clasificación</th>
                  <th className="px-3 py-3">Saldo base</th>
                  <th className="px-3 py-3">Equivalente comercial</th>
                  <th className="px-3 py-3">Presentación</th>
                  <th className="px-3 py-3">Factor histórico</th>
                  <th className="px-3 py-3">Motivo / última evidencia</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-outline-variant align-top last:border-0">
                    <td className="px-3 py-3"><p className="font-semibold">{row.branchName}</p><p className="mt-1">{row.productName}</p><p className="text-xs text-on-surface-variant">{row.code} · base {row.baseUnit}</p></td>
                    <td className="px-3 py-3">{row.state}</td>
                    <td className="px-3 py-3">{row.source}</td>
                    <td className="px-3 py-3 font-semibold">{row.classification}</td>
                    <td className="px-3 py-3">{row.currentBase}</td>
                    <td className="px-3 py-3">{row.commercialEquivalent}</td>
                    <td className="px-3 py-3">{row.presentation}</td>
                    <td className="px-3 py-3">{row.historicalFactor}</td>
                    <td className="max-w-[340px] whitespace-normal px-3 py-3 text-on-surface-variant"><p>{row.reason || "Sin motivo adicional"}</p><p className="mt-1 text-xs">{row.lastEvidence}</p></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
