import { prisma } from "@/lib/prisma";
import PosCatalogManager from "@/components/pospress/PosCatalogManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PosCatalogPage() {
  const [categories, inventoryProducts] = await Promise.all([
    prisma.posCategory.findMany({
      where: { active: true },
      orderBy: { position: "asc" },
      include: {
        products: {
          where: { active: true },
          orderBy: { position: "asc" },
          include: {
            variants: {
              where: { active: true },
              orderBy: { position: "asc" },
              include: {
                ingredients: {
                  include: { inventoryProduct: { select: { name: true } } },
                },
              },
            },
          },
        },
      },
    }),
    prisma.inventoryProduct.findMany({
      where: { isActive: true, trackStock: true, inventoryBaseUnit: { not: null } },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, unit: true, inventoryBaseUnit: true },
    }),
  ]);

  return (
    <PosCatalogManager
      categories={categories.map((category) => ({
        id: category.id,
        name: category.name,
        products: category.products.map((product) => ({
          id: product.id,
          name: product.name,
          description: product.description,
          inventoryTracked: product.inventoryTracked,
          variants: product.variants.map((variant) => ({
            id: variant.id,
            name: variant.name,
            price: variant.price,
            baseUnit: variant.baseUnit,
            ingredients: variant.ingredients.map((ingredient) => ({
              inventoryProductId: ingredient.inventoryProductId,
              quantity: ingredient.quantity.toString(),
              unit: ingredient.unit,
              inventoryProduct: ingredient.inventoryProduct,
            })),
          })),
        })),
      }))}
      inventoryProducts={inventoryProducts}
    />
  );
}
