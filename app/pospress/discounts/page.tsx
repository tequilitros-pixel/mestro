import { prisma } from "@/lib/prisma";
import { deletePospressDiscountRule, savePospressDiscountRule } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Rule = Awaited<ReturnType<typeof loadRules>>[number];

async function loadRules() {
  return prisma.posDiscountRule.findMany({
    include: { branches: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

function RuleForm({ rule, branches }: { rule?: Rule; branches: Array<{ id: string; name: string }> }) {
  const selected = new Set(rule?.branches.map((branch) => branch.id) ?? []);
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
      <form action={savePospressDiscountRule} className="space-y-4">
        {rule && <input type="hidden" name="id" value={rule.id} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">Nombre
            <input name="name" required defaultValue={rule?.name} placeholder="Ej. Promoción 10%" className="mt-1 w-full rounded-xl border border-outline-variant bg-background px-3 py-2" />
          </label>
          <label className="text-sm font-semibold">Tipo
            <select name="mode" defaultValue={rule?.mode ?? "DISCOUNT"} className="mt-1 w-full rounded-xl border border-outline-variant bg-background px-3 py-2">
              <option value="DISCOUNT">Descuento disponible</option>
              <option value="BLOCK">Bloquear descuentos</option>
            </select>
          </label>
          <label className="text-sm font-semibold">Porcentaje
            <input name="percent" type="number" min="0.01" max="100" step="0.01" defaultValue={rule?.percent ?? ""} placeholder="Solo para descuento" className="mt-1 w-full rounded-xl border border-outline-variant bg-background px-3 py-2" />
          </label>
          <label className="flex items-center gap-2 self-end rounded-xl border border-outline-variant px-3 py-2 text-sm font-semibold">
            <input name="active" type="checkbox" defaultChecked={rule?.active ?? true} /> Activa
          </label>
          <label className="text-sm font-semibold">Desde
            <input name="startDate" type="date" defaultValue={rule?.startDate?.toISOString().slice(0, 10)} className="mt-1 w-full rounded-xl border border-outline-variant bg-background px-3 py-2" />
          </label>
          <label className="text-sm font-semibold">Hasta
            <input name="endDate" type="date" defaultValue={rule?.endDate?.toISOString().slice(0, 10)} className="mt-1 w-full rounded-xl border border-outline-variant bg-background px-3 py-2" />
          </label>
        </div>
        <fieldset>
          <legend className="text-sm font-semibold">Sucursales</legend>
          <p className="mb-2 text-xs text-on-surface-variant">Sin seleccionar ninguna se aplica a todas.</p>
          <div className="flex flex-wrap gap-2">
            {branches.map((branch) => (
              <label key={branch.id} className="rounded-full border border-outline-variant px-3 py-2 text-sm">
                <input className="mr-2" type="checkbox" name="branchId" value={branch.id} defaultChecked={selected.has(branch.id)} />
                {branch.name}
              </label>
            ))}
          </div>
        </fieldset>
        <button className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary">{rule ? "Guardar cambios" : "Crear regla"}</button>
      </form>
      {rule && (
        <form action={deletePospressDiscountRule} className="mt-3">
          <input type="hidden" name="id" value={rule.id} />
          <button className="text-sm font-semibold text-error">Eliminar regla</button>
        </form>
      )}
    </div>
  );
}

export default async function PospressDiscountsPage() {
  const [rules, branches] = await Promise.all([
    loadRules(),
    prisma.branch.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <main className="page-frame text-on-surface">
      <div className="mx-auto max-w-5xl space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Punto de venta</p>
          <h1 className="mt-1 text-2xl font-bold">Descuentos POSpress</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Configura promociones y bloqueos que se aplican al cobrar en POSpress.</p>
        </div>
        <RuleForm branches={branches} />
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Reglas configuradas</h2>
            <span className="rounded-full bg-surface-container-high px-3 py-1 text-xs font-semibold">{rules.length} reglas</span>
          </div>
          {rules.length ? rules.map((rule) => <RuleForm key={rule.id} rule={rule} branches={branches} />) : <p className="rounded-2xl border border-dashed border-outline-variant p-6 text-sm text-on-surface-variant">Aún no hay reglas de descuento.</p>}
        </section>
      </div>
    </main>
  );
}
