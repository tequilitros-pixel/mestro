import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CountItemRow from "./CountItemRow";
import CloseCountButton from "./CloseCountButton";

export default async function CountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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
              {new Date(count.countDate).toLocaleDateString("es-MX")}
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
          {count.items.map((item) => (
            <CountItemRow
              key={item.id}
              countId={count.id}
              editable={editable}
              item={{
                id: item.id,
                productName: item.product.name,
                unit: item.product.unit,
                previousQuantity: Number(item.previousQuantity ?? 0),
                quantityCounted: Number(item.quantityCounted),
                entriesQuantity:
                  item.entriesQuantity !== null ? Number(item.entriesQuantity) : null,
                quantityConsumed:
                  item.quantityConsumed !== null ? Number(item.quantityConsumed) : null,
                costTotal: item.costTotal !== null ? Number(item.costTotal) : null,
              }}
            />
          ))}
        </div>

        {editable && <CloseCountButton countId={count.id} />}
      </div>
    </main>
  );
}
