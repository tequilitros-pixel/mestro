import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EditPackageForm from "./EditPackageForm";
import PackageItemsManager from "./PackageItemsManager";

export default async function EventPackageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const eventPackage = await prisma.eventPackage.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!eventPackage) {
    notFound();
  }

  const products = await prisma.inventoryProduct.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, unit: true, category: true },
  });

  const items = eventPackage.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    quantity: Number(item.quantity),
    calculationType: item.calculationType,
    isRequired: item.isRequired,
    guestsPerBlock: item.guestsPerBlock,
  }));

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold">{eventPackage.name}</h1>
          <p className="mt-2 text-on-surface-variant">
            {eventPackage.description || "Sin descripción"}
          </p>
        </div>

        <EditPackageForm
          pkg={{
            id: eventPackage.id,
            name: eventPackage.name,
            description: eventPackage.description,
            pricePerPerson:
              eventPackage.pricePerPerson !== null
                ? Number(eventPackage.pricePerPerson)
                : null,
            includedHours: eventPackage.includedHours,
            minimumGuests: eventPackage.minimumGuests,
            isActive: eventPackage.isActive,
          }}
        />

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-on-surface">Productos del paquete</h2>

          <PackageItemsManager packageId={id} products={products} items={items} />
        </section>
      </div>
    </main>
  );
}
