import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateOperationId } from "@/lib/pos2/operationId";
import { getPriceHistory } from "@/lib/pos2/pricing/history";
import { createPriceAction, endPriceAction } from "./actions";

const field = "rounded border border-outline-variant bg-background px-2 py-1";
const localDate = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export default async function PricingAdministrationPage({ searchParams }: { searchParams: Promise<{ branchId?: string; target?: string; at?: string }> }) {
  await requireAdmin();
  const query = await searchParams;
  const now = query.at ? new Date(query.at) : new Date();
  const [products, branches, history] = await Promise.all([
    prisma.posProduct.findMany({ where: { archivedAt: null }, include: { variants: { where: { active: true }, orderBy: { position: "asc" } } }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getPriceHistory({ branchId: query.branchId, at: now }),
  ]);
  return <main className="mx-auto max-w-7xl space-y-6 p-6">
    <header><h1 className="text-2xl font-bold">Pricing Engine POS 2.0</h1><p className="text-sm text-on-surface-variant">Precios base publicados, tax-inclusive, en MXN. V1 sigue operando con su precio legacy.</p></header>
    <section className="grid gap-4 lg:grid-cols-2">
      <form action={createPriceAction} className="space-y-3 rounded-xl border p-4"><h2 className="font-semibold">Publicar versión</h2><input type="hidden" name="operationId" value={generateOperationId()}/>
        <select className={field} name="target" required>{products.flatMap((product) => [<option key={`PRODUCT:${product.id}`} value={`PRODUCT:${product.id}`}>{product.name} (producto)</option>, ...product.variants.map((variant) => <option key={`VARIANT:${variant.id}`} value={`VARIANT:${variant.id}`}>{product.name} · {variant.name}</option>)])}</select>
        <select className={field} name="scope"><option value="GLOBAL">Global</option><option value="BRANCH">Sucursal</option></select>
        <select className={field} name="branchId"><option value="">Selecciona sucursal si aplica</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
        <input className={field} name="amount" type="number" min="0" step="0.01" required placeholder="Precio MXN"/>
        <label className="block text-sm">Desde <input className={field} name="validFrom" type="datetime-local" defaultValue={localDate(now)} required/></label>
        <label className="block text-sm">Hasta (opcional) <input className={field} name="validTo" type="datetime-local"/></label>
        <button className="rounded bg-primary px-3 py-2 text-on-primary">Publicar precio inmutable</button>
      </form>
      <form className="space-y-3 rounded-xl border p-4"><h2 className="font-semibold">Preview temporal</h2><select className={field} name="branchId" defaultValue={query.branchId}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select><input className={field} name="at" type="datetime-local" defaultValue={localDate(now)}/><button className="rounded border px-3 py-2">Ver estado efectivo</button><p className="text-sm text-on-surface-variant">La resolución operativa está disponible en <code>/api/pos2/pricing/resolve</code> y nunca devuelve cero por ausencia: responde <code>PRICE_NOT_CONFIGURED</code>.</p></form>
    </section>
    <section className="space-y-2"><h2 className="text-lg font-semibold">Historial publicado</h2>{history.length === 0 && <p className="text-sm">Todavía no hay versiones.</p>}{history.map((item) => <article key={item.id} className="grid gap-2 rounded-lg border p-3 text-sm lg:grid-cols-[2fr_1fr_1fr_2fr]">
      <div><strong>{item.variant ? `${item.variant.product.name} · ${item.variant.name}` : item.product?.name}</strong><div>{item.scope === "GLOBAL" ? "Global" : item.branch?.name}</div></div>
      <div>${item.amount} {item.currency}<br/><span className="font-semibold">{item.state}</span></div>
      <div>{item.validFrom.toLocaleString("es-MX")}<br/>{item.effectiveEnd ? `→ ${item.effectiveEnd.toLocaleString("es-MX")}` : "→ sin fin"}</div>
      {!item.termination && <form action={endPriceAction} className="flex flex-wrap gap-1"><input type="hidden" name="operationId" value={generateOperationId()}/><input type="hidden" name="priceVersionId" value={item.id}/><input className={field} name="effectiveAt" type="datetime-local" min={localDate(item.validFrom)} defaultValue={localDate(now > item.validFrom ? now : item.validFrom)} required/><input className={field} name="reason" minLength={3} required placeholder="Motivo explícito"/><button className="underline">Finalizar</button></form>}
    </article>)}</section>
  </main>;
}
