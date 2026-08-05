import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AddKitItemForm from "./AddKitItemForm";
import RemoveKitItemButton from "./RemoveKitItemButton";

export default async function EquipmentKitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const kit = await prisma.equipmentKit.findUnique({
    where: { id },
    include: {
      items: { include: { product: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  if (!kit) {
    notFound();
  }

  const equipment = await prisma.inventoryProduct.findMany({
    where: { isActive: true, itemType: "EQUIPMENT" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, unit: true },
  });

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold">{kit.name}</h1>
          <p className="mt-2 text-on-surface-variant">
            {kit.description || "Sin descripción"}
          </p>
        </div>

        <div className="rounded-2xl border border-outline-variant bg-surface-container divide-y divide-outline-variant">
          {kit.items.length === 0 && (
            <p className="p-6 text-sm text-on-surface-variant">
              Aún no hay equipo en esta modalidad.
            </p>
          )}
          {kit.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-on-surface">{item.product.name}</p>
                <p className="text-sm text-on-surface-variant">
                  {item.quantity.toString()} {item.product.unit}{" "}
                  {item.isRequired ? "· Obligatorio" : ""}
                </p>
              </div>
              <RemoveKitItemButton itemId={item.id} kitId={id} />
            </div>
          ))}
        </div>

        <AddKitItemForm kitId={id} products={equipment} />
      </div>
    </main>
  );
}
