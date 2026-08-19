import Link from "next/link";
import { prisma } from "@/lib/prisma";
import TransferForm from "./TransferForm";
import { getAccessibleBranchIds } from "@/lib/auth";

export default async function TraspasosPage() {
  const allowedBranchIds = await getAccessibleBranchIds();
  const branchWhere = allowedBranchIds === null
    ? { active: true }
    : { active: true, id: { in: allowedBranchIds } };
  const [branches, products, transfers] = await Promise.all([
    prisma.branch.findMany({
      where: branchWhere,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.inventoryProduct.findMany({
      where: { isActive: true, trackStock: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true },
    }),
    prisma.inventoryEntry.findMany({
      where: {
        type: "TRASPASO",
        ...(allowedBranchIds === null ? {} : { branchId: { in: allowedBranchIds } }),
      },
      orderBy: { entryDate: "desc" },
      take: 30,
      include: { branch: true, product: true },
    }),
  ]);

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <Link
            href="/administration/inventory/sucursales"
            className="mb-2 inline-block text-sm font-semibold text-on-surface-variant hover:text-on-surface"
          >
            ← Inventario de sucursales
          </Link>
          <h1 className="text-3xl font-bold">Traspasos entre sucursales</h1>
          <p className="mt-3 text-on-surface-variant">
            Cada traspaso resta el stock en la sucursal origen y lo suma en la sucursal destino.
          </p>
        </div>

        <TransferForm branches={branches} products={products} />

        <div className="rounded-2xl border border-outline-variant bg-surface-container divide-y divide-outline-variant">
          <div className="p-6">
            <h2 className="text-xl font-bold text-on-surface">Traspasos recientes</h2>
          </div>

          {transfers.length === 0 && (
            <p className="p-6 text-sm text-on-surface-variant">Aún no hay traspasos registrados.</p>
          )}

          {transfers.map((entry) => {
            const quantity = Number(entry.quantity);
            return (
              <div key={entry.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-on-surface">
                    {entry.product.name} · {entry.branch.name}
                  </p>
                  <p className="text-sm text-on-surface-variant">
                    {entry.notes} · {new Date(entry.entryDate).toLocaleDateString("es-MX")}
                  </p>
                </div>
                <span
                  className={`font-semibold ${quantity < 0 ? "text-error" : "text-tertiary-fixed-dim"}`}
                >
                  {quantity > 0 ? "+" : ""}
                  {quantity} {entry.product.unit}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
