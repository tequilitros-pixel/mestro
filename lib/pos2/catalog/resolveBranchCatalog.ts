import "server-only";
import { prisma } from "@/lib/prisma";
import { resolveEffectiveProduct } from "./domain";

export async function resolveBranchCatalog(branchId: string, options: { includeHidden?: boolean; search?: string } = {}) {
  const search = options.search?.trim();
  const categories = await prisma.posCategory.findMany({
    where: { active: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: { products: {
      where: search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { sku: { contains: search, mode: "insensitive" } }, { internalCode: { contains: search, mode: "insensitive" } }, { barcode: { contains: search, mode: "insensitive" } }] } : undefined,
      include: {
        variants: { where: { active: true }, orderBy: [{ position: "asc" }, { name: "asc" }] },
        branchOverrides: { where: { branchId }, take: 1 },
      },
    } },
  });
  return categories.map((category) => ({
    id: category.id, name: category.name, slug: category.slug, position: category.position, icon: category.icon, imageAlt: category.imageAlt,
    products: category.products
      .map((product) => resolveEffectiveProduct(product, product.branchOverrides[0] ?? null))
      .filter((product) => options.includeHidden || product.effective.visibleInPos)
      .sort((a, b) => a.effective.sortOrder - b.effective.sortOrder || a.name.localeCompare(b.name))
      .map((effectiveProduct) => {
        const { branchOverrides, ...product } = effectiveProduct;
        void branchOverrides;
        return {
          ...product,
          image: product.icon ? { reference: product.icon, alt: product.imageAlt || product.name } : null,
          variants: product.variants.map((variant) => ({ ...variant, legacyPrice: variant.price })),
        };
      }),
  })).filter((category) => options.includeHidden || category.products.length > 0);
}
