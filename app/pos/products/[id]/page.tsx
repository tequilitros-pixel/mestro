import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProductForm from "@/components/pos/ProductForm";
import { ChevronLeftIcon } from "@/components/ui/icons";

export default async function EditPosProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [product, categories, inventoryProducts] = await Promise.all([
    prisma.posProduct.findUnique({
      where: { id },
      include: {
        variants: {
          orderBy: { position: "asc" },
          include: { ingredients: true },
        },
      },
    }),
    prisma.posCategory.findMany({
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    }),
    prisma.inventoryProduct.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, unit: true },
    }),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <Link
          href="/pos/products"
          className="mb-2 inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Productos
        </Link>
        <h1 className="text-2xl font-bold text-on-surface">{product.name}</h1>
      </div>

      <ProductForm
        categories={categories}
        inventoryProducts={inventoryProducts}
        initialProduct={{
          id: product.id,
          categoryId: product.categoryId,
          name: product.name,
          icon: product.icon,
          variants: product.variants.map((v) => ({
            id: v.id,
            name: v.name,
            price: v.price,
            ingredients: v.ingredients.map((i) => ({
              inventoryProductId: i.inventoryProductId,
              quantity: Number(i.quantity),
            })),
          })),
        }}
      />
    </div>
  );
}
