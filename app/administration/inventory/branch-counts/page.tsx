import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PlusIcon } from "@/components/ui/icons";

export default async function BranchCountsPage() {
  const counts = await prisma.inventoryCount.findMany({
    orderBy: { countDate: "desc" },
    include: { branch: true },
    take: 30,
  });

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Conteos semanales</h1>
            <p className="mt-2 text-on-surface-variant">
              Conteo por sucursal, cada lunes, para calcular el consumo de la semana.
            </p>
          </div>

          <Link
            href="/administration/inventory/branch-counts/new"
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
          >
            <PlusIcon className="h-4 w-4" />
            Nuevo conteo
          </Link>
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
                  {new Date(count.countDate).toLocaleDateString("es-MX")}
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
