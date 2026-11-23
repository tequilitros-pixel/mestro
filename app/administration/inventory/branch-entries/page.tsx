import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/auth";
import { InventoryEntryType } from "@prisma/client";
import { formatBusinessDate } from "@/lib/dateTime";
import WeeklyEntryForm, { type WeeklyProduct } from "./weekly/WeeklyEntryForm";

export default async function BranchEntriesPage() {
  const allowedBranchIds = await getAccessibleBranchIds();
  const branchWhere = allowedBranchIds === null
    ? { active: true }
    : { active: true, id: { in: allowedBranchIds } };
  const entryWhere = {
    type: { in: [InventoryEntryType.COMPRA, InventoryEntryType.AJUSTE] },
    ...(allowedBranchIds === null ? {} : { branchId: { in: allowedBranchIds } }),
  };

  const [branches, products, entries] = await Promise.all([
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
        id: true, code: true, name: true, category: true, unit: true,
        inventoryBaseUnit: true, handlingUnit: true, contentPerUnit: true,
        contentUnit: true, normalizedContentPerUnit: true,
      },
    }),
    prisma.inventoryEntry.findMany({
      where: entryWhere,
      orderBy: { entryDate: "desc" },
      take: 15,
      include: { branch: true, product: true },
    }),
  ]);

  const captureProducts: WeeklyProduct[] = products.map((product) => ({
    ...product,
    contentPerUnit: product.contentPerUnit === null ? null : Number(product.contentPerUnit),
    normalizedContentPerUnit: product.normalizedContentPerUnit === null
      ? null : Number(product.normalizedContentPerUnit),
  }));

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/administration/inventory/sucursales" className="inline-block text-sm font-semibold text-on-surface-variant hover:text-on-surface">
          ← Inventario de sucursales
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Entradas de inventario</h1>
            <p className="mt-2 text-sm text-on-surface-variant">
              Elige sucursal, captura las cantidades en la tabla y revisa el resumen antes de registrar.
            </p>
          </div>
          <Link href="/administration/inventory/branch-entries/adjustments" className="rounded-xl border border-outline-variant px-4 py-2.5 text-sm font-semibold hover:bg-surface-container-high">
            Ajustes y movimientos individuales
          </Link>
        </div>

        {branches.length === 0 ? (
          <p className="rounded-xl border border-outline-variant p-6">No tienes sucursales asignadas para registrar entradas.</p>
        ) : products.length === 0 ? (
          <p className="rounded-xl border border-outline-variant p-6">No hay productos activos con conteo semanal.</p>
        ) : (
          <WeeklyEntryForm branches={branches} products={captureProducts} />
        )}

        <section className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container">
          <div className="border-b border-outline-variant p-4">
            <h2 className="text-lg font-bold">Últimos movimientos</h2>
            <p className="text-xs text-on-surface-variant">Historial de entradas y ajustes, no sustituye al comprobante del registro recién guardado.</p>
          </div>
          {entries.length === 0 ? (
            <p className="p-4 text-sm text-on-surface-variant">No hay movimientos recientes.</p>
          ) : (
            <div className="divide-y divide-outline-variant">
              {entries.map((entry) => (
                <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <div>
                    <p className="font-semibold">{entry.product.name} · {entry.branch.name}</p>
                    <p className="text-xs text-on-surface-variant">{entry.type === "AJUSTE" ? "Ajuste" : "Entrada"} · {formatBusinessDate(entry.entryDate)}</p>
                  </div>
                  <div className="text-right font-semibold">
                    {Number(entry.quantity) > 0 ? "+" : ""}{Number(entry.originalQuantity ?? entry.quantity).toLocaleString("es-MX", { maximumFractionDigits: 3 })} {entry.originalUnit ?? entry.product.unit}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
