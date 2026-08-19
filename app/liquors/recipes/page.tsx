import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ProcessTable from "@/components/production/ProcessTable";
import { PageHeader } from "@/components/ui/CompactUI";

export default async function LiquorRecipesPage() {
  const recipes = await prisma.liquorRecipe.findMany({
    orderBy: [
      {
        active: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
    include: {
      product: true,
      _count: {
        select: {
          ingredients: true,
          steps: true,
        },
      },
    },
  });

  return <main className="page-frame text-on-surface"><div className="mx-auto max-w-7xl"><PageHeader title="Recetas" description="Fórmulas, versiones y trazabilidad de elaboración." actions={<Link href="/liquors/recipes/new" className="compact-action inline-flex items-center bg-primary font-semibold text-on-primary">Nueva receta</Link>} /><ProcessTable emptyLabel="No hay recetas registradas." columns={[{ key: "code", label: "Receta", width: "19%" }, { key: "product", label: "Producto", width: "16%" }, { key: "version", label: "Versión", width: "10%" }, { key: "alcohol", label: "Alcohol objetivo", width: "13%" }, { key: "yield", label: "Rendimiento", width: "13%" }, { key: "ingredients", label: "Ingredientes", width: "12%" }, { key: "startedAt", label: "Actualización", width: "12%" }, { key: "status", label: "Estado", width: "12%" }]} filters={[{ key: "product", label: "Producto", options: [...new Set(recipes.map((item) => item.product.name))] }, { key: "version", label: "Versión", options: [...new Set(recipes.map((item) => String(item.version)))] }]} rows={recipes.map((item) => ({ id: item.id, href: `/liquors/recipes/${item.id}`, code: item.name, search: `${item.name} ${item.product.name}`, startedAt: item.updatedAt.toISOString(), status: item.active ? "Activa" : "Anterior", finished: !item.active, values: { product: item.product.name, version: String(item.version), alcohol: item.targetAlcohol === null ? "—" : `${formatNumber(item.targetAlcohol)}%`, yield: item.targetLiters === null ? "—" : `${formatNumber(item.targetLiters)} L`, ingredients: String(item._count.ingredients) }, filters: { product: item.product.name, version: String(item.version) } }))} /></div></main>;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 2,
  }).format(value);
}
