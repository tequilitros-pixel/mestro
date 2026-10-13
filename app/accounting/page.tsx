import Link from "next/link";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";
import { getAccessibleBranchIds, requireModuleAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateOnly, parseDateOnly, todayDateOnly } from "@/lib/dateOnly";
import {
  methodLabel,
  formatPaymentMoney,
  periodRange,
  shiftPeriodAnchor,
  validDateOnly,
  type AccountingPeriod,
} from "@/lib/accounting";
import { getWeeklyBranchSummary } from "@/lib/accounting/weeklyBranchSummary";
import { PaymentForm, VoidPaymentForm } from "./PaymentForm";

export const dynamic = "force-dynamic";

type Query = {
  period?: string | string[];
  date?: string | string[];
  branch?: string | string[];
  category?: string | string[];
  status?: string | string[];
  page?: string | string[];
};

const money = formatPaymentMoney;
const single = (value: string | string[] | undefined) => typeof value === "string" ? value : "";
const control = "mt-1 w-full rounded-xl border border-outline-variant bg-background px-3 py-2 text-sm text-on-surface";

export default async function AccountingPage({ searchParams }: { searchParams: Promise<Query> }) {
  const user = await requireModuleAccess("/accounting");
  const accessibleBranchIds = await getAccessibleBranchIds();
  const query = await searchParams;
  const periodInput = single(query.period);
  const period: AccountingPeriod = periodInput === "day" || periodInput === "week" || periodInput === "month" || periodInput === "year" ? periodInput : "month";
  const dateInput = single(query.date);
  const anchor = validDateOnly(dateInput) ? dateInput : todayDateOnly();
  const { from, to } = periodRange(period, anchor);
  const requestedBranch = single(query.branch);
  const status = single(query.status) === "voided" ? "voided" : "active";
  const pageInput = Number(single(query.page));
  const currentPage = Number.isInteger(pageInput) && pageInput > 0 ? Math.min(pageInput, 10000) : 1;

  const [branches, categories] = await Promise.all([
    prisma.branch.findMany({
      where: {
        active: true,
        ...(accessibleBranchIds === null ? {} : { id: { in: accessibleBranchIds } }),
      },
      select: { id: true, name: true, active: true },
      orderBy: { name: "asc" },
    }),
    prisma.financialMovementCategory.findMany({
      where: { direction: "EXPENSE", scope: "ACCOUNTING" },
      select: { id: true, name: true, isActive: true, requiresReason: true, requiresReceipt: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);
  // A branch tab is authoritative only when it belongs to the active branches
  // available to this user. This also prevents stale or inactive branch ids
  // from widening a branch-scoped page into an ambiguous view.
  const branchId = requestedBranch && branches.some((branch) => branch.id === requestedBranch) ? requestedBranch : "";
  const selectedBranch = branches.find((branch) => branch.id === branchId);
  const requestedCategory = single(query.category);
  const category = categories.some((item) => item.id === requestedCategory) ? requestedCategory : "";
  const scopedBranchIds = branches.map((branch) => branch.id);
  const scope: Prisma.AccountingPaymentWhereInput = {
    branchId: branchId || { in: scopedBranchIds },
    paymentDate: { gte: parseDateOnly(from), lte: parseDateOnly(to) },
    ...(category ? { categoryId: category } : {}),
  };
  const activeWhere: Prisma.AccountingPaymentWhereInput = { ...scope, voidedAt: null };
  const listWhere: Prisma.AccountingPaymentWhereInput = { ...scope, voidedAt: status === "active" ? null : { not: null } };

  const [summary, byBranch, byCategory, byDate, payments, paymentCount] = await Promise.all([
    prisma.accountingPayment.aggregate({ where: activeWhere, _sum: { amount: true }, _count: { _all: true } }),
    prisma.accountingPayment.groupBy({ by: ["branchId"], where: activeWhere, _sum: { amount: true }, _count: { _all: true } }),
    prisma.accountingPayment.groupBy({ by: ["categoryNameSnapshot"], where: activeWhere, _sum: { amount: true }, _count: { _all: true } }),
    prisma.accountingPayment.groupBy({ by: ["paymentDate"], where: activeWhere, _sum: { amount: true } }),
    prisma.accountingPayment.findMany({
      where: listWhere,
      select: {
        id: true, paymentDate: true, branchNameSnapshot: true, categoryNameSnapshot: true, concept: true,
        payee: true, amount: true, method: true, reference: true, receiptUrl: true, notes: true,
        createdAt: true, createdBy: { select: { name: true } }, voidedAt: true,
        voidReason: true, voidedBy: { select: { name: true } },
      },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
      skip: (currentPage - 1) * 50,
      take: 50,
    }),
    prisma.accountingPayment.count({ where: listWhere }),
  ]);
  const weeklySummary = period === "week" && selectedBranch
    ? await getWeeklyBranchSummary({ branchId: selectedBranch.id, from, to })
    : null;

  const branchNames = new Map(branches.map((branch) => [branch.id, branch.name]));
  const branchTotals = byBranch.map((item) => ({ id: item.branchId, name: branchNames.get(item.branchId) ?? "Sucursal anterior", amount: item._sum.amount ?? new Prisma.Decimal(0), count: item._count._all })).sort((a, b) => b.amount.comparedTo(a.amount));
  const categoryTotals = byCategory.map((item) => ({ name: item.categoryNameSnapshot, amount: item._sum.amount ?? new Prisma.Decimal(0), count: item._count._all })).sort((a, b) => b.amount.comparedTo(a.amount));
  const trend = new Map<string, Prisma.Decimal>();
  for (const item of byDate) {
    const day = formatDateOnly(item.paymentDate);
    const key = period === "year" ? day.slice(0, 7) : day;
    trend.set(key, (trend.get(key) ?? new Prisma.Decimal(0)).plus(item._sum.amount ?? 0));
  }
  const queryBase = new URLSearchParams({ period, date: anchor, ...(branchId ? { branch: branchId } : {}), ...(category ? { category } : {}), ...(status === "voided" ? { status } : {}) });
  const tabHref = (nextBranchId: string) => {
    const params = new URLSearchParams(queryBase);
    params.delete("page");
    if (nextBranchId) params.set("branch", nextBranchId);
    else params.delete("branch");
    return `/accounting?${params}`;
  };
  const pageHref = (pageNumber: number) => {
    const params = new URLSearchParams(queryBase);
    params.set("page", String(pageNumber));
    return `/accounting?${params}`;
  };
  const periodHref = (nextAnchor: string) => {
    const params = new URLSearchParams(queryBase);
    params.set("date", nextAnchor);
    params.delete("page");
    return `/accounting?${params}`;
  };
  const previousPeriodHref = periodHref(shiftPeriodAnchor(period, anchor, -1));
  const nextPeriodHref = periodHref(shiftPeriodAnchor(period, anchor, 1));
  const todayPeriodHref = periodHref(todayDateOnly());

  return <main className="page-frame mx-auto max-w-7xl space-y-6 text-on-surface">
    <header className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">Control de gastos</p>
      <h1 className="text-3xl font-bold">{selectedBranch ? `Contabilidad · ${selectedBranch.name}` : "Contabilidad"}</h1>
      <p className="text-sm text-on-surface-variant">{selectedBranch ? `Resumen, pagos y entradas de ${selectedBranch.name}.` : "Pagos registrados por sucursal: cuánto se pagó, en qué y a quién."}</p>
      {user.role === "ADMIN" && <Link href="/administration/financial-categories" className="inline-block text-sm font-semibold text-primary underline">Administrar tipos de gasto</Link>}
    </header>

    <nav aria-label="Contabilidad por sucursal" className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container/60 p-2">
      <div className="flex min-w-max gap-2">
        <Link href={tabHref("")} aria-current={!branchId ? "page" : undefined} className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${!branchId ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"}`}>Todas</Link>
        {branches.map((branch) => {
          const active = branch.id === branchId;
          return <Link key={branch.id} href={tabHref(branch.id)} aria-current={active ? "page" : undefined} className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${active ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"}`}>
            {branch.name}{!branch.active && <span className="ml-1 text-xs opacity-70">(inactiva)</span>}
          </Link>;
        })}
      </div>
    </nav>

    <form method="get" className="grid gap-3 rounded-xl border border-outline-variant bg-surface-container/60 p-4 sm:grid-cols-2 lg:grid-cols-5">
      <label className="text-xs font-semibold text-on-surface-variant">Periodo
        <select name="period" defaultValue={period} className={control}>
          <option value="day">Día</option><option value="week">Semana</option><option value="month">Mes</option><option value="year">Año</option>
        </select>
      </label>
      <label className="text-xs font-semibold text-on-surface-variant">Fecha de referencia
        <input name="date" type="date" defaultValue={anchor} className={control} />
      </label>
      {selectedBranch ? <div className="text-xs font-semibold text-on-surface-variant">
        <span>Sucursal</span>
        <input type="hidden" name="branch" value={selectedBranch.id} />
        <div className={`${control} font-semibold text-on-surface`}>{selectedBranch.name}</div>
        <p className="mt-1 text-xs font-normal text-on-surface-variant">Esta pestaña solo muestra y registra datos de {selectedBranch.name}.</p>
      </div> : <label className="text-xs font-semibold text-on-surface-variant">Sucursal
        <select name="branch" defaultValue="" className={control}>
          <option value="">Todas las sucursales</option>
          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </select>
      </label>}
      <label className="text-xs font-semibold text-on-surface-variant">Tipo de gasto
        <select name="category" defaultValue={category} className={control}>
          <option value="">Todos los tipos</option>
          {categories.map((item) => <option key={item.id} value={item.id}>{item.name}{item.isActive ? "" : " (inactiva)"}</option>)}
        </select>
      </label>
      <div className="flex items-end"><button type="submit" className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary">Consultar</button></div>
    </form>

    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-on-surface-variant">Periodo consultado: <strong>{from}</strong> al <strong>{to}</strong>. Los totales excluyen pagos anulados.</p>
      <nav aria-label="Navegación de periodos" className="flex items-center gap-1 rounded-xl border border-outline-variant bg-surface-container/60 p-1 text-sm">
        <Link href={previousPeriodHref} className="rounded-lg px-3 py-2 font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface">← Anterior</Link>
        <Link href={todayPeriodHref} className="rounded-lg px-3 py-2 font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface">Hoy</Link>
        <Link href={nextPeriodHref} className="rounded-lg px-3 py-2 font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface">Siguiente →</Link>
      </nav>
    </div>
    {weeklySummary && selectedBranch && <section aria-label={`Resultado semanal de ${selectedBranch.name}`} className="space-y-3">
      <div>
        <h2 className="text-xl font-bold">Resultado semanal · {selectedBranch.name}</h2>
        <p className="text-sm text-on-surface-variant">Ventas cerradas menos nómina pagada y gastos registrados en la semana.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card highlight><CardLabel>Ventas de la semana</CardLabel><CardValue>{money(weeklySummary.sales)}</CardValue><p className="mt-1 text-xs text-on-surface-variant">{weeklySummary.salesCutCount} corte(s) cerrado(s)</p></Card>
        <Card><CardLabel>Nómina pagada</CardLabel><CardValue>{money(weeklySummary.payrollPaid)}</CardValue><p className="mt-1 text-xs text-on-surface-variant">{weeklySummary.payrollStatus === "PAGADA" ? `${weeklySummary.payrollEntries} empleado(s) pagado(s)` : "No hay nómina marcada como pagada"}</p></Card>
        <Card><CardLabel>Salidas de caja</CardLabel><CardValue>{money(weeklySummary.cashOutflows)}</CardValue><p className="mt-1 text-xs text-on-surface-variant">{weeklySummary.cashOutflowCount} salida(s) registrada(s)</p></Card>
        <Card><CardLabel>Pagos contables</CardLabel><CardValue>{money(weeklySummary.accountingPayments)}</CardValue><p className="mt-1 text-xs text-on-surface-variant">{weeklySummary.accountingPaymentCount} pago(s) vigente(s)</p></Card>
        <Card><CardLabel>Gastos totales</CardLabel><CardValue>{money(weeklySummary.totalExpenses)}</CardValue><p className="mt-1 text-xs text-on-surface-variant">Nómina + salidas + pagos contables</p></Card>
        <Card className={weeklySummary.netResult < 0 ? "border-error/40 bg-error/5" : "border-primary/30 bg-primary/5"}><CardLabel>Resultado de la semana</CardLabel><CardValue>{money(weeklySummary.netResult)}</CardValue><p className="mt-1 text-xs text-on-surface-variant">Ventas menos gastos</p></Card>
      </div>
      {(weeklySummary.payrollStatus !== "PAGADA" || weeklySummary.payrollUnallocated > 0) && <p className="text-xs text-on-surface-variant">{weeklySummary.payrollStatus !== "PAGADA" ? "La nómina solo se integra cuando el periodo semanal está marcado como PAGADA." : "Hay importe de nómina pagada sin sucursal identificable en el snapshot y no se sumó a Canoas."}</p>}
      <p className="text-xs text-on-surface-variant">Las salidas de caja y los pagos contables se conservan como fuentes separadas para evitar ocultar o mezclar registros.</p>
    </section>}
    <section aria-label="Resumen de pagos" className="grid gap-3 sm:grid-cols-3">
      <Card highlight><CardLabel>Total pagado</CardLabel><CardValue>{money(summary._sum.amount ?? 0)}</CardValue></Card>
      <Card><CardLabel>Pagos</CardLabel><CardValue>{summary._count._all}</CardValue></Card>
      <Card><CardLabel>Promedio por pago</CardLabel><CardValue>{money(summary._count._all ? (summary._sum.amount ?? new Prisma.Decimal(0)).div(summary._count._all) : 0)}</CardValue></Card>
    </section>

    <div className="grid gap-4 lg:grid-cols-2">
      <Card><h2 className="mb-3 font-bold">Por sucursal</h2>{branchTotals.length ? <ul className="space-y-2">{branchTotals.map((row) => <li key={row.id} className="flex justify-between gap-3 border-b border-outline-variant pb-2 text-sm"><span>{row.name} <span className="text-on-surface-variant">({row.count})</span></span><strong>{money(row.amount)}</strong></li>)}</ul> : <p className="text-sm text-on-surface-variant">Sin pagos en este periodo.</p>}</Card>
      <Card><h2 className="mb-3 font-bold">En qué se gastó</h2>{categoryTotals.length ? <ul className="space-y-2">{categoryTotals.map((row) => <li key={row.name} className="flex justify-between gap-3 border-b border-outline-variant pb-2 text-sm"><span>{row.name} <span className="text-on-surface-variant">({row.count})</span></span><strong>{money(row.amount)}</strong></li>)}</ul> : <p className="text-sm text-on-surface-variant">Sin pagos en este periodo.</p>}</Card>
    </div>

    {trend.size > 1 && <Card><h2 className="mb-3 font-bold">Evolución {period === "year" ? "mensual" : "diaria"}</h2><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{[...trend].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => <div key={key} className="rounded-lg bg-surface-container-high p-3"><p className="text-xs text-on-surface-variant">{key}</p><p className="font-semibold">{money(value)}</p></div>)}</div></Card>}

    <PaymentForm branches={branches.filter((branch) => branch.active)} categories={categories.filter((item) => item.isActive)} today={todayDateOnly()} initialRequestId={randomUUID()} initialBranchId={selectedBranch?.active ? selectedBranch.id : ""} initialBranchName={selectedBranch?.active ? selectedBranch.name : ""} />

    <section className="space-y-3" aria-label="Historial de pagos">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-xl font-bold">Historial</h2><p className="text-sm text-on-surface-variant">{paymentCount} {status === "voided" ? "pagos anulados" : "pagos vigentes"} en el periodo.</p></div><div className="flex gap-2 text-sm"><Link href={`/accounting?${new URLSearchParams({ period, date: anchor, ...(branchId ? { branch: branchId } : {}), ...(category ? { category } : {}) })}`} className={status === "active" ? "font-bold text-primary" : "text-on-surface-variant underline"}>Vigentes</Link><Link href={`/accounting?${new URLSearchParams({ period, date: anchor, ...(branchId ? { branch: branchId } : {}), ...(category ? { category } : {}), status: "voided" })}`} className={status === "voided" ? "font-bold text-primary" : "text-on-surface-variant underline"}>Anulados</Link></div></div>
      {payments.length ? payments.map((payment) => <Card key={payment.id} className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{payment.concept}</p><p className="text-sm text-on-surface-variant">{payment.branchNameSnapshot} · {payment.categoryNameSnapshot} · {payment.payee}</p></div><strong>{money(payment.amount)}</strong></div>
        <p className="text-xs text-on-surface-variant">Pago: {formatDateOnly(payment.paymentDate)} · {methodLabel(payment.method)}{payment.reference ? ` · Ref. ${payment.reference}` : ""} · Registró: {payment.createdBy.name}</p>
        {payment.notes && <p className="text-xs text-on-surface-variant">{payment.notes}</p>}
        {payment.receiptUrl && <a href={payment.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary underline">Ver comprobante</a>}
        {payment.voidedAt ? <p className="text-xs text-error">Anulado por {payment.voidedBy?.name ?? "administrador"}: {payment.voidReason}</p> : user.role === "ADMIN" ? <VoidPaymentForm id={payment.id} /> : null}
      </Card>) : <Card><p className="text-sm text-on-surface-variant">No hay pagos {status === "voided" ? "anulados" : "vigentes"} con estos filtros.</p></Card>}
      {(currentPage > 1 || currentPage * 50 < paymentCount) && <nav aria-label="Páginas del historial" className="flex justify-between text-sm">{currentPage > 1 ? <Link href={pageHref(currentPage - 1)} className="underline">Anterior</Link> : <span />}{currentPage * 50 < paymentCount ? <Link href={pageHref(currentPage + 1)} className="underline">Siguiente</Link> : <span />}</nav>}
    </section>
  </main>;
}
