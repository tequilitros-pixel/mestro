import Link from "next/link";
import { prisma } from "@/lib/prisma";
import NewPackageModal from "./NewPackageModal";
import DeletePackageButton from "./DeletePackageButton";

export default async function EventPackagesPage() {
  const [packages, products] = await Promise.all([prisma.eventPackage.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  }), prisma.inventoryProduct.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, code: true, name: true, category: true, unit: true } })]);

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Paquetes de eventos</h1>
            <p className="mt-3 text-on-surface-variant">
              Crea y edita los paquetes de Barra (chico, mediano, grande).
            </p>
          </div>

          <NewPackageModal products={products} />
        </div>

        <div className="rounded-2xl border border-outline-variant bg-surface-container">
          <div className="divide-y divide-outline-variant">
            {packages.length === 0 && (
              <p className="p-6 text-sm text-on-surface-variant">
                Aún no hay paquetes creados.
              </p>
            )}

            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="flex items-center justify-between gap-4 p-6"
              >
                <div>
                  <p className="font-semibold text-on-surface">{pkg.name}</p>
                  <p className="text-sm text-on-surface-variant">
                    {pkg._count.items} productos ·{" "}
                    {pkg.isActive ? "Activo" : "Inactivo"}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/administration/inventory/event-packages/${pkg.id}`}
                    className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-surface transition hover:border-primary/25 hover:bg-surface-container-high"
                  >
                    Editar
                  </Link>
                  <DeletePackageButton packageId={pkg.id} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
