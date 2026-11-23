"use client";

import { useEffect, useMemo, useState } from "react";
import { formatBusinessDateTime } from "@/lib/dateTime";

export type CutTransaction = {
  id: string;
  code: string;
  subtotal: number;
  discountAmount: number;
  total: number;
  createdAt: string;
  soldBy: { id: string; name: string } | null;
  payments?: Array<{ method: string; amount: number }>;
  items: Array<{
    id: string;
    name: string;
    description: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
};

type View = "live" | "history" | "products";
type ProductSummary = { name: string; quantity: number; amount: number };

const money = (value: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

const PAYMENT_LABELS: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
  DIDI: "DiDi",
  UBER: "Uber",
  RAPPI: "Rappi",
  VALES: "Vales",
  OTRO: "Otro",
};

export default function CutTransactionsPanel({
  cashCutId,
  initialSales,
  isOpen,
}: {
  cashCutId: string;
  initialSales: CutTransaction[];
  isOpen: boolean;
}) {
  const [sales, setSales] = useState<CutTransaction[]>(initialSales);
  const [view, setView] = useState<View>(isOpen ? "live" : "history");
  const [historyLimit, setHistoryLimit] = useState(15);
  const [refreshSequence, setRefreshSequence] = useState(0);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);

  useEffect(() => {
    setSales(initialSales);
  }, [initialSales]);

  // The cash-cut form keeps its own editable values. Poll only the
  // read-only transaction panel so a refresh never overwrites form inputs.
  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    let running = false;
    let stopped = false;

    async function refresh() {
      if (running || stopped) return;
      running = true;
      try {
        const response = await fetch(
          "/api/cash-cuts/" + encodeURIComponent(cashCutId),
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) throw new Error("No se pudieron actualizar las transacciones.");
        const detail: { id?: string; posSales?: CutTransaction[] } = await response.json();
        if (detail.id !== cashCutId || !Array.isArray(detail.posSales)) {
          throw new Error("Respuesta inesperada al consultar el corte.");
        }
        if (!stopped) {
          setSales(detail.posSales);
          setRefreshFailed(false);
          setLastSynced(new Date().toISOString());
        }
      } catch {
        if (!stopped) setRefreshFailed(true);
      } finally {
        running = false;
      }
    }

    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 12_000);
    return () => {
      stopped = true;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [cashCutId, isOpen, refreshSequence]);

  const ordered = useMemo(
    () => [...sales].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [sales],
  );

  const total = sales.reduce((sum, sale) => sum + sale.total, 0);
  const discountTotal = sales.reduce((sum, sale) => sum + sale.discountAmount, 0);

  const payments = useMemo(() => {
    const methodTotals = new Map<string, number>();
    for (const sale of sales) {
      for (const payment of sale.payments ?? []) {
        methodTotals.set(payment.method, (methodTotals.get(payment.method) ?? 0) + payment.amount);
      }
    }
    return [...methodTotals.entries()].sort((a, b) => b[1] - a[1]);
  }, [sales]);

  const products = useMemo(() => {
    const grouped = new Map<string, ProductSummary>();
    for (const sale of sales) {
      for (const item of sale.items) {
        const name = item.description || item.name;
        const previous = grouped.get(name) ?? { name, quantity: 0, amount: 0 };
        previous.quantity += item.quantity;
        previous.amount += item.lineTotal;
        grouped.set(name, previous);
      }
    }
    return [...grouped.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, "es"));
  }, [sales]);

  const visibleSales = view === "live" ? ordered.slice(0, 10) : ordered.slice(0, historyLimit);

  return (
    <section className="mb-6 space-y-3" aria-label="Transacciones y productos del corte">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-on-surface">
            {isOpen ? "Transacciones en vivo" : "Historial de transacciones"}
          </h2>
          <p className="text-xs text-on-surface-variant">
            {isOpen ? "Ventas registradas en este corte; se actualizan automáticamente cada 12 segundos." : "Ventas registradas durante este corte."}
          </p>
        </div>
        {isOpen && (
          <button
            type="button"
            onClick={() => setRefreshSequence((value) => value + 1)}
            className="rounded-lg border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container-high"
          >
            Actualizar
          </button>
        )}
      </div>

      {isOpen && (
        <p role="status" className={"text-xs " + (refreshFailed ? "text-error" : "text-on-surface-variant")}>
          {refreshFailed
            ? "No se pudo actualizar. Se conservan los últimos datos recibidos."
            : lastSynced
              ? "Actualizado: " + formatBusinessDateTime(lastSynced)
              : "Consultando transacciones..."}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-outline-variant bg-surface-container p-3">
          <p className="text-xs text-on-surface-variant">Tickets POS</p>
          <p className="text-xl font-bold text-on-surface">{sales.length}</p>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface-container p-3">
          <p className="text-xs text-on-surface-variant">Total vendido POS</p>
          <p className="text-xl font-bold text-on-surface">{money(total)}</p>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface-container p-3">
          <p className="text-xs text-on-surface-variant">Descuentos POS</p>
          <p className="text-xl font-bold text-on-surface">{money(discountTotal)}</p>
        </div>
      </div>
      {payments.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-variant">
          {payments.map(([method, amount]) => (
            <span key={method}>{PAYMENT_LABELS[method] ?? method}: <strong className="text-on-surface">{money(amount)}</strong></span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Vista de transacciones">
        {([
          ...(isOpen ? [{ key: "live", label: "En vivo (últimas 10)" }] : []),
          { key: "history", label: "Historial" },
          { key: "products", label: "Productos vendidos" },
        ] as Array<{ key: View; label: string }>).map((tab) => (
          <button
            type="button"
            key={tab.key}
            role="tab"
            aria-selected={view === tab.key}
            onClick={() => { setView(tab.key); setHistoryLimit(15); }}
            className={
              "rounded-lg px-3 py-2 text-xs font-semibold transition " +
              (view === tab.key
                ? "bg-primary text-on-primary"
                : "border border-outline-variant text-on-surface hover:bg-surface-container-high")
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {view === "products" ? (
        <div className="rounded-xl border border-outline-variant bg-surface-container p-3">
          {products.length ? (
            <div className="divide-y divide-outline-variant">
              {products.map((product) => (
                <div className="flex items-center justify-between gap-3 py-2" key={product.name}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface">{product.name}</p>
                    <p className="text-xs text-on-surface-variant">Cantidad: {product.quantity}</p>
                  </div>
                  <p className="text-sm font-bold text-on-surface">{money(product.amount)}</p>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-on-surface-variant">Todavía no hay productos vendidos en este corte.</p>}
          {discountTotal > 0 && <p className="mt-2 text-xs text-on-surface-variant">Los importes por producto son antes de descuentos generales de ticket.</p>}
        </div>
      ) : (
        <div className="space-y-2" role="tabpanel">
          {visibleSales.length ? visibleSales.map((sale) => (
            <article key={sale.id} className="rounded-xl border border-outline-variant bg-surface-container p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-on-surface-variant">{formatBusinessDateTime(sale.createdAt)}</p>
                  <p className="truncate text-xs font-semibold text-on-surface" title={sale.code}>{sale.code}</p>
                  <p className="text-xs text-on-surface-variant">Cobró: {sale.soldBy?.name ?? "Sin registrar"}</p>
                </div>
                <strong className="text-base text-on-surface">{money(sale.total)}</strong>
              </div>
              <div className="mt-2 divide-y divide-outline-variant border-t border-outline-variant">
                {sale.items.map((item) => (
                  <div className="flex justify-between gap-2 py-1.5 text-sm" key={item.id}>
                    <span className="min-w-0 text-on-surface">{item.quantity} × {item.description || item.name}</span>
                    <span className="shrink-0 font-semibold text-on-surface">{money(item.lineTotal)}</span>
                  </div>
                ))}
              </div>
              {(sale.discountAmount > 0 || (sale.payments?.length ?? 0) > 0) && (
                <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-on-surface-variant">
                  <span>{(sale.payments ?? []).map((payment) => PAYMENT_LABELS[payment.method] ?? payment.method).join(" + ")}</span>
                  {sale.discountAmount > 0 && <span>Descuento: {money(sale.discountAmount)}</span>}
                </div>
              )}
            </article>
          )) : (
            <div className="rounded-xl border border-outline-variant bg-surface-container p-4 text-sm text-on-surface-variant">
              Aún no se han registrado ventas en este corte.
            </div>
          )}
          {view === "history" && ordered.length > visibleSales.length && (
            <button
              type="button"
              onClick={() => setHistoryLimit((limit) => limit + 25)}
              className="w-full rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold text-primary"
            >
              Mostrar más ({ordered.length - visibleSales.length} restantes)
            </button>
          )}
          {view === "live" && ordered.length > visibleSales.length && (
            <button
              type="button"
              className="w-full rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold text-primary"
              onClick={() => setView("history")}
            >
              Ver todas las transacciones ({ordered.length})
            </button>
          )}
        </div>
      )}
    </section>
  );
}
