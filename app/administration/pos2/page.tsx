import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export const metadata = {
  title: "Administración POS 2.0 | Destiladora del Norte",
  description: "Panel central de administración y configuración del punto de venta 2.0.",
};

const MODULES = [
  {
    href: "/administration/pos2/catalog",
    title: "Catálogo Empresarial",
    desc: "Gestión global de categorías, productos, variantes y overrides por sucursal.",
    icon: "📦",
  },
  {
    href: "/administration/pos2/pricing",
    title: "Listas de Precios",
    desc: "Control de versiones de precios y resolución de tarifas efectivas por fecha y sucursal.",
    icon: "🏷️",
  },
  {
    href: "/administration/pos2/promotions",
    title: "Promociones y Descuentos",
    desc: "Reglas de ajuste, descuentos automáticos y campañas promocionales del POS.",
    icon: "🎁",
  },
  {
    href: "/administration/pos2/inventory",
    title: "Inventario de Sucursal",
    desc: "Recepción de mercancía, ajustes de stock, mermas y traspasos entre sucursales.",
    icon: "📋",
  },
  {
    href: "/administration/pos2/cash",
    title: "Sesiones de Caja",
    desc: "Monitoreo de aperturas, cierres, fondos de caja y auditoría de arqueos.",
    icon: "💵",
  },
  {
    href: "/administration/pos2/orders",
    title: "Pedidos y Órdenes Activas",
    desc: "Supervisión de pedidos abiertos y pendientes de pago en tiempo real.",
    icon: "🧾",
  },
  {
    href: "/administration/pos2/sales",
    title: "Ventas y Devoluciones",
    desc: "Historial de transacciones, compensaciones autorizadas y reembolsos.",
    icon: "💳",
  },
  {
    href: "/administration/pos2/sync",
    title: "Diagnóstico de Sincronización",
    desc: "Estado del motor offline, cola de eventos y sincronización distribuida.",
    icon: "🔄",
  },
];

export default async function Pos2AdminHubPage() {
  await requireAdmin();

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-6">
      <header className="border-b border-outline-variant/40 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">
              Panel Administrativo POS 2.0
            </h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              Herramientas de configuración, catálogo centralizado y supervisión de cajas del punto de venta.
            </p>
          </div>
          <Link
            href="/pospress"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow-sm transition hover:opacity-90"
          >
            <span>Ir a POSpress</span>
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </header>

      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((mod) => (
          <Link
            key={mod.href}
            href={mod.href}
            className="group flex flex-col justify-between rounded-2xl border border-outline-variant/60 bg-surface-container-low p-5 shadow-xs transition hover:border-primary/50 hover:bg-surface-container hover:shadow-md"
          >
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-high text-2xl shadow-xs group-hover:scale-105 transition-transform">
                  {mod.icon}
                </span>
                <h2 className="text-base font-semibold text-on-surface group-hover:text-primary transition-colors">
                  {mod.title}
                </h2>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                {mod.desc}
              </p>
            </div>
            <div className="mt-5 flex items-center gap-1.5 text-xs font-semibold text-primary">
              <span>Administrar módulo</span>
              <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">
                &rarr;
              </span>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
