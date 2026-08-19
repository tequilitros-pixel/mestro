import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deletePosDiscountRule, savePosDiscountRule } from "@/app/actions/posDiscountRules";
import { Card } from "@/components/ui/Card";

function RuleForm({ rule, branches }: { rule?: Awaited<ReturnType<typeof loadRules>>[number]; branches: Array<{ id: string; name: string }> }) {
  const selected = new Set(rule?.branches.map((branch) => branch.id) ?? []);
  return (
    <Card>
      <form action={savePosDiscountRule} className="space-y-4">
        {rule && <input type="hidden" name="id" value={rule.id} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold text-on-surface">Nombre<input name="name" required defaultValue={rule?.name} placeholder="Ej. Promoción 10%" className="mt-1 w-full rounded-xl border border-outline-variant bg-background px-3 py-2" /></label>
          <label className="text-sm font-semibold text-on-surface">Tipo<select name="mode" defaultValue={rule?.mode ?? "DISCOUNT"} className="mt-1 w-full rounded-xl border border-outline-variant bg-background px-3 py-2"><option value="DISCOUNT">Descuento disponible</option><option value="BLOCK">Bloquear descuentos</option></select></label>
          <label className="text-sm font-semibold text-on-surface">Porcentaje<input name="percent" type="number" min="0.01" max="100" step="0.01" defaultValue={rule?.percent ?? ""} placeholder="Solo para descuento" className="mt-1 w-full rounded-xl border border-outline-variant bg-background px-3 py-2" /></label>
          <label className="flex items-center gap-2 self-end rounded-xl border border-outline-variant px-3 py-2 text-sm font-semibold"><input name="active" type="checkbox" defaultChecked={rule?.active ?? true} /> Activa</label>
          <label className="text-sm font-semibold text-on-surface">Desde<input name="startDate" type="date" defaultValue={rule?.startDate?.toISOString().slice(0, 10)} className="mt-1 w-full rounded-xl border border-outline-variant bg-background px-3 py-2" /></label>
          <label className="text-sm font-semibold text-on-surface">Hasta<input name="endDate" type="date" defaultValue={rule?.endDate?.toISOString().slice(0, 10)} className="mt-1 w-full rounded-xl border border-outline-variant bg-background px-3 py-2" /></label>
        </div>
        <fieldset><legend className="text-sm font-semibold text-on-surface">Sucursales</legend><p className="mb-2 text-xs text-on-surface-variant">Sin seleccionar ninguna se aplica a todas.</p><div className="flex flex-wrap gap-2">{branches.map((branch) => <label key={branch.id} className="rounded-full border border-outline-variant px-3 py-2 text-sm"><input className="mr-2" type="checkbox" name="branchId" value={branch.id} defaultChecked={selected.has(branch.id)} />{branch.name}</label>)}</div></fieldset>
        <button className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary">{rule ? "Guardar cambios" : "Crear regla"}</button>
      </form>
      {rule && <form action={deletePosDiscountRule} className="mt-3"><input type="hidden" name="id" value={rule.id} /><button className="text-sm font-semibold text-error">Eliminar regla</button></form>}
    </Card>
  );
}

async function loadRules() {
  return prisma.posDiscountRule.findMany({ include: { branches: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } });
}

export default async function DiscountRulesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/pos/discounts/courtesies");
  const [rules, branches] = await Promise.all([loadRules(), prisma.branch.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })]);
  return <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6"><div><Link href="/pos/discounts/courtesies" className="text-sm font-semibold text-primary">← Reportes de descuentos</Link><h1 className="mt-2 text-3xl font-bold text-on-surface">Administrar descuentos</h1><p className="mt-2 text-sm text-on-surface-variant">Crea promociones o bloquea cualquier descuento por sucursal y periodo.</p></div><RuleForm branches={branches} /><section className="space-y-3"><h2 className="text-xl font-bold text-on-surface">Reglas actuales</h2>{rules.length ? rules.map((rule) => <RuleForm key={rule.id} rule={rule} branches={branches} />) : <Card><p className="text-sm text-on-surface-variant">Aún no hay reglas configuradas.</p></Card>}</section></main>;
}
