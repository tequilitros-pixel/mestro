import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import EditProductForm from "./EditProductForm";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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

        <EditProductForm
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
          }}
        />
      </div>
    </main>
  );
}
