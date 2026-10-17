import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CountItemRow from "./CountItemRow";
import CloseCountButton from "./CloseCountButton";
import AddCountProduct from "./AddCountProduct";
import { formatDateOnly } from "@/lib/dateOnly";
import { getAccessibleBranchIds, getCurrentUser } from "@/lib/auth";
import { canViewInventoryCountSystemData } from "@/lib/inventory/countVisibility";
import { generateOperationId } from "@/lib/pos2/operationId";
import { buildInventoryCountItemClientView } from "@/lib/inventory/countPresentation";
import { formatBusinessDateTime } from "@/lib/dateTime";
import { inventoryCountTypeLabel, isProductIncludedInInventoryCount } from "@/lib/inventory/countScope";
import { formatCommercialQuantity, getNormalizedContentPerUnit } from "@/lib/inventory/units";
import { summarizeCountConsumption } from "@/lib/inventory/countConsumption";

export default async function CountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const allowedBranchIds = await getAccessibleBranchIds();
  const user = await getCurrentUser();
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
    },
  });

  if (!count) {
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
  const previousClosedCount = count.status === "CERRADO" && count.closedAt
    ? await prisma.inventoryCount.findFirst({
        where: {
          branchId: count.branchId,
          countType: count.countType,
          status: "CERRADO",
          closedAt: { lt: count.closedAt },
        },
        orderBy: { closedAt: "desc" },
        select: { closedAt: true },
      })
    : null;
  const periodStart = previousClosedCount?.closedAt ?? null;
  const productIds = count.items.map((item) => item.productId);
  const [recordedMovements, legacyEntries, balances] = periodStart && count.closedAt && productIds.length > 0
    ? await Promise.all([
        prisma.inventoryMovement.findMany({
          where: {
            branchId: count.branchId,
            inventoryProductId: { in: productIds },
            createdAt: { gt: periodStart, lte: count.closedAt },
            movementType: { in: ["SALE_CONSUMPTION", "SALE_REVERSAL", "EVENT_LOAD", "EVENT_RETURN"] },
          },
          select: { inventoryProductId: true, movementType: true, quantityDelta: true },
        }),
        prisma.inventoryEntry.findMany({
          where: {
            branchId: count.branchId,
            productId: { in: productIds },
            entryDate: { gt: periodStart, lte: count.closedAt },
            type: { in: ["VENTA_POS", "DEVOLUCION_POS", "SALIDA_EVENTO", "REGRESO_EVENTO"] },
          },
          select: { productId: true, entryDate: true },
        }),
        prisma.inventoryBalance.findMany({
          where: { branchId: count.branchId, inventoryProductId: { in: productIds } },
          select: { inventoryProductId: true, createdAt: true },
        }),
      ])
    : [[], [], []] as const;
  const balanceStartByProduct = new Map(balances.map((balance) => [balance.inventoryProductId, balance.createdAt]));
  const legacyProductIds = new Set(legacyEntries
    .filter((entry) => {
      const balanceStart = balanceStartByProduct.get(entry.productId);
      return !balanceStart || entry.entryDate < balanceStart;
    })
    .map((entry) => entry.productId));
  const consumption = periodStart
    ? summarizeCountConsumption(
        count.items.map((item) => ({
          ...item.product,
          unitCostAtTime: item.unitCostAtTime === null ? null : Number(item.unitCostAtTime),
        })),
        recordedMovements.map((movement) => ({
          productId: movement.inventoryProductId,
          quantity: Number(movement.quantityDelta),
          type: movement.movementType,
        })),
      )
    : null;
  const missingCostProductIds = new Set(legacyProductIds);
  for (const [productId, row] of consumption?.rows ?? []) {
    if (row.missingCost) missingCostProductIds.add(productId);
  }
  const missingCostProducts = missingCostProductIds.size;
  const costComplete = consumption !== null && missingCostProducts === 0;
  const negativeItems = isAdmin
    ? count.items
        .filter((item) => item.quantityCounted !== null && item.countedAt !== null)
        .map((item) => {
          const theoretical = item.previousQuantity === null ? 0 : Number(item.previousQuantity);
          const counted = item.quantityCounted === null ? 0 : Number(item.quantityCounted);
          return { item, theoretical, counted, difference: counted - theoretical };
        })
        .filter((entry) => entry.difference < 0)
        .sort((a, b) => a.difference - b.difference)
    : [];
  const shortageValuation = negativeItems.reduce((result, { item, difference }) => {
    const unitCost = item.unitCostAtTime === null ? null : Number(item.unitCostAtTime);
    const factor = getNormalizedContentPerUnit(item.product);
    if (unitCost === null || (item.product.handlingUnit && factor === null)) {
      result.unpriced += 1;
    } else {
      result.known += -difference * unitCost / (factor ?? 1);
    }
    return result;
  }, { known: 0, unpriced: 0 });

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
                : "bg-secondary/20 text-secondary"
            }`}
          >
            {count.status === "CERRADO" ? "Cerrado" : "Borrador"}
          </span>
        </div>

        {count.status === "CERRADO" && (
          <p className="-mt-5 text-sm text-on-surface-variant">
            Cerrado {count.closedAt ? formatBusinessDateTime(count.closedAt) : "sin fecha registrada"}
            {count.closedBy ? ` · ${count.closedBy.name} (${count.closedBy.username})` : " · usuario no registrado"}
            {` · ID ${count.id}`}
          </p>
        )}

        {count.status === "CERRADO" && isAdmin && (
          <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
            <p className="text-xs text-on-surface-variant">Costo estimado del consumo registrado entre conteos</p>
            <p className="mt-1 text-2xl font-bold text-tertiary-fixed-dim">
              {costComplete ? `$${consumption?.knownCost.toFixed(2)}` : "Costo pendiente de completar"}
            </p>
            {periodStart && count.closedAt ? (
              <p className="mt-1 text-xs text-on-surface-variant">
                Del {formatBusinessDateTime(periodStart)} al {formatBusinessDateTime(count.closedAt)}. Incluye ventas y salidas a eventos registradas, menos devoluciones. Usa el costo guardado al cerrar el conteo.
              </p>
            ) : (
              <p className="mt-1 text-sm text-on-surface-variant">Falta un conteo anterior cerrado para delimitar el periodo.</p>
            )}
            {consumption && missingCostProducts > 0 && (
              <p className="mt-2 text-sm text-error">
                Hay {missingCostProducts} productos con consumo sin costo o con movimientos históricos que no se pueden valorar con seguridad.
                {consumption.knownCost !== 0 ? ` Subtotal con costo configurado: $${consumption.knownCost.toFixed(2)}.` : ""}
              </p>
            )}
          </div>
        )}

        {isAdmin && (count.status === "CERRADO" || negativeItems.length > 0) && (
          <section className="rounded-2xl border border-error/30 bg-error/5 p-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-on-surface">Resumen de productos en negativo</h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Productos cuyo conteo quedó por debajo del teórico anterior. La diferencia se muestra en su presentación configurada.
                </p>
              </div>
              <div className="shrink-0 text-left sm:text-right">
                <p className="text-xs text-on-surface-variant">Productos con diferencia</p>
                <p className="text-2xl font-bold text-error">{negativeItems.length}</p>
                {count.status === "CERRADO" && negativeItems.length > 0 && (
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Valor de diferencia negativa: {shortageValuation.unpriced === 0
                      ? `$${shortageValuation.known.toFixed(2)}`
                      : `${shortageValuation.unpriced} sin costo configurado`}
                  </p>
                )}
              </div>
            </div>

            {negativeItems.length === 0 ? (
              <p className="mt-4 rounded-xl border border-tertiary-fixed-dim/30 bg-tertiary-fixed-dim/10 p-4 text-sm font-semibold text-tertiary-fixed-dim">
                No hay productos en negativo en este conteo.
              </p>
            ) : (
              <>
                <div className="mt-3 overflow-x-auto rounded-xl border border-error/20 bg-surface-container">
                  <table className="w-full min-w-[680px] text-sm">
                    <thead>
                      <tr className="border-b border-outline-variant text-left text-xs text-outline">
                        <th className="px-4 py-3 font-medium">Producto</th>
                        <th className="px-4 py-3 text-right font-medium">Teórico</th>
                        <th className="px-4 py-3 text-right font-medium">Contado</th>
                        <th className="px-4 py-3 text-right font-medium">Diferencia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                      {negativeItems.map(({ item, theoretical, counted, difference }) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 font-semibold text-on-surface">{item.product.name}</td>
                          <td className="px-4 py-3 text-right text-on-surface-variant">{formatCommercialQuantity(theoretical, item.product)}</td>
                          <td className="px-4 py-3 text-right text-on-surface-variant">{formatCommercialQuantity(counted, item.product)}</td>
                          <td className="px-4 py-3 text-right font-bold text-error">{formatCommercialQuantity(difference, item.product)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        )}

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

        <div className="rounded-2xl border border-outline-variant bg-surface-container">
          {count.items.length === 0 && <p className="p-6 text-sm text-on-surface-variant">Este conteo no tiene partidas registradas.</p>}
          {count.items.map((item) => {
            const view = buildInventoryCountItemClientView(item, {
              status: count.status,
              canViewHistory: isAdmin,
            });
            const recorded = consumption?.rows.get(item.productId);
            return <CountItemRow
              key={item.id}
              countId={count.id}
              editable={editable}
              item={isAdmin && count.status === "CERRADO" ? {
                ...view,
                quantityConsumed: legacyProductIds.has(item.productId) ? null : recorded?.quantity ?? null,
                costTotal: legacyProductIds.has(item.productId) ? null : recorded?.cost ?? null,
              } : view}
            />;
          })}
        </div>

        {editable && missingProducts.length > 0 && (
          <AddCountProduct key={missingProducts.map(({ id }) => id).join(",")} countId={count.id} products={missingProducts.map(({ id, name }) => ({ id, name }))} />
        )}

        {editable && <CloseCountButton countId={count.id} operationId={generateOperationId()} />}
      </div>
    </main>
  );
}
