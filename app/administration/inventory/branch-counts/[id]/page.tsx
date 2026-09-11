import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CountItemRow from "./CountItemRow";
import CloseCountButton from "./CloseCountButton";
import { formatDateOnly } from "@/lib/dateOnly";
import { getAccessibleBranchIds, getCurrentUser } from "@/lib/auth";
import { canViewInventoryCountSystemData } from "@/lib/inventory/countVisibility";

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
      items: { include: { product: true }, orderBy: { product: { name: "asc" } } },
    },
  });

  if (!count) {
    notFound();
  }

  const editable = count.status === "BORRADOR";
  const totalCost = count.items.reduce(
    (sum, item) => sum + (item.costTotal !== null ? Number(item.costTotal) : 0),
    0,
  );

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{count.branch.name}</h1>
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
          <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
            <p className="text-xs text-on-surface-variant">Costo total consumido esta semana</p>
            <p className="mt-1 text-2xl font-bold text-tertiary-fixed-dim">
              ${totalCost.toFixed(2)}
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-outline-variant bg-surface-container">
          {count.items.length === 0 && <p className="p-6 text-sm text-on-surface-variant">Este conteo no tiene partidas registradas.</p>}
          {count.items.map((item) => (
            <CountItemRow
              key={item.id}
              countId={count.id}
              editable={editable}
              isAdmin={isAdmin}
              item={{
                id: item.id,
                productName: item.product.name,
                unit: item.product.unit,
                previousQuantity: isAdmin ? Number(item.previousQuantity ?? 0) : null,
                quantityCounted: Number(item.quantityCounted),
                entriesQuantity: isAdmin && item.entriesQuantity !== null ? Number(item.entriesQuantity) : null,
                quantityConsumed: isAdmin && item.quantityConsumed !== null ? Number(item.quantityConsumed) : null,
                costTotal: isAdmin && item.costTotal !== null ? Number(item.costTotal) : null,
                inventoryBaseUnit: item.product.inventoryBaseUnit,
                handlingUnit: item.product.handlingUnit,
                contentPerUnit: item.product.contentPerUnit !== null ? Number(item.product.contentPerUnit) : null,
                contentUnit: item.product.contentUnit,
                normalizedContentPerUnit: item.product.normalizedContentPerUnit !== null ? Number(item.product.normalizedContentPerUnit) : null,
              }}
            />
          ))}
        </div>

        {editable && <CloseCountButton countId={count.id} />}
      </div>
    </main>
  );
}
