import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccessibleBranchIds, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatBusinessDate, formatBusinessDateTime } from "@/lib/dateTime";
import { getInventoryDashboardData } from "@/app/administration/inventory/lib/dashboard";

const shortcuts = [
  {
    label: "Stock actual",
    href: "/administration/inventory/sucursales/stock",
    permissionKey: "/administration/inventory/sucursales/stock",
  },
  {
    label: "Conteos de inventario",
    href: "/administration/inventory/branch-counts",
    permissionKey: "/administration/inventory/branch-counts",
  },
  {
    label: "Entradas y ajustes",
    href: "/administration/inventory/branch-entries",
    permissionKey: "/administration/inventory/branch-entries",
  },
  {
    label: "Traspasos",
    href: "/administration/inventory/sucursales/traspasos",
    permissionKey: "/administration/inventory/sucursales/traspasos",
  },
] as const;

function Metric({ label, value, detail, alert = false }: {
  label: string;
  value: string | number;
  detail: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${alert ? "text-error" : "text-on-surface"}`}>{value}</p>
      <p className="mt-1 text-xs text-on-surface-variant">{detail}</p>
    </div>
  );
}

export default async function AdministrationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const permissionRows = user.role === "ADMIN"
    ? []
    : await prisma.modulePermission.findMany({
        where: { userId: user.id, moduleKey: { startsWith: "/administration/inventory/" } },
        select: { moduleKey: true },
      });
  const permissionKeys = new Set(permissionRows.map((row) => row.moduleKey));
  if (user.role !== "ADMIN" && permissionKeys.size === 0) redirect("/profile");

  const data = await getInventoryDashboardData(await getAccessibleBranchIds());
  const canOpen = (permissionKey: string) => user.role === "ADMIN" || permissionKeys.has(permissionKey);
  const visibleShortcuts = shortcuts.filter((shortcut) => canOpen(shortcut.permissionKey));
  const alertCount =
    data.analytics.totals.lowStockCount +
    data.analytics.totals.outOfStockCount +
    data.negativeLegacy.length +
    data.incompletePresentations.length +
    data.pendingCounts.length;

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header>
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-on-surface-variant">Administración</p>
          <h1 className="text-3xl font-bold sm:text-4xl">Centro Administrativo</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-on-surface-variant sm:text-base">
            Inventario, conteos y alertas de tus ubicaciones autorizadas. Los datos de este panel no incluyen sucursales fuera de tu alcance.
          </p>
        </header>

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Metric label="Ubicaciones" value={data.branches.length} detail="Activas y autorizadas" />
          <Metric label="Productos activos" value={data.analytics.totals.activeProducts} detail={`${data.analytics.totals.products} con seguimiento de stock`} />
          <Metric label="Conteos pendientes" value={data.pendingCounts.length} detail="Borradores por cerrar" alert={data.pendingCounts.length > 0} />
          <Metric label="Alertas" value={alertCount} detail="Stock, presentación o conteo" alert={alertCount > 0} />
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">Alertas que requieren revisión</h2>
                <p className="mt-1 text-sm text-on-surface-variant">No se corrigen automáticamente desde este panel.</p>
              </div>
              <span className="rounded-full bg-error/10 px-3 py-1 text-xs font-bold text-error">{alertCount}</span>
            </div>
            <div className="mt-5 space-y-3 text-sm">
              <p className="flex justify-between gap-4"><span>Stock bajo o agotado</span><strong>{data.analytics.totals.lowStockCount + data.analytics.totals.outOfStockCount}</strong></p>
              <p className="flex justify-between gap-4"><span>Saldo legacy negativo</span><strong className={data.negativeLegacy.length ? "text-error" : ""}>{data.negativeLegacy.length}</strong></p>
              <p className="flex justify-between gap-4"><span>Presentación por configurar</span><strong>{data.incompletePresentations.length}</strong></p>
              <p className="flex justify-between gap-4"><span>Conteos abiertos</span><strong>{data.pendingCounts.length}</strong></p>
            </div>
            {data.negativeLegacy.length > 0 && canOpen("/administration/inventory/sucursales/legacy-report") && (
              <Link href="/administration/inventory/sucursales/legacy-report" className="mt-5 inline-block text-sm font-semibold text-primary hover:underline">
                Abrir reporte legacy →
              </Link>
            )}
          </div>

          <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
            <h2 className="text-lg font-bold">Atajos de inventario</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {visibleShortcuts.map((shortcut) => (
                <Link key={shortcut.href} href={shortcut.href} className="rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm font-semibold transition hover:border-primary/50 hover:bg-surface-container-high">
                  {shortcut.label} <span aria-hidden="true">→</span>
                </Link>
              ))}
              {visibleShortcuts.length === 0 && <p className="text-sm text-on-surface-variant">No hay accesos configurados.</p>}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-outline-variant bg-surface-container p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Conteos de inventario</h2>
              <p className="mt-1 text-sm text-on-surface-variant">Últimos conteos por ubicación, fecha y estado.</p>
            </div>
            {canOpen("/administration/inventory/branch-counts") && <Link href="/administration/inventory/branch-counts" className="text-sm font-semibold text-primary hover:underline">Ver historial →</Link>}
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b border-outline-variant text-left text-xs text-on-surface-variant"><th className="px-2 py-2">Conteo</th><th className="px-2 py-2">Ubicación</th><th className="px-2 py-2">Tipo</th><th className="px-2 py-2">Fecha</th><th className="px-2 py-2">Estado</th><th className="px-2 py-2">Cierre</th></tr></thead>
              <tbody>
                {data.counts.length === 0 && <tr><td colSpan={6} className="px-2 py-6 text-center text-on-surface-variant">Aún no hay conteos.</td></tr>}
                {data.counts.map((count) => (
                  <tr key={count.id} className="border-b border-outline-variant last:border-0">
                    <td className="px-2 py-3 font-semibold">{canOpen("/administration/inventory/branch-counts") ? <Link href={`/administration/inventory/branch-counts/${count.id}`} className="hover:underline">{count.code}</Link> : count.code}</td>
                    <td className="px-2 py-3">{count.branchName}</td>
                    <td className="px-2 py-3">{count.countTypeLabel}</td>
                    <td className="px-2 py-3">{formatBusinessDate(count.countDate)}</td>
                    <td className="px-2 py-3"><span className={count.status === "CERRADO" ? "text-tertiary-fixed-dim" : "font-semibold text-secondary"}>{count.status === "CERRADO" ? "Cerrado" : "Pendiente"}</span></td>
                    <td className="px-2 py-3 text-on-surface-variant">{count.closedAt ? formatBusinessDateTime(count.closedAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-outline-variant bg-surface-container p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Diferencias recientes</h2>
              <p className="mt-1 text-sm text-on-surface-variant">Contraste histórico en la unidad configurada del producto.</p>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="border-b border-outline-variant text-left text-xs text-on-surface-variant"><th className="px-2 py-2">Producto</th><th className="px-2 py-2">Ubicación</th><th className="px-2 py-2">Conteo</th><th className="px-2 py-2 text-right">Teórico</th><th className="px-2 py-2 text-right">Físico</th><th className="px-2 py-2 text-right">Diferencia</th></tr></thead>
              <tbody>
                {data.recentDifferences.length === 0 && <tr><td colSpan={6} className="px-2 py-6 text-center text-on-surface-variant">Aún no hay diferencias cerradas.</td></tr>}
                {data.recentDifferences.map((difference) => (
                  <tr key={difference.id} className="border-b border-outline-variant last:border-0">
                    <td className="px-2 py-3 font-medium">{difference.productName}</td>
                    <td className="px-2 py-3">{difference.branchName}</td>
                    <td className="px-2 py-3 text-on-surface-variant">{difference.countCode ?? difference.countId ?? "—"}</td>
                    <td className="px-2 py-3 text-right">{difference.expected}</td>
                    <td className="px-2 py-3 text-right">{difference.declared}</td>
                    <td className={`px-2 py-3 text-right font-semibold ${difference.difference.startsWith("-") ? "text-error" : ""}`}>{difference.difference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
            <h2 className="text-lg font-bold">Stock legacy negativo</h2>
            <div className="mt-4 space-y-3">
              {data.negativeLegacy.length === 0 && <p className="text-sm text-on-surface-variant">No hay saldos legacy negativos visibles.</p>}
              {data.negativeLegacy.slice(0, 8).map((row) => <p key={`${row.branchId}:${row.productId}`} className="flex justify-between gap-4 text-sm"><span>{row.productName} · {row.branchName}</span><strong className="text-error">{row.displayQuantity} · ALERTA</strong></p>)}
            </div>
          </div>
          <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
            <h2 className="text-lg font-bold">Presentaciones incompletas</h2>
            <div className="mt-4 space-y-3">
              {data.incompletePresentations.length === 0 && <p className="text-sm text-on-surface-variant">Todas las presentaciones activas tienen configuración válida.</p>}
              {data.incompletePresentations.slice(0, 8).map((product) => <p key={product.id} className="flex justify-between gap-4 text-sm"><span>{product.name}</span><span className="text-on-surface-variant">{product.baseUnit} · {product.display}</span></p>)}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
