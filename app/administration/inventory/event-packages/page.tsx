import Link from "next/link";
import { prisma } from "@/lib/prisma";
import EventPackageForm from "./EventPackageForm";

export default async function EventPackagesPage() {
  const packages = await prisma.eventPackage.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Paquetes de eventos</h1>
          <p className="mt-3 text-on-surface-variant">
            Crea y edita los paquetes de Barra (chico, mediano, grande).
          </p>
        </div>

        <EventPackageForm />

        <div className="rounded-2xl border border-outline-variant bg-surface-container">
          <div className="border-b border-outline-variant p-6">
            <h2 className="text-xl font-bold text-on-surface">Paquetes existentes</h2>
          </div>

          <div className="divide-y divide-outline-variant">
            {packages.length === 0 && (
              <p className="p-6 text-sm text-on-surface-variant">
                Aún no hay paquetes creados.
              </p>
            )}

            {packages.map((pkg) => (
              <Link
                key={pkg.id}
                href={`/administration/inventory/event-packages/${pkg.id}`}
                className="flex items-center justify-between p-6 transition hover:bg-surface-container-high/50"
              >
                <div>
                  <p className="font-semibold text-on-surface">{pkg.name}</p>
                  <p className="text-sm text-on-surface-variant">
                    {pkg._count.items} productos ·{" "}
                    {pkg.isActive ? "Activo" : "Inactivo"}
                  </p>
                </div>
                <span className="text-sm text-on-surface-variant">Editar →</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
