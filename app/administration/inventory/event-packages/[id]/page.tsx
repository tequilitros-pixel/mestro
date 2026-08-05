import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AddPackageItemForm from "./AddPackageItemForm";
import RemoveItemButton from "./RemoveItemButton";
import EditPackageForm from "./EditPackageForm";
import { PackageIcon, ToolboxIcon } from "@/components/ui/icons";


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
        include: { product: true },
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
    select: { id: true, name: true, unit: true, itemType: true },
  });

  const consumables = products.filter((p) => p.itemType !== "EQUIPMENT");
  const equipment = products.filter((p) => p.itemType === "EQUIPMENT");

  const consumableItems = eventPackage.items.filter(
    (item) => item.product.itemType !== "EQUIPMENT",
  );
  const equipmentItems = eventPackage.items.filter(
    (item) => item.product.itemType === "EQUIPMENT",
  );

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
          <h2 className="flex items-center gap-2 text-xl font-bold text-on-surface">
            <PackageIcon className="h-5 w-5 text-on-surface-variant" />
            Inventario consumible / retornable
          </h2>

          <div className="rounded-2xl border border-outline-variant bg-surface-container divide-y divide-outline-variant">
            {consumableItems.length === 0 && (
              <p className="p-6 text-sm text-on-surface-variant">
                Aún no hay productos consumibles en este paquete.
              </p>
            )}
            {consumableItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-on-surface">{item.product.name}</p>
                  <p className="text-sm text-on-surface-variant">
                    {item.quantity.toString()} {item.product.unit} ·{" "}
                    {item.calculationType} {item.isRequired ? "· Obligatorio" : ""}
                  </p>
                </div>
                <RemoveItemButton itemId={item.id} packageId={id} />
              </div>
            ))}
          </div>

          <AddPackageItemForm
            packageId={id}
            products={consumables}
            title="Agregar producto consumible"
          />
        </section>

        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-xl font-bold text-on-surface">
            <ToolboxIcon className="h-5 w-5 text-on-surface-variant" />
            Equipo a subir
          </h2>

          <div className="rounded-2xl border border-outline-variant bg-surface-container divide-y divide-outline-variant">
            {equipmentItems.length === 0 && (
              <p className="p-6 text-sm text-on-surface-variant">
                Aún no hay equipo en este paquete.
              </p>
            )}
            {equipmentItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-on-surface">{item.product.name}</p>
                  <p className="text-sm text-on-surface-variant">
                    {item.quantity.toString()} {item.product.unit}{" "}
                    {item.isRequired ? "· Obligatorio" : ""}
                  </p>
                </div>
                <RemoveItemButton itemId={item.id} packageId={id} />
              </div>
            ))}
          </div>

          <AddPackageItemForm
            packageId={id}
            products={equipment}
            title="Agregar equipo"
          />
        </section>
      </div>
    </main>
  );
}
