import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import EditProductForm from "./EditProductForm";
import { getCurrentUser } from "@/lib/auth";
import { formatCommercialQuantity } from "@/lib/inventory/units";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  const product = await prisma.inventoryProduct.findUnique({
    where: { id },
  });

  if (!product) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href="/administration/inventory/products"
          className="inline-flex w-fit items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface"
        >
          ← Regresar a Productos
        </Link>

        {user?.role === "ADMIN" ? <EditProductForm
          product={{
            id: product.id,
            code: product.code,
            name: product.name,
            description: product.description,
            category: product.category,
            unit: product.unit,
            itemType: product.itemType,
            unitCost: product.unitCost !== null ? Number(product.unitCost) : null,
            minimumStock: Number(product.minimumStock),
            trackStock: product.trackStock,
            trackBatch: product.trackBatch,
            trackExpiration: product.trackExpiration,
            canBeSold: product.canBeSold,
            mustReturn: product.mustReturn,
            contentPerUnit: product.contentPerUnit !== null ? Number(product.contentPerUnit) : null,
            contentUnit: product.contentUnit,
          }}
        /> : <section className="space-y-5 rounded-2xl border border-outline-variant bg-surface-container p-6">
          <div><h2 className="text-xl font-bold text-on-surface">Detalle de producto</h2><p className="mt-1 text-sm text-on-surface-variant">Código: {product.code}</p></div>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-on-surface-variant">Nombre</dt><dd className="font-semibold">{product.name}</dd></div>
            <div><dt className="text-on-surface-variant">Categoría</dt><dd>{product.category}</dd></div>
            <div><dt className="text-on-surface-variant">Unidad comercial</dt><dd>{product.unit}</dd></div>
            <div><dt className="text-on-surface-variant">Tipo</dt><dd>{product.itemType}</dd></div>
            <div className="sm:col-span-2"><dt className="text-on-surface-variant">Presentación</dt><dd>{product.contentPerUnit !== null && product.contentUnit ? `1 ${product.unit.toLowerCase()} contiene ${product.contentPerUnit} ${product.contentUnit.toLowerCase()}` : "Sin presentación comercial configurada"}</dd></div>
            <div className="sm:col-span-2"><dt className="text-on-surface-variant">Referencia de una unidad</dt><dd>{formatCommercialQuantity(1, { trackStock: product.trackStock, itemType: product.itemType, inventoryBaseUnit: product.inventoryBaseUnit, handlingUnit: product.handlingUnit, contentPerUnit: product.contentPerUnit, contentUnit: product.contentUnit, normalizedContentPerUnit: product.normalizedContentPerUnit })}</dd></div>
            <div><dt className="text-on-surface-variant">Estado</dt><dd>{product.isActive ? "Activo" : "Inactivo"}</dd></div>
          </dl>
        </section>}
      </div>
    </main>
  );
}
