import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PlusIcon } from "@/components/ui/icons";
import { formatDateOnly } from "@/lib/dateOnly";
import { getAccessibleBranchIds } from "@/lib/auth";
import { inventoryCountTypeLabel } from "@/lib/inventory/countScope";

export default async function BranchCountsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const requestedType = (await searchParams).type;
  const countType = requestedType === "MONTHLY" ? "MONTHLY" : "WEEKLY";
  const allowedBranchIds = await getAccessibleBranchIds();
  const counts = await prisma.inventoryCount.findMany({
    where: {
      ...(allowedBranchIds === null ? {} : { branchId: { in: allowedBranchIds } }),
      countType,
    },
    orderBy: { countDate: "desc" },
    include: { branch: true },
    take: 30,
  });

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{inventoryCountTypeLabel(countType)}</h1>
            <p className="mt-2 text-on-surface-variant">
              {countType === "WEEKLY"
                ? "Bebidas, insumos y consumibles clasificados para la operación semanal."
                : "Existencias amplias: suministros, equipo, mobiliario y productos operativos."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/administration/inventory/branch-counts/new?type=WEEKLY"
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
            >
              <PlusIcon className="h-4 w-4" />
              Nuevo semanal
            </Link>
            <Link
              href="/administration/inventory/branch-counts/new?type=MONTHLY"
              className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-sm font-semibold text-on-surface transition duration-150 ease-out hover:scale-[1.04] hover:border-primary/40 active:scale-[0.97]"
            >
              <PlusIcon className="h-4 w-4" />
              Nuevo mensual
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-outline-variant bg-surface-container divide-y divide-outline-variant">
          {counts.length === 0 && (
            <p className="p-6 text-sm text-on-surface-variant">Aún no hay conteos.</p>
          )}

          {counts.map((count) => (
            <Link
              key={count.id}
              href={`/administration/inventory/branch-counts/${count.id}`}
              className="flex items-center justify-between p-6 transition hover:bg-surface-container-high/50"
            >
              <div>
                <p className="font-semibold text-on-surface">{count.branch.name}</p>
                <p className="text-sm text-on-surface-variant">
                  {inventoryCountTypeLabel(count.countType)} · {formatDateOnly(count.countDate)}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs ${
                  count.status === "CERRADO"
                    ? "bg-tertiary-fixed-dim/20 text-tertiary-fixed-dim"
                    : "bg-secondary/20 text-secondary"
                }`}
              >
                {count.status === "CERRADO" ? "Cerrado" : "Borrador"}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
