import { prisma } from "@/lib/prisma";
import EntryForm from "./EntryForm";

const typeLabels: Record<string, string> = {
  COMPRA: "Compra",
  TRASPASO: "Traspaso",
  AJUSTE: "Ajuste",
};

export default async function BranchEntriesPage() {
  const [branches, products, entries] = await Promise.all([
    prisma.branch.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.inventoryProduct.findMany({
      where: { isActive: true, trackStock: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true },
    }),
    prisma.inventoryEntry.findMany({
      orderBy: { entryDate: "desc" },
      take: 20,
      include: { branch: true, product: true },
    }),
  ]);

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <a
            href="/administration/inventory/sucursales"
            className="mb-2 inline-block text-sm font-semibold text-on-surface-variant hover:text-on-surface"
          >
            ← Inventario de sucursales
          </a>
          <h1 className="text-3xl font-bold">Entradas de inventario</h1>
          <p className="mt-3 text-on-surface-variant">
            Compras y ajustes (mermas, pérdidas, correcciones) por sucursal.
          </p>
        </div>

        <EntryForm branches={branches} products={products} />

        <div className="rounded-2xl border border-outline-variant bg-surface-container divide-y divide-outline-variant">
          <div className="p-6">
            <h2 className="text-xl font-bold text-on-surface">Entradas recientes</h2>
          </div>

          {entries.length === 0 && (
            <p className="p-6 text-sm text-on-surface-variant">Aún no hay entradas registradas.</p>
          )}

          {entries.map((entry) => {
            const quantity = Number(entry.quantity);
            return (
              <div key={entry.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-on-surface">
                    {entry.product.name} · {entry.branch.name}
                  </p>
                  <p className="text-sm text-on-surface-variant">
                    {typeLabels[entry.type] ?? entry.type} ·{" "}
                    <span className={quantity < 0 ? "text-error" : ""}>
                      {quantity > 0 ? "+" : ""}
                      {quantity} {entry.product.unit}
                    </span>{" "}
                    · {new Date(entry.entryDate).toLocaleDateString("es-MX")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
