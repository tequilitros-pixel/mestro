import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds, getCurrentUser } from "@/lib/auth";
import EntryForm from "../EntryForm";

export default async function InventoryAdjustmentsPage() {
  const [allowedBranchIds, user] = await Promise.all([getAccessibleBranchIds(), getCurrentUser()]);
  const branchWhere = allowedBranchIds === null
    ? { active: true }
    : { active: true, id: { in: allowedBranchIds } };
  const canViewTransfers = user?.role === "ADMIN" || Boolean(user && await prisma.modulePermission.findUnique({
    where: { userId_moduleKey: { userId: user.id, moduleKey: "/administration/inventory/sucursales/traspasos" } },
    select: { id: true },
  }));
  const [branches, products] = await Promise.all([
    prisma.branch.findMany({ where: branchWhere, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.inventoryProduct.findMany({
      where: { isActive: true, archivedAt: null, trackStock: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, category: true, unit: true },
    }),
  ]);

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/administration/inventory/branch-entries" className="inline-block text-sm font-semibold text-on-surface-variant hover:text-on-surface">
          ← Volver a tabla de entradas
        </Link>
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Ajustes y movimientos individuales</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Úsalo sólo para una corrección, merma o movimiento especial. Las compras normales se capturan en la tabla.
          </p>
        </div>
        {branches.length > 0 ? (
          <EntryForm branches={branches} products={products} canViewTransfers={canViewTransfers} />
        ) : (
          <p className="rounded-xl border border-outline-variant p-6">No tienes sucursales asignadas.</p>
        )}
      </div>
    </main>
  );
}
