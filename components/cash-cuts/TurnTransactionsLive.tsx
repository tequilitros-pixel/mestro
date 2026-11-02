"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardLabel } from "@/components/ui/Card";
import { formatBusinessTime, formatBusinessDateTime } from "@/lib/dateTime";
import type { InventoryProductUnitConfig } from "@/lib/inventory/units";
import { RefreshIcon } from "@/components/ui/icons";

export interface PosSaleItemDetail {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  variant?: {
    id: string;
    name: string;
    ingredients?: Array<{
      id: string;
      quantity: number | string;
      unit: string | null;
      inventoryProduct: {
        id: string;
        name: string;
        code: string;
        unit: string;
        unitCost?: number | string | null;
        inventoryBaseUnit?: string | null;
        handlingUnit?: string | null;
        contentPerUnit?: number | string | null;
        contentUnit?: string | null;
        normalizedContentPerUnit?: number | string | null;
      };
    }>;
  } | null;
}

export interface PosSaleTransaction {
  id: string;
  code: string;
  subtotal: number;
  discountAmount: number;
  discountReason?: string | null;
  total: number;
  status: "COMPLETADA" | "CANCELADA" | string;
  createdAt: string;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  soldBy: { id: string; name: string };
  payments?: Array<{ id: string; method: string; amount: number }>;
  items: PosSaleItemDetail[];
}

const formatMoney = (v: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(v);

function timeAgo(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `hace ${Math.max(1, diffSec)} seg`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  return `hace ${diffHours} h`;
}

export function TurnTransactionsLive({
  sales,
  isOpen,
  onRefresh,
  refreshing,
}: {
  sales: PosSaleTransaction[];
  isOpen: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [methodFilter, setMethodFilter] = useState("TODOS");
  const [statusFilter, setStatusFilter] = useState<"TODOS" | "COMPLETADA" | "CANCELADA">("TODOS");
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(isOpen);

  // Auto-refresh timer every 20 seconds when active
  useEffect(() => {
    if (!autoRefresh || !onRefresh || !isOpen) return;
    const interval = setInterval(() => {
      onRefresh();
    }, 20000);
    return () => clearInterval(interval);
  }, [autoRefresh, onRefresh, isOpen]);

  // Sort sales descending (newest first)
  const sortedSales = useMemo(() => {
    return [...sales].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [sales]);

  const lastSale = sortedSales.find((s) => s.status === "COMPLETADA") ?? sortedSales[0];

  const filteredSales = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return sortedSales.filter((sale) => {
      if (statusFilter !== "TODOS" && sale.status !== statusFilter) return false;

      if (methodFilter !== "TODOS") {
        const hasMethod = sale.payments?.some((p) => p.method === methodFilter);
        if (!hasMethod) return false;
      }

      if (!term) return true;

      const timeStr = formatBusinessTime(sale.createdAt).toLowerCase();
      const codeMatch = sale.code.toLowerCase().includes(term);
      const cashierMatch = sale.soldBy.name.toLowerCase().includes(term);
      const itemMatch = sale.items.some(
        (i) => i.name.toLowerCase().includes(term) || (i.description && i.description.toLowerCase().includes(term))
      );
      const timeMatch = timeStr.includes(term);

      return codeMatch || cashierMatch || itemMatch || timeMatch;
    });
  }, [sortedSales, searchTerm, methodFilter, statusFilter]);

  const totalCompletadas = useMemo(
    () => sales.filter((s) => s.status === "COMPLETADA").reduce((sum, s) => sum + s.total, 0),
    [sales]
  );
  const totalCanceladas = useMemo(
    () => sales.filter((s) => s.status === "CANCELADA").length,
    [sales]
  );

  return (
    <div className="space-y-4">
      {/* Top Real-time Camera Audit Banner */}
      <Card highlight className="relative overflow-hidden border-primary/30">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                {isOpen ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-neutral-400" />
                )}
              </span>
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                {isOpen ? "Monitoreo en Vivo (Auditoría de Cámaras)" : "Historial de Transacciones del Turno"}
              </p>
            </div>
            {lastSale ? (
              <div className="mt-1">
                <p className="text-sm font-semibold text-on-surface">
                  Última transacción:{" "}
                  <span className="font-mono text-base font-bold text-primary">
                    {formatBusinessTime(lastSale.createdAt)}
                  </span>{" "}
                  <span className="text-xs text-on-surface-variant">({timeAgo(lastSale.createdAt)})</span>
                </p>
                <p className="text-xs text-on-surface-variant">
                  {lastSale.code} · {formatMoney(lastSale.total)} · Vendió: {lastSale.soldBy.name}
                  {lastSale.status === "CANCELADA" && (
                    <span className="ml-1 font-bold text-error">(CANCELADA)</span>
                  )}
                </p>
              </div>
            ) : (
              <p className="mt-1 text-sm text-on-surface-variant">
                Aún no hay transacciones registradas desde POSpress en este corte.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isOpen && (
              <label className="flex items-center gap-1.5 text-xs text-on-surface-variant cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-outline-variant text-primary focus:ring-primary h-3.5 w-3.5"
                />
                Auto-refresco (20s)
              </label>
            )}
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-1 rounded-lg border border-outline-variant bg-surface-container-high px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container-highest transition disabled:opacity-50"
              >
                <RefreshIcon className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                Actualizar
              </button>
            )}
          </div>
        </div>

        {/* Resumen rápido de tickets */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 border-t border-outline-variant/60 pt-3 text-xs">
          <div>
            <span className="text-on-surface-variant">Tickets cobrados:</span>
            <p className="font-bold text-on-surface">{sales.filter((s) => s.status === "COMPLETADA").length}</p>
          </div>
          <div>
            <span className="text-on-surface-variant">Total POSpress:</span>
            <p className="font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(totalCompletadas)}</p>
          </div>
          <div>
            <span className="text-on-surface-variant">Cancelaciones:</span>
            <p className={`font-bold ${totalCanceladas > 0 ? "text-error" : "text-on-surface"}`}>
              {totalCanceladas}
            </p>
          </div>
          <div>
            <span className="text-on-surface-variant">Ticket promedio:</span>
            <p className="font-bold text-on-surface">
              {sales.filter((s) => s.status === "COMPLETADA").length > 0
                ? formatMoney(totalCompletadas / sales.filter((s) => s.status === "COMPLETADA").length)
                : "$0.00"}
            </p>
          </div>
        </div>
      </Card>

      {/* Filtros y Buscador para comparar con cámaras */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="🔍 Buscar por hora (ej. 8:10), producto, código o cajero..."
            className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-3.5 py-2.5 text-xs text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="rounded-xl border border-outline-variant bg-surface-container-high px-2.5 py-2.5 text-xs text-on-surface outline-none transition focus:border-primary"
          >
            <option value="TODOS">Todos los métodos</option>
            <option value="EFECTIVO">Efectivo</option>
            <option value="TARJETA">Tarjeta</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="DIDI">DiDi</option>
            <option value="UBER">Uber</option>
            <option value="RAPPI">Rappi</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-xl border border-outline-variant bg-surface-container-high px-2.5 py-2.5 text-xs text-on-surface outline-none transition focus:border-primary"
          >
            <option value="TODOS">Todos los estados</option>
            <option value="COMPLETADA">Solo completadas</option>
            <option value="CANCELADA">Solo canceladas</option>
          </select>
        </div>
      </div>

      {/* Lista de transacciones en orden cronológico inverso */}
      <div className="space-y-2">
        {filteredSales.length === 0 ? (
          <Card>
            <p className="text-center text-xs text-on-surface-variant py-4">
              {sales.length === 0
                ? "No hay transacciones registradas en este corte aún."
                : "No se encontraron transacciones que coincidan con los filtros de búsqueda."}
            </p>
          </Card>
        ) : (
          filteredSales.map((sale) => {
            const isExpanded = expandedSaleId === sale.id;
            const isCancelled = sale.status === "CANCELADA";
            const saleTime = formatBusinessTime(sale.createdAt);

            return (
              <Card
                key={sale.id}
                className={`transition ${isCancelled ? "border-error/40 bg-error/5" : "hover:border-primary/40"}`}
              >
                <div
                  className="flex cursor-pointer items-start justify-between gap-3 select-none"
                  onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-on-surface">
                        {saleTime}
                      </span>
                      <span className="text-[11px] font-semibold text-on-surface-variant">
                        · {timeAgo(sale.createdAt)}
                      </span>
                      <span className="font-mono text-xs text-on-surface-variant">
                        ({sale.code})
                      </span>
                      {isCancelled ? (
                        <span className="rounded-full bg-error/15 px-2 py-0.5 text-[10px] font-bold text-error">
                          CANCELADA
                        </span>
                      ) : sale.discountAmount > 0 ? (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                          Descuento
                        </span>
                      ) : null}
                    </div>

                    <p className="text-xs text-on-surface-variant">
                      Cajero: <span className="font-semibold text-on-surface">{sale.soldBy.name}</span>
                      {sale.payments && sale.payments.length > 0 && (
                        <span>
                          {" "}· Pago:{" "}
                          <span className="font-semibold text-on-surface">
                            {sale.payments.map((p) => `${p.method} ($${p.amount.toFixed(2)})`).join(", ")}
                          </span>
                        </span>
                      )}
                    </p>

                    <p className="text-xs text-on-surface line-clamp-1">
                      {sale.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                    </p>
                  </div>

                  <div className="text-right">
                    <span
                      className={`text-sm font-bold ${
                        isCancelled ? "text-error line-through" : "text-on-surface"
                      }`}
                    >
                      {formatMoney(sale.total)}
                    </span>
                    <p className="text-[10px] text-primary mt-0.5">
                      {isExpanded ? "Ocultar detalle ▲" : "Ver detalle ▼"}
                    </p>
                  </div>
                </div>

                {/* Detalle expandible del ticket */}
                {isExpanded && (
                  <div className="mt-3 border-t border-outline-variant/60 pt-3 text-xs space-y-2">
                    {isCancelled && (
                      <div className="rounded-lg bg-error/10 p-2.5 text-error">
                        <p className="font-bold">Motivo de cancelación:</p>
                        <p className="mt-0.5">{sale.cancelReason || "Sin motivo registrado"}</p>
                        {sale.cancelledAt && (
                          <p className="text-[10px] text-error/80 mt-1">
                            Cancelado a las: {formatBusinessDateTime(sale.cancelledAt)}
                          </p>
                        )}
                      </div>
                    )}

                    <div>
                      <p className="font-semibold text-on-surface-variant mb-1">Productos del ticket:</p>
                      <div className="divide-y divide-outline-variant/40 rounded-lg bg-surface-container p-2">
                        {sale.items.map((item) => (
                          <div key={item.id} className="flex justify-between py-1.5 first:pt-0 last:pb-0">
                            <div>
                              <span className="font-medium text-on-surface">
                                {item.quantity}x {item.name}
                              </span>
                              {item.description && (
                                <p className="text-[10px] text-on-surface-variant">{item.description}</p>
                              )}
                              {/* Insumos deducidos */}
                              {item.variant?.ingredients && item.variant.ingredients.length > 0 && (
                                <div className="mt-0.5 pl-2 text-[10px] text-on-surface-variant">
                                  <span>Receta deducida: </span>
                                  {item.variant.ingredients.map((ing, idx) => (
                                    <span key={ing.id}>
                                      {idx > 0 && ", "}
                                      {(Number(ing.quantity) * item.quantity).toFixed(2)}{" "}
                                      {ing.unit ?? ing.inventoryProduct.unit} de {ing.inventoryProduct.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <span className="font-semibold text-on-surface">{formatMoney(item.lineTotal)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-between text-[11px] text-on-surface-variant pt-1 border-t border-outline-variant/30">
                      <span>Subtotal: {formatMoney(sale.subtotal)}</span>
                      {sale.discountAmount > 0 && (
                        <span className="text-amber-600 dark:text-amber-400">
                          Descuento: -{formatMoney(sale.discountAmount)} {sale.discountReason ? `(${sale.discountReason})` : ""}
                        </span>
                      )}
                      <span className="font-bold text-on-surface">Total: {formatMoney(sale.total)}</span>
                    </div>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
