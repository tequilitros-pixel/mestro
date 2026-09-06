import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveBranchCatalog } from "@/lib/pos2/catalog/resolveBranchCatalog";

export default async function CatalogPreviewPage({ searchParams }: { searchParams: Promise<{ branchId?: string }> }) {
  await requireAdmin();
  const branches = await prisma.branch.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const requested = (await searchParams).branchId;
  const branchId = branches.some((branch) => branch.id === requested) ? requested! : branches[0]?.id;
  const catalog = branchId ? await resolveBranchCatalog(branchId) : [];
  return <main className="mx-auto max-w-6xl space-y-6 p-6"><header><Link href="/administration/pos2/catalog" className="text-sm text-primary underline">← Administrar catálogo</Link><h1 className="text-2xl font-bold">Preview de catálogo efectivo</h1></header><form><select name="branchId" defaultValue={branchId} className="rounded border p-2">{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select><button className="ml-2 rounded bg-primary px-3 py-2 text-on-primary">Ver sucursal</button></form>{catalog.map((category) => <section key={category.id}><h2 className="mb-2 text-lg font-semibold">{category.name}</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{category.products.map((product) => <article key={product.id} className="rounded-xl border p-3"><div className="text-2xl">{product.icon || "◻︎"}</div><h3 className="font-semibold">{product.name}</h3><p className="text-xs text-on-surface-variant">{product.sku || product.internalCode || "Sin código"} · {product.baseUnit}</p><ul className="mt-2 text-sm">{product.variants.map((variant) => <li key={variant.id}>{variant.name} · ${variant.legacyPrice.toFixed(2)} legacy</li>)}</ul></article>)}</div></section>)}</main>;
}
