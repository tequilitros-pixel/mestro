import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CountItemsList from "./CountItemsList";
import CloseCountButton from "./CloseCountButton";
import AddCountProduct from "./AddCountProduct";
import { formatDateOnly } from "@/lib/dateOnly";
import { getAccessibleBranchIds, requireInventoryCountCaptureAccess } from "@/lib/auth";
import { canViewInventoryCountSystemData } from "@/lib/inventory/countVisibility";
import { generateOperationId } from "@/lib/pos2/operationId";
import { buildInventoryCountItemClientView } from "@/lib/inventory/countPresentation";
import { formatBusinessDateTime } from "@/lib/dateTime";
import { inventoryCountTypeLabel, isProductIncludedInInventoryCount } from "@/lib/inventory/countScope";
import { resolveInventoryCountUnitCost } from "@/lib/accounting/inventoryCost";
import { isPotentialInventoryCountOutlier, isImplausibleInventoryIncrease, countAmountInPesos } from "@/lib/inventory/countAudit";

export default async function CountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireInventoryCountCaptureAccess();
  const allowedBranchIds = await getAccessibleBranchIds();
  const isAdmin = canViewInventoryCountSystemData(user?.role ?? "");
  const scope = await prisma.inventoryCount.findUnique({ where: { id }, select: { branchId: true } });
  if (!scope) notFound();
  if (allowedBranchIds !== null && !allowedBranchIds.includes(scope.branchId)) {
    return <main className="mx-auto max-w-2xl space-y-4 p-6 text-on-surface"><h1 className="text-2xl font-bold">Acceso denegado</h1><p className="text-on-surface-variant">Este conteo pertenece a una sucursal fuera de tu alcance.</p></main>;
  }

  const count = await prisma.inventoryCount.findUnique({
    where: { id },
    include: {
      branch: true,
      closedBy: { select: { name: true, username: true } },
      items: { include: { product: true }, orderBy: { product: { name: "asc" } } },
      declarations: { select: { id: true } },
    },
  });

  if (!count) {
    notFound();
  }

  if (user.role !== "ADMIN" && count.status !== "BORRADOR" && count.countType !== "WEEKLY") {
    notFound();
  }

  const editable = count.status === "BORRADOR";
  const missingProducts = editable
    ? (await prisma.inventoryProduct.findMany({
        where: {
          isActive: true,
          archivedAt: null,
          trackStock: true,
          ...(count.countType === "WEEKLY" ? { countFrequency: "WEEKLY" } : {}),
          id: { notIn: count.items.map((item) => item.productId) },
        },
        select: { id: true, name: true, isActive: true, archivedAt: true, trackStock: true, countFrequency: true },
        orderBy: { name: "asc" },
      })).filter((product) => isProductIncludedInInventoryCount(product, count.countType))
    : [];
  const pendingItems = editable
    ? count.items.filter((item) => item.quantityCounted === null || item.countedAt === null)
    : [];
  // Los conteos físicos V2 registran una corrección, no el consumo semanal.
  // La cantidad en "costTotal" ya no se alimenta en el flujo V2 y suele ser 0.
  const differences = count.items.map((item) => {
    const expected = Number(item.previousQuantity ?? 0);
    const actual = item.quantityCounted === null ? null : Number(item.quantityCounted);
    const missing = actual === null ? 0 : Math.max(0, expected - actual);
    const surplus = actual === null ? 0 : Math.max(0, actual - expected);
    const costPerBase = resolveInventoryCountUnitCost(item.product, item.unitCostAtTime).unitCost;
    const missingCost = countAmountInPesos(missing, costPerBase);
    const surplusCost = countAmountInPesos(surplus, costPerBase);
    const presentation = item.product.normalizedContentPerUnit === null
      ? null : Number(item.product.normalizedContentPerUnit);
    const requiresReview = isPotentialInventoryCountOutlier({
      expected, counted: actual, normalizedContentPerUnit: presentation, missingCost,
    }) || (actual !== null && isImplausibleInventoryIncrease({
      expected: Math.max(0, expected), captured: actual,
      normalizedContentPerUnit: presentation, costPerBaseUnit: costPerBase,
    }));
    return { missingCost, surplusCost, requiresReview };
  });
  const ordinaryShortage = differences.reduce((sum, diff) => sum + (diff.requiresReview ? 0 : diff.missingCost), 0);
  const ordinarySurplus = differences.reduce((sum, diff) => sum + (diff.requiresReview ? 0 : diff.surplusCost), 0);
  const extraordinaryDifference = differences.reduce((sum, diff) => sum + (diff.requiresReview ? diff.missingCost + diff.surplusCost : 0), 0);
  const fmtCurrency = (amount: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);
  const hasUncomputedFlow = count.status === "CERRADO" &&
    count.declarations.length > 0 &&
    count.items.every((item) => Number(item.entriesQuantity ?? 0) === 0 &&
      Number(item.quantityConsumed ?? 0) === 0 && Number(item.costTotal ?? 0) === 0);

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{inventoryCountTypeLabel(count.countType)} · {count.branch.name}</h1>
            <p className="mt-2 text-on-surface-variant">
              {formatDateOnly(count.countDate)}
            </p>
          </div>

          <span
            className={`rounded-full px-4 py-2 text-sm ${
              count.status === "CERRADO"
                ? "bg-tertiary-fixed-dim/20 text-tertiary-fixed-dim"
                : count.status === "ANULADO"
                  ? "bg-error/20 text-error"
                  : "bg-secondary/20 text-secondary"
            }`}
          >
            {count.status === "CERRADO"
              ? "Cerrado"
              : count.status === "ANULADO"
                ? "Anulado"
                : "Borrador"}
          </span>
        </div>

        {count.status === "CERRADO" && (
          <p className="-mt-5 text-sm text-on-surface-variant">
            Cerrado {count.closedAt ? formatBusinessDateTime(count.closedAt) : "sin fecha registrada"}
            {count.closedBy ? ` · ${count.closedBy.name} (${count.closedBy.username})` : " · usuario no registrado"}
            {` · ID ${count.id}`}
          </p>
        )}

        {isAdmin && count.status === "CERRADO" && (
          <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
            <p className="text-sm font-semibold text-on-surface">Conciliación del conteo físico</p>
            <p className="mt-2 text-xs text-on-surface-variant">Faltantes estimados (no son ventas ni pérdidas comprobadas)</p>
            <p className="mt-1 text-2xl font-bold text-on-surface">{fmtCurrency(ordinaryShortage)}</p>
            <p className="mt-2 text-xs text-on-surface-variant">Sobrantes estimados</p>
            <p className="mt-1 text-lg font-bold text-on-surface">{fmtCurrency(ordinarySurplus)}</p>
            {extraordinaryDifference > 0 && (
              <p className="mt-2 text-sm font-semibold text-amber-400">
                {fmtCurrency(extraordinaryDifference)} en diferencias extraordinarias por revisar
              </p>
            )}
            <p className="mt-2 text-xs text-on-surface-variant">
              Comparación del saldo teórico al cierre contra el conteo físico, valorizada por unidad base.
              {hasUncomputedFlow ? " Las entradas y el consumo por venta no se calculan en este corte; se consultan en Movimientos." : ""}
            </p>
          </div>
        )

        {editable && pendingItems.length > 0 && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-2xl border border-secondary/40 bg-secondary/10 p-5 text-sm text-on-surface"
          >
            <p className="font-semibold text-secondary">
              Faltan {pendingItems.length} productos por contar.
            </p>
            <p className="mt-1 text-on-surface-variant">
              Captura una cantidad explícita, incluido 0, en cada renglón antes de cerrar.
            </p>
            <ul className="mt-3 grid gap-1 text-on-surface-variant sm:grid-cols-2">
              {pendingItems.map((item) => (
                <li key={item.id}>• {item.product.name}</li>
              ))}
            </ul>
          </div>
        )}

        <CountItemsList
          items={count.items.map((item) =>
            buildInventoryCountItemClientView(item, {
              status: count.status,
              canViewHistory: isAdmin,
              hideUncomputedFlow: hasUncomputedFlow,
            }),
          )}
          countId={count.id}
          editable={editable}
          isAdmin={isAdmin}
        />

        {editable && missingProducts.length > 0 && (
          <AddCountProduct key={missingProducts.map(({ id }) => id).join(",")} countId={count.id} products={missingProducts.map(({ id, name }) => ({ id, name }))} />
        )}

        {editable && (user.role === "ADMIN" || count.countType === "WEEKLY") && <CloseCountButton countId={count.id} operationId={generateOperationId()} />}
      </div>
    </main>
  );
}
