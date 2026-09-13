import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { BookIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/CompactUI";
import LiquorProductsTable from "@/components/liquors/LiquorProductsTable";

export default async function LiquorsHomePage() {
  const products = await prisma.liquorProduct.findMany({ orderBy: { name: "asc" }, include: { recipes: { select: { id: true } }, _count: { select: { batches: true } } } });
  return <main className="page-frame text-on-surface"><div className="mx-auto max-w-7xl"><PageHeader title="Catálogo de productos" description="Productos, recetas y trazabilidad." actions={<><Link href="/liquors/recipes" className="compact-action inline-flex items-center gap-2 border border-outline-variant font-semibold text-on-surface hover:bg-surface-container-high"><BookIcon className="h-4 w-4" />Ver recetas</Link><Link href="/liquors/products/new" className="compact-action inline-flex items-center bg-primary font-semibold text-on-primary">Nuevo producto</Link></>} /><LiquorProductsTable products={products.map((product) => ({ id: product.id, slug: product.slug, name: product.name, icon: product.icon, prefix: product.prefix, alcohol: product.defaultAlcohol, shelfLife: product.defaultShelfLifeDays, recipes: product.recipes.length, batches: product._count.batches, active: product.active }))} /></div></main>;
}
