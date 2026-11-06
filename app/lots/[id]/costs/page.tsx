import { getProductionVolume } from "@/lib/lots/productionVolume";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import LotMenu from "@/components/LotMenu";
import { requireModuleActionAccess } from "@/lib/auth";
import LotCostCharts from "@/components/costs/LotCostCharts";
import { calculateStageCostsAndWIP } from "@/lib/processCalculations";
import PageTabs, { type PageTab } from "@/components/ui/PageTabs";
import {
  CoinsIcon,
  AgaveIcon,
  FlameIcon,
  GearIcon,
  FlaskIcon,
  StillIcon,
  PlusIcon,
} from "@/components/ui/icons";
import type { ReactNode } from "react";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tab?: string }>;
};

const STAGE_FILTERS = {
  materiaPrima: ["Materia prima", "Transporte", "Agave", "Flete", "Jima"],
  cocimiento: ["Cocción", "Cocimiento", "Gas", "Caldera"],
  molienda: ["Molienda", "Agua"],
  fermentacion: ["Fermentación", "Levadura", "Nutrientes"],
  destilacion: ["Destilación", "Alambique"],
};

function matchesStage(category: string, filterList: string[]) {
  return filterList.some((c) => c.toLowerCase() === (category || "").toLowerCase());
}

function getCategoryBadgeClass(category: string) {
  const cat = (category || "").toLowerCase();
  if (
    cat.includes("materia") ||
    cat.includes("agave") ||
    cat.includes("transporte") ||
    cat.includes("flete") ||
    cat.includes("jima")
  ) {
    return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
  }
  if (
    cat.includes("cocc") ||
    cat.includes("cocim") ||
    cat.includes("gas") ||
    cat.includes("caldera")
  ) {
    return "bg-amber-500/10 text-amber-400 border-amber-500/30";
  }
  if (cat.includes("mol") || cat.includes("agua")) {
    return "bg-yellow-500/10 text-yellow-400 border-yellow-500/30";
  }
  if (
    cat.includes("ferm") ||
    cat.includes("leva") ||
    cat.includes("nutri")
  ) {
    return "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
  }
  if (cat.includes("dest") || cat.includes("alamb")) {
    return "bg-purple-500/10 text-purple-400 border-purple-500/30";
  }
  return "bg-blue-500/10 text-blue-400 border-blue-500/30";
}

export default async function LotCostsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab: activeTabParam } = (await searchParams) || {};

  const lot = await prisma.lot.findUnique({
    where: { id },
    include: {
      expenses: { orderBy: { createdAt: "desc" } },
      cookings: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } },
      millings: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } },
      fermentations: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } },
      distillations: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!lot) notFound();

  // Filtrado de gastos por etapa
  const materiaPrimaExpenses = lot.expenses.filter((e) =>
    matchesStage(e.category, STAGE_FILTERS.materiaPrima)
  );
  const cocimientoExpenses = lot.expenses.filter((e) =>
    matchesStage(e.category, STAGE_FILTERS.cocimiento)
  );
  const moliendaExpenses = lot.expenses.filter((e) =>
    matchesStage(e.category, STAGE_FILTERS.molienda)
  );
  const fermentacionExpenses = lot.expenses.filter((e) =>
    matchesStage(e.category, STAGE_FILTERS.fermentacion)
  );
  const destilacionExpenses = lot.expenses.filter((e) =>
    matchesStage(e.category, STAGE_FILTERS.destilacion)
  );
  const otrosExpenses = lot.expenses.filter(
    (e) =>
      !matchesStage(e.category, STAGE_FILTERS.materiaPrima) &&
      !matchesStage(e.category, STAGE_FILTERS.cocimiento) &&
      !matchesStage(e.category, STAGE_FILTERS.molienda) &&
      !matchesStage(e.category, STAGE_FILTERS.fermentacion) &&
      !matchesStage(e.category, STAGE_FILTERS.destilacion)
  );

  // Subtotales por etapa
  const materiaPrimaSubtotal = materiaPrimaExpenses.reduce((sum, e) => sum + e.amount, 0);
  const cocimientoSubtotal = cocimientoExpenses.reduce((sum, e) => sum + e.amount, 0);
  const moliendaSubtotal = moliendaExpenses.reduce((sum, e) => sum + e.amount, 0);
  const fermentacionSubtotal = fermentacionExpenses.reduce((sum, e) => sum + e.amount, 0);
  const destilacionSubtotal = destilacionExpenses.reduce((sum, e) => sum + e.amount, 0);
  const otrosSubtotal = otrosExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Costo total conjugado de todas las pestañas
  const totalCost = lot.expenses.reduce((sum, e) => sum + e.amount, 0);

  // Volumen y rendimiento
  const totalLiters = getProductionVolume(lot) ?? 0;
  const isFinished = getProductionVolume(lot) !== null;
  const costPerLiter = totalLiters > 0 ? totalCost / totalLiters : 0;
  const abcCosts = calculateStageCostsAndWIP(lot.expenses, lot.stage);

  const rectifiedRuns = lot.distillations.filter((d) => d.type === "RECTIFICACION" && d.status === "TERMINADA");
  const totalLAA = rectifiedRuns.reduce((sum, d) => {
    const lts = d.finalLiters ?? d.heartLiters ?? 0;
    const alc = d.finalAlcohol ?? 40;
    return sum + (lts * alc) / 100;
  }, 0);
  const costPerLAA = totalLAA > 0 ? totalCost / totalLAA : 0;

  async function addExpense(formData: FormData) {
    "use server";

    await requireModuleActionAccess("/lots");

    const category = formData.get("category") as string;
    const concept = formData.get("concept") as string;
    const amount = Number(formData.get("amount") || 0);
    const notes = formData.get("notes") as string;
    const currentTab = formData.get("tab") as string;

    if (!category?.trim() || !concept?.trim() || !Number.isFinite(amount) || amount <= 0) {
      throw new Error("Ingresa una categoría, concepto y monto mayor a cero.");
    }

    await prisma.lotExpense.create({
      data: {
        lotId: id,
        category: category.trim(),
        concept: concept.trim(),
        amount,
        notes: notes || null,
      },
    });

    redirect(`/lots/${id}/costs${currentTab ? `?tab=${currentTab}` : ""}`);
  }

  // --- CONTENIDO DE LAS PESTAÑAS ---

  // 1. Pestaña: Resumen General (Conjugación total de gastos)
  const tabResumenGeneralContent = (
    <div className="space-y-8">
      {/* KPIs Globales */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          title="Costo total acumulado"
          value={`$${totalCost.toLocaleString("es-MX", { maximumFractionDigits: 2 })}`}
          subtitle="Conjugación de todas las etapas"
        />
        <Card
          title="Litros obtenidos"
          value={isFinished ? `${totalLiters.toFixed(2)} L` : "En proceso"}
          subtitle={isFinished ? "Lote finalizado" : "Pendiente de rectificación"}
        />
        <Card
          title="Costo por litro"
          value={costPerLiter > 0 ? `$${costPerLiter.toFixed(2)}/L` : "—"}
          subtitle="Costo unitario tequila final"
        />
        <Card
          title="Costo por LAA (Puro)"
          value={costPerLAA > 0 ? `$${costPerLAA.toFixed(2)}/LAA` : "—"}
          subtitle="Litro de Alcohol Anhidro"
        />
      </section>

      {/* Costeo Basado en Actividades (ABC) */}
      <section className="rounded-2xl border border-outline-variant bg-surface-container p-6 sm:p-8">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-on-surface">Costeo Basado en Actividades (ABC)</h2>
            <p className="mt-1 text-xs text-on-surface-variant">
              Distribución del gasto conjugado entre las 5 etapas del tequila y gastos generales.
            </p>
          </div>
          <span className="self-start rounded-lg bg-surface-container-high px-3 py-1 font-mono text-xs font-semibold text-primary sm:self-auto">
            Etapa actual: {lot.stage}
          </span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StageSummaryBox
            title="1. Materia Prima (Agave)"
            amount={materiaPrimaSubtotal}
            totalCost={totalCost}
            detail="Compra, flete y jima"
            colorClass="text-emerald-500"
          />
          <StageSummaryBox
            title="2. Cocimiento"
            amount={cocimientoSubtotal}
            totalCost={totalCost}
            detail="Vapor, gas y calderas"
            colorClass="text-amber-500"
          />
          <StageSummaryBox
            title="3. Molienda y Extracción"
            amount={moliendaSubtotal}
            totalCost={totalCost}
            detail="Agua, tren y cuchillas"
            colorClass="text-yellow-500"
          />
          <StageSummaryBox
            title="4. Fermentación"
            amount={fermentacionSubtotal}
            totalCost={totalCost}
            detail="Levaduras y nutrientes"
            colorClass="text-cyan-500"
          />
          <StageSummaryBox
            title="5. Destilación"
            amount={destilacionSubtotal}
            totalCost={totalCost}
            detail="Destrozado y rectificación"
            colorClass="text-purple-500"
          />
          <StageSummaryBox
            title="Mano de Obra y Generales"
            amount={otrosSubtotal}
            totalCost={totalCost}
            detail="Indirectos y otros gastos"
            colorClass="text-blue-500"
          />
        </div>
      </section>

      {/* Gráficas de Costos */}
      <LotCostCharts expenses={lot.expenses} />

      {/* Formulario para registrar gasto general / cualquier categoría */}
      <section className="rounded-2xl border border-outline-variant bg-surface-container p-6 sm:p-8">
        <h2 className="text-xl font-bold text-on-surface">Registrar gasto directo / general</h2>
        <p className="mt-1 text-xs text-on-surface-variant">
          Registra un gasto general del lote o selecciona la etapa correspondiente.
        </p>

        <form action={addExpense} className="mt-6 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="tab" value="resumen" />

          <div>
            <label className="mb-1 block text-xs font-medium text-on-surface-variant">Categoría</label>
            <select
              name="category"
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-2.5 text-sm text-on-surface outline-none transition focus:border-primary"
            >
              <option value="Materia prima">Materia prima (Agave)</option>
              <option value="Cocción">Cocción / Horno</option>
              <option value="Molienda">Molienda y Extracción</option>
              <option value="Fermentación">Fermentación</option>
              <option value="Destilación">Destilación</option>
              <option value="Transporte">Transporte / Flete</option>
              <option value="Mano de obra">Mano de obra</option>
              <option value="Envasado">Envasado</option>
              <option value="Otros">Otros</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-on-surface-variant">Concepto</label>
            <input
              name="concept"
              placeholder="Ej. Jornal de destilería, insumos generales"
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-2.5 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-on-surface-variant">Monto ($ MXN)</label>
            <input
              name="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-2.5 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-on-surface-variant">Observaciones</label>
            <input
              name="notes"
              placeholder="Notas u orden de compra (opcional)"
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-2.5 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
            />
          </div>

          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-on-primary shadow transition hover:opacity-95 active:scale-[0.98] sm:col-span-2"
          >
            <PlusIcon className="h-4 w-4" />
            Guardar gasto en el lote
          </button>
        </form>
      </section>

      {/* Historial consolidado de todos los gastos */}
      <section className="rounded-2xl border border-outline-variant bg-surface-container p-6 sm:p-8">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-on-surface">Historial conjugado de gastos</h2>
            <p className="mt-1 text-xs text-on-surface-variant">
              Todos los gastos registrados en las distintas pestañas conjugados cronológicamente ({lot.expenses.length} registros).
            </p>
          </div>
          <span className="font-mono text-sm font-bold text-primary">
            Total: ${totalCost.toLocaleString("es-MX", { maximumFractionDigits: 2 })} MXN
          </span>
        </div>

        <div className="mt-6">
          <ExpensesTable
            expenses={lot.expenses}
            showCategoryBadge
          />
        </div>
      </section>
    </div>
  );

  // 2. Pestaña: Materia Prima (Agave)
  const tabMateriaPrimaContent = (
    <StageCostSection
      title="Materia Prima (Agave)"
      subtitle="Compra de piñas de Agave Tequilana Weber, flete de campo a fábrica, cuadrillas de corte y jima, pesaje en báscula y maniobras de descarga."
      icon={<AgaveIcon className="h-6 w-6 text-emerald-400" />}
      subtotal={materiaPrimaSubtotal}
      totalCost={totalCost}
      unitCostLabel={lot.agaveKg > 0 ? "Costo por kg de agave crudo" : undefined}
      unitCostValue={
        lot.agaveKg > 0
          ? `$${(materiaPrimaSubtotal / lot.agaveKg).toFixed(2)}/kg`
          : undefined
      }
      extraInfo={
        lot.agaveKg > 0
          ? `Agave total registrado: ${lot.agaveKg.toLocaleString()} kg`
          : undefined
      }
      stageTabKey="materia-prima"
      categoryOptions={["Materia prima", "Transporte"]}
      conceptSuggestions={[
        "Agave Tequilana Weber (Compra piñas)",
        "Flete de agave campo a fábrica",
        "Cuadrilla de jima y descorone",
        "Báscula y descarga de camión",
        "Agave propio (Costo de producción)",
      ]}
      expenses={materiaPrimaExpenses}
      addExpenseAction={addExpense}
    />
  );

  // 3. Pestaña: Cocimiento
  const tabCocimientoContent = (
    <StageCostSection
      title="Cocimiento / Horno"
      subtitle="Consumo de gas LP para caldera de vapor, leña o biomasa, mantenimiento de hornos o autoclaves y mano de obra del fogonero."
      icon={<FlameIcon className="h-6 w-6 text-amber-400" />}
      subtotal={cocimientoSubtotal}
      totalCost={totalCost}
      unitCostLabel={lot.agaveKg > 0 ? "Costo por ton de agave cocido" : undefined}
      unitCostValue={
        lot.agaveKg > 0
          ? `$${((cocimientoSubtotal / lot.agaveKg) * 1000).toFixed(2)}/ton`
          : undefined
      }
      stageTabKey="cocimiento"
      categoryOptions={["Cocción"]}
      conceptSuggestions={[
        "Gas LP para caldera de vapor",
        "Mantenimiento preventivo de horno / autoclave",
        "Sellos, empaques y válvulas de vapor",
        "Operador de caldera y horneros",
        "Biomasa / combustible de cocción",
      ]}
      expenses={cocimientoExpenses}
      addExpenseAction={addExpense}
    />
  );

  // 4. Pestaña: Molienda
  const tabMoliendaContent = (
    <StageCostSection
      title="Molienda y Extracción"
      subtitle="Agua tratada para extracción de azúcares, energía del tren de molinos y desgarradora, cambio de cuchillas y refacciones de rodillos."
      icon={<GearIcon className="h-6 w-6 text-yellow-400" />}
      subtotal={moliendaSubtotal}
      totalCost={totalCost}
      stageTabKey="molienda"
      categoryOptions={["Molienda"]}
      conceptSuggestions={[
        "Agua tratada para maceración y extracción",
        "Mantenimiento desgarradora y cambio de cuchillas",
        "Engrase y mantenimiento de rodillos de molino",
        "Energía eléctrica tren de molienda",
        "Prensa de bagazo y refacciones",
      ]}
      expenses={moliendaExpenses}
      addExpenseAction={addExpense}
    />
  );

  // 5. Pestaña: Fermentación
  const tabFermentacionContent = (
    <StageCostSection
      title="Fermentación"
      subtitle="Insumos biotecnológicos: levadura seca activa tequilera, sales de amonio (nutrientes), ácido cítrico/regulador de pH y bactericidas."
      icon={<FlaskIcon className="h-6 w-6 text-cyan-400" />}
      subtotal={fermentacionSubtotal}
      totalCost={totalCost}
      stageTabKey="fermentacion"
      categoryOptions={["Fermentación"]}
      conceptSuggestions={[
        "Levadura seca activa tequilera (Saccharomyces cerevisiae)",
        "Nutrientes (Sulfato y fosfato de amonio)",
        "Ácido cítrico (Regulador y corrección de pH)",
        "Bactericidas, sanitizante y lavado de tinas",
        "Mantenimiento serpentines de enfriamiento",
      ]}
      expenses={fermentacionExpenses}
      addExpenseAction={addExpense}
    />
  );

  // 6. Pestaña: Destilación
  const tabDestilacionContent = (
    <StageCostSection
      title="Destilación"
      subtitle="Consumo de gas en alambiques de destrozado y rectificación, agua de condensadores, juntas sanitarias y mantenimiento de cobre."
      icon={<StillIcon className="h-6 w-6 text-purple-400" />}
      subtotal={destilacionSubtotal}
      totalCost={totalCost}
      unitCostLabel={totalLiters > 0 ? "Costo destilación por litro" : undefined}
      unitCostValue={
        totalLiters > 0
          ? `$${(destilacionSubtotal / totalLiters).toFixed(2)}/L`
          : undefined
      }
      stageTabKey="destilacion"
      categoryOptions={["Destilación"]}
      conceptSuggestions={[
        "Gas LP quemadores alambiques de destilación",
        "Agua de torre de enfriamiento y condensadores",
        "Sellos sanitarios, siliconas y juntas de vapor",
        "Limpieza química y pulido de serpentines de cobre",
        "Mano de obra maestro destilador",
      ]}
      expenses={destilacionExpenses}
      addExpenseAction={addExpense}
    />
  );

  const tabs: PageTab[] = [
    {
      key: "resumen",
      label: "Resumen General",
      icon: <CoinsIcon className="h-4 w-4" />,
      content: tabResumenGeneralContent,
    },
    {
      key: "materia-prima",
      label: `Materia Prima ($${materiaPrimaSubtotal.toLocaleString("es-MX", { maximumFractionDigits: 0 })})`,
      icon: <AgaveIcon className="h-4 w-4" />,
      content: tabMateriaPrimaContent,
    },
    {
      key: "cocimiento",
      label: `Cocimiento ($${cocimientoSubtotal.toLocaleString("es-MX", { maximumFractionDigits: 0 })})`,
      icon: <FlameIcon className="h-4 w-4" />,
      content: tabCocimientoContent,
    },
    {
      key: "molienda",
      label: `Molienda ($${moliendaSubtotal.toLocaleString("es-MX", { maximumFractionDigits: 0 })})`,
      icon: <GearIcon className="h-4 w-4" />,
      content: tabMoliendaContent,
    },
    {
      key: "fermentacion",
      label: `Fermentación ($${fermentacionSubtotal.toLocaleString("es-MX", { maximumFractionDigits: 0 })})`,
      icon: <FlaskIcon className="h-4 w-4" />,
      content: tabFermentacionContent,
    },
    {
      key: "destilacion",
      label: `Destilación ($${destilacionSubtotal.toLocaleString("es-MX", { maximumFractionDigits: 0 })})`,
      icon: <StillIcon className="h-4 w-4" />,
      content: tabDestilacionContent,
    },
  ];

  const defaultTab = activeTabParam && tabs.some((t) => t.key === activeTabParam)
    ? activeTabParam
    : "resumen";

  return (
    <main className="min-h-screen bg-background p-6 sm:p-10 text-on-surface">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-sm uppercase tracking-[0.4em] text-on-surface-variant">
          MAESTRO TEQUILERO · SISTEMA DE COSTOS
        </p>

        <h1 className="mt-3 text-3xl sm:text-4xl font-bold">
          Costos del lote {lot.code}
        </h1>

        <LotMenu
          id={lot.id}
          isFinished={isFinished}
          processIds={{
            cooking: lot.cookings[0]?.id,
            milling: lot.millings[0]?.id,
            fermentation: lot.fermentations[0]?.id,
            distillation: lot.distillations[0]?.id,
          }}
        />

        <div className="mt-8">
          <PageTabs key={defaultTab} tabs={tabs} defaultTab={defaultTab} />
        </div>
      </div>
    </main>
  );
}

// --- SUBCOMPONENTES ---

function Card({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container p-6">
      <p className="text-xs uppercase tracking-wider text-on-surface-variant">{title}</p>
      <p className="mt-2 text-2xl font-bold text-on-surface">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-on-surface-variant">{subtitle}</p>}
    </div>
  );
}

function StageSummaryBox({
  title,
  amount,
  totalCost,
  detail,
  colorClass,
}: {
  title: string;
  amount: number;
  totalCost: number;
  detail: string;
  colorClass: string;
}) {
  const percent = totalCost > 0 ? (amount / totalCost) * 100 : 0;
  return (
    <div className="rounded-xl border border-outline-variant/60 bg-surface-container-high p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-on-surface-variant">{title}</p>
        <span className="font-mono text-xs font-bold text-on-surface-variant">
          {percent.toFixed(1)}%
        </span>
      </div>
      <p className={`mt-1.5 text-xl font-bold ${colorClass}`}>
        ${amount.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
      </p>
      <p className="mt-0.5 text-xs text-on-surface-variant">{detail}</p>
    </div>
  );
}

function StageCostSection({
  title,
  subtitle,
  icon,
  subtotal,
  totalCost,
  unitCostLabel,
  unitCostValue,
  extraInfo,
  stageTabKey,
  categoryOptions,
  conceptSuggestions,
  expenses,
  addExpenseAction,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  subtotal: number;
  totalCost: number;
  unitCostLabel?: string;
  unitCostValue?: string;
  extraInfo?: string;
  stageTabKey: string;
  categoryOptions: string[];
  conceptSuggestions: string[];
  expenses: Array<{
    id: string;
    category: string;
    concept: string;
    amount: number;
    notes: string | null;
    createdAt: Date;
  }>;
  addExpenseAction: (formData: FormData) => Promise<void>;
}) {
  const percent = totalCost > 0 ? (subtotal / totalCost) * 100 : 0;
  const datalistId = `suggestions-${stageTabKey}`;

  return (
    <div className="space-y-6">
      {/* Banner de Etapa con Subtotales */}
      <div className="rounded-2xl border border-outline-variant bg-surface-container p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-container-high border border-outline-variant/80">
              {icon}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-on-surface">{title}</h2>
              <p className="mt-1 text-xs sm:text-sm text-on-surface-variant max-w-2xl">
                {subtitle}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:flex-col sm:items-end">
            <span className="rounded-xl bg-surface-container-high px-4 py-2 font-mono text-xl font-bold text-primary border border-outline-variant/60">
              ${subtotal.toLocaleString("es-MX", { maximumFractionDigits: 2 })} MXN
            </span>
            <span className="text-xs font-semibold text-on-surface-variant">
              {percent.toFixed(1)}% del costo total del lote
            </span>
          </div>
        </div>

        {(unitCostLabel || extraInfo) && (
          <div className="mt-6 flex flex-wrap gap-4 border-t border-outline-variant/60 pt-4 text-xs">
            {unitCostLabel && unitCostValue && (
              <div className="rounded-lg bg-surface-container-high px-3 py-1.5 font-medium text-on-surface">
                <span className="text-on-surface-variant">{unitCostLabel}: </span>
                <span className="font-bold text-primary">{unitCostValue}</span>
              </div>
            )}
            {extraInfo && (
              <div className="rounded-lg bg-surface-container-high px-3 py-1.5 font-medium text-on-surface-variant">
                {extraInfo}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Formulario para registrar gasto de la etapa */}
      <div className="rounded-2xl border border-outline-variant bg-surface-container p-6 sm:p-8">
        <h3 className="text-lg font-bold text-on-surface">
          Registrar nuevo gasto en {title}
        </h3>
        <p className="mt-1 text-xs text-on-surface-variant">
          Este gasto se sumará directamente a la etapa de {title} y se reflejará en el Resumen General.
        </p>

        <form action={addExpenseAction} className="mt-6 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="tab" value={stageTabKey} />

          {categoryOptions.length > 1 ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-on-surface-variant">
                Subcategoría
              </label>
              <select
                name="category"
                className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-2.5 text-sm text-on-surface outline-none transition focus:border-primary"
              >
                {categoryOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-on-surface-variant">
                Etapa fija
              </label>
              <input
                type="hidden"
                name="category"
                value={categoryOptions[0]}
              />
              <div className="w-full rounded-xl border border-outline-variant/60 bg-surface-container-high/60 px-4 py-2.5 text-sm font-semibold text-primary">
                {categoryOptions[0]}
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-on-surface-variant">
              Concepto del gasto
            </label>
            <input
              name="concept"
              list={datalistId}
              placeholder="Ej. Selección rápida o escribe concepto"
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-2.5 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
              required
            />
            <datalist id={datalistId}>
              {conceptSuggestions.map((sug) => (
                <option key={sug} value={sug} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-on-surface-variant">
              Monto ($ MXN)
            </label>
            <input
              name="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-2.5 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-on-surface-variant">
              Observaciones o comprobante
            </label>
            <input
              name="notes"
              placeholder="Factura, proveedor, notas (opcional)"
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-2.5 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
            />
          </div>

          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-on-primary shadow transition hover:opacity-95 active:scale-[0.98] sm:col-span-2"
          >
            <PlusIcon className="h-4 w-4" />
            Guardar gasto de {title}
          </button>
        </form>
      </div>

      {/* Tabla de Gastos de la Etapa */}
      <div className="rounded-2xl border border-outline-variant bg-surface-container p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-on-surface">
            Gastos registrados en {title} ({expenses.length})
          </h3>
          <span className="font-mono text-xs font-bold text-on-surface-variant">
            Subtotal: ${subtotal.toLocaleString("es-MX", { maximumFractionDigits: 2 })} MXN
          </span>
        </div>

        <div className="mt-4">
          <ExpensesTable
            expenses={expenses}
            showCategoryBadge={categoryOptions.length > 1}
          />
        </div>
      </div>
    </div>
  );
}

function ExpensesTable({
  expenses,
  showCategoryBadge = false,
}: {
  expenses: Array<{
    id: string;
    category: string;
    concept: string;
    amount: number;
    notes: string | null;
    createdAt: Date;
  }>;
  showCategoryBadge?: boolean;
}) {
  if (expenses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-high/40 p-8 text-center">
        <p className="text-sm font-medium text-on-surface-variant">
          No hay gastos registrados en esta sección aún.
        </p>
        <p className="mt-1 text-xs text-outline">
          Utiliza el formulario superior para registrar insumos, energéticos o servicios.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-on-surface">
        <thead className="border-b border-outline-variant/80 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
          <tr>
            <th className="pb-3 pl-2">Concepto</th>
            {showCategoryBadge && <th className="pb-3 px-2">Categoría</th>}
            <th className="pb-3 px-2">Monto</th>
            <th className="pb-3 px-2">Observaciones</th>
            <th className="pb-3 px-2">Fecha</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/40">
          {expenses.map((expense) => {
            const formattedDate = new Intl.DateTimeFormat("es-MX", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(expense.createdAt));

            return (
              <tr
                key={expense.id}
                className="transition-colors hover:bg-surface-container-high/60"
              >
                <td className="py-3 pl-2 font-medium text-on-surface">
                  {expense.concept}
                </td>
                {showCategoryBadge && (
                  <td className="py-3 px-2">
                    <span
                      className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-semibold ${getCategoryBadgeClass(
                        expense.category
                      )}`}
                    >
                      {expense.category}
                    </span>
                  </td>
                )}
                <td className="py-3 px-2 font-mono font-bold text-primary">
                  ${expense.amount.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-2 text-xs text-on-surface-variant max-w-xs truncate">
                  {expense.notes || "—"}
                </td>
                <td className="py-3 px-2 font-mono text-xs text-on-surface-variant whitespace-nowrap">
                  {formattedDate}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
