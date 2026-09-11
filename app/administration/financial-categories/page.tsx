import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createFinancialCategoryAction, updateFinancialCategoryAction } from "./actions";

const input = "rounded border border-outline-variant bg-background px-2 py-1 text-sm";
const direction = (value: string) => value === "INCOME" ? "INCOME" : "EXPENSE";
const scope = (value: string) => value === "CASH" || value === "ENVELOPE" ? value : "BOTH";

export default async function FinancialCategoriesPage() {
  await requireAdmin();
  const categories = await prisma.financialMovementCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return <main className="mx-auto max-w-7xl space-y-6 p-6">
    <header><h1 className="text-2xl font-bold">Categorías de movimientos de dinero</h1><p className="text-sm text-on-surface-variant">Catálogo global para Caja y Sobres. Desactivar conserva el histórico y evita nuevos usos.</p></header>
    <form action={createFinancialCategoryAction} className="grid gap-2 rounded-xl border border-outline-variant p-4 sm:grid-cols-2 lg:grid-cols-4">
      <h2 className="font-semibold sm:col-span-2 lg:col-span-4">Nueva categoría</h2><input className={input} name="name" required placeholder="Pago de renta"/><input className={input} name="code" placeholder="Código estable opcional"/><input className={input} name="group" placeholder="Grupo opcional"/><input className={input} name="sortOrder" type="number" defaultValue="0" placeholder="Orden"/>
      <select className={input} name="direction" defaultValue="EXPENSE"><option value="INCOME">Entrada</option><option value="EXPENSE">Salida</option></select><select className={input} name="scope" defaultValue="BOTH"><option value="CASH">Caja</option><option value="ENVELOPE">Sobres</option><option value="BOTH">Caja y Sobres</option></select><label className="text-sm"><input type="checkbox" name="requiresReason"/> Requiere motivo</label><label className="text-sm"><input type="checkbox" name="requiresReceipt"/> Requiere comprobante</label><button className="rounded bg-primary px-3 py-2 font-semibold text-on-primary sm:col-span-2 lg:col-span-4">Crear categoría</button>
    </form>
    <section className="space-y-2">{categories.map((category) => <form key={category.id} action={updateFinancialCategoryAction} className="grid gap-2 rounded-xl border border-outline-variant p-3 sm:grid-cols-2 lg:grid-cols-8"><input type="hidden" name="id" value={category.id}/><div className="text-sm font-semibold lg:col-span-2"><input className={`${input} w-full`} name="name" defaultValue={category.name}/><p className="mt-1 text-xs text-on-surface-variant">{category.code}</p></div><select className={input} name="direction" defaultValue={direction(category.direction)}><option value="INCOME">Entrada</option><option value="EXPENSE">Salida</option></select><select className={input} name="scope" defaultValue={scope(category.scope)}><option value="CASH">Caja</option><option value="ENVELOPE">Sobres</option><option value="BOTH">Ambos</option></select><input className={input} name="group" defaultValue={category.group ?? ""} placeholder="Grupo"/><input className={input} name="sortOrder" type="number" defaultValue={category.sortOrder}/><label className="text-sm"><input type="checkbox" name="requiresReason" defaultChecked={category.requiresReason}/> Motivo</label><label className="text-sm"><input type="checkbox" name="requiresReceipt" defaultChecked={category.requiresReceipt}/> Comprobante</label><label className="text-sm"><input type="checkbox" name="isActive" defaultChecked={category.isActive}/> Activa</label><button className="rounded border border-primary px-3 py-1 text-sm font-semibold text-primary lg:col-span-8">Guardar</button></form>)}</section>
  </main>;
}
