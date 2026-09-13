import Link from "next/link";
import { prisma } from "@/lib/prisma";
import EquipmentKitForm from "./EquipmentKitForm";
import { ChevronRightIcon } from "@/components/ui/icons";

export default async function EquipmentKitsPage() {
  const kits = await prisma.equipmentKit.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Modalidades de equipo</h1>
          <p className="mt-3 text-on-surface-variant">
            Toldo, remolque, u otra forma de trabajar. Cada una tiene su propia
            lista de equipo.
          </p>
        </div>

        <EquipmentKitForm />

        <div className="rounded-2xl border border-outline-variant bg-surface-container">
          <div className="border-b border-outline-variant p-6">
            <h2 className="text-xl font-bold text-on-surface">Modalidades existentes</h2>
          </div>

          <div className="divide-y divide-outline-variant">
            {kits.length === 0 && (
              <p className="p-6 text-sm text-on-surface-variant">
                Aún no hay modalidades creadas.
              </p>
            )}

            {kits.map((kit) => (
              <Link
                key={kit.id}
                href={`/administration/inventory/equipment-kits/${kit.id}`}
                className="flex items-center justify-between p-6 transition hover:bg-surface-container-high/50"
              >
                <div>
                  <p className="font-semibold text-on-surface">{kit.name}</p>
                  <p className="text-sm text-on-surface-variant">
                    {kit._count.items} artículos ·{" "}
                    {kit.isActive ? "Activo" : "Inactivo"}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-sm text-on-surface-variant">
                  Editar
                  <ChevronRightIcon className="h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
