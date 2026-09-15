import { prisma } from "@/lib/prisma";
import NewCountForm from "./NewCountForm";
import { getAccessibleBranchIds } from "@/lib/auth";
import { inventoryCountTypeLabel } from "@/lib/inventory/countScope";

export default async function NewCountPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const requestedType = (await searchParams).type;
  const countType = requestedType === "MONTHLY" ? "MONTHLY" : "WEEKLY";
  const allowedBranchIds = await getAccessibleBranchIds();
  const branches = await prisma.branch.findMany({
    where: {
      active: true,
      ...(allowedBranchIds === null ? {} : { id: { in: allowedBranchIds } }),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-lg space-y-8">
        <div>
          <h1 className="text-3xl font-bold">{inventoryCountTypeLabel(countType)}</h1>
          <p className="mt-3 text-on-surface-variant">
            {countType === "WEEKLY"
              ? "Incluye únicamente bebidas, insumos y consumibles clasificados para la operación semanal."
              : "Incluye todos los productos activos con seguimiento de stock, incluidos equipo y accesorios."}
          </p>
        </div>

        <NewCountForm branches={branches} defaultCountType={countType} />
      </div>
    </main>
  );
}
