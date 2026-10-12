import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/auth";
import WeeklyEntryForm, { type WeeklyProduct } from "./WeeklyEntryForm";

export default async function WeeklyInventoryEntryPage() {
  const allowedBranchIds = await getAccessibleBranchIds();
  const branchWhere = allowedBranchIds === null
    ? { active: true }
    : { active: true, id: { in: allowedBranchIds } };

  const [branches, products] = await Promise.all([
    prisma.branch.findMany({
      where: branchWhere,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.inventoryProduct.findMany({
      where: {
        isActive: true,
        archivedAt: null,
        trackStock: true,
        countFrequency: "WEEKLY",
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        unit: true,
        inventoryBaseUnit: true,
        handlingUnit: true,
        contentPerUnit: true,
        contentUnit: true,
        normalizedContentPerUnit: true,
      },
    }),
  ]);

  const clientProducts: WeeklyProduct[] = products.map((product) => ({
    ...product,
    contentPerUnit: product.contentPerUnit === null ? null : Number(product.contentPerUnit),
    normalizedContentPerUnit: product.normalizedContentPerUnit === null ? null : Number(product.normalizedContentPerUnit),
  }));

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <Link
            href="/administration/inventory/branch-entries"
            className="mb-2 inline-block text-sm font-semibold text-on-surface-variant hover:text-on-surface"
          >
            ← Entradas y ajustes
          </Link>
          <h1 className="text-3xl font-bold sm:text-4xl">Entrada de inventario semanal</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-on-surface-variant sm:text-base">
            Selecciona la sucursal y captura con el teclado todo lo que llevaste. Las filas en blanco no generan movimientos.
          </p>
        </div>

        {branches.length === 0 ? (
          <div className="rounded-2xl border border-secondary/30 bg-secondary/10 p-6 text-sm text-on-surface">
            No tienes sucursales asignadas para registrar entradas.
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-outline-variant bg-surface-container p-6 text-sm text-on-surface-variant">
            No hay productos activos clasificados para el conteo semanal.
          </div>
        ) : (
          <WeeklyEntryForm branches={branches} products={clientProducts} />
        )}
      </div>
    </main>
  );
}
