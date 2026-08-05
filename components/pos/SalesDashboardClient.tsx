"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";
import { ReceiptIcon, XIcon } from "@/components/ui/icons";

type SaleItem = { id: string; name: string; quantity: number; lineTotal: number };
type SalePayment = { method: string; amount: number };

type Sale = {
  id: string;
  code: string;
  status: string;
  subtotal: number;
  discountAmount: number;
  total: number;
  createdAt: string;
  branch: { id: string; name: string };
  soldBy: { id: string; name: string };
  cashCut: { id: string; code: string } | null;
  items: SaleItem[];
  payments: SalePayment[];
};

type BranchOption = { id: string; name: string };

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

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function SalesDashboardClient({
  branches,
  initialSales,
  canCancel,
}: {
  branches: BranchOption[];
  initialSales: Sale[];
  canCancel: boolean;
}) {
  const [branchId, setBranchId] = useState("");
  const [date, setDate] = useState(todayIso());
  const [sales, setSales] = useState<Sale[]>(initialSales);
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function refetch(nextBranchId: string, nextDate: string) {
    setLoading(true);
    const params = new URLSearchParams();
    if (nextBranchId) params.set("branchId", nextBranchId);
    const dayStart = new Date(`${nextDate}T00:00:00`);
    const dayEnd = new Date(`${nextDate}T23:59:59.999`);
    params.set("dateFrom", dayStart.toISOString());
    params.set("dateTo", dayEnd.toISOString());

    const res = await fetch(`/api/pos/sales?${params.toString()}`);
    if (res.ok) {
      setSales(await res.json());
    }
    setLoading(false);
  }

  function handleBranchChange(value: string) {
    setBranchId(value);
    refetch(value, date);
  }

  function handleDateChange(value: string) {
    setDate(value);
    refetch(branchId, value);
  }

  async function handleCancel(sale: Sale) {
    const reason = prompt(`Cancelar venta ${sale.code}. Motivo (opcional):`);
    if (reason === null) return;

    setCancellingId(sale.id);
    const res = await fetch(`/api/pos/sales/${sale.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    setCancellingId(null);

    if (!res.ok) {
      alert(data.error ?? "No fue posible cancelar la venta.");
      return;
    }

    refetch(branchId, date);
  }

  const activeSales = sales.filter((s) => s.status !== "CANCELADA");

  const summary = useMemo(() => {
    const totalSales = activeSales.reduce((sum, s) => sum + s.total, 0);
    const byMethod = new Map<string, number>();
    for (const sale of activeSales) {
      for (const payment of sale.payments) {
        byMethod.set(payment.method, (byMethod.get(payment.method) ?? 0) + payment.amount);
      }
    }
    return { totalSales, count: activeSales.length, byMethod };
  }, [activeSales]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">Ventas del Punto de Venta</h1>
        <p className="text-sm text-on-surface-variant">
          Consulta las ventas por sucursal y su corte de caja.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={branchId}
          onChange={(e) => handleBranchChange(e.target.value)}
          className="rounded-xl border border-outline-variant bg-surface-container px-4 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
        >
          <option value="">Todas las sucursales</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={date}
          onChange={(e) => handleDateChange(e.target.value)}
          className="rounded-xl border border-outline-variant bg-surface-container px-4 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardLabel>Ventas del día</CardLabel>
          <CardValue>{formatCurrency(summary.totalSales)}</CardValue>
          <p className="mt-1 text-xs text-on-surface-variant">
            {summary.count} venta{summary.count === 1 ? "" : "s"}
          </p>
        </Card>

        <Card>
          <CardLabel>Por método de pago</CardLabel>
          {summary.byMethod.size === 0 ? (
            <p className="text-sm text-on-surface-variant">Sin ventas</p>
          ) : (
            <div className="space-y-0.5">
              {Array.from(summary.byMethod.entries()).map(([method, amount]) => (
                <div key={method} className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">
                    {PAYMENT_LABELS[method] ?? method}
                  </span>
                  <span className="font-semibold text-on-surface">
                    {formatCurrency(amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-2">
        {loading && (
          <p className="text-center text-sm text-on-surface-variant">Cargando...</p>
        )}

        {!loading && sales.length === 0 && (
          <Card className="text-center">
            <p className="text-sm text-on-surface-variant">
              No hay ventas para este filtro.
            </p>
          </Card>
        )}

        {!loading &&
          sales.map((sale) => (
            <Card key={sale.id} className={sale.status === "CANCELADA" ? "opacity-60" : ""}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/pos/sales/${sale.id}`}
                      className="font-semibold text-on-surface hover:underline"
                    >
                      {sale.code}
                    </Link>
                    {sale.status === "CANCELADA" && (
                      <span className="rounded-full bg-error/15 px-2 py-0.5 text-[10px] font-bold text-error">
                        Cancelada
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-on-surface-variant">
                    {sale.branch.name} · {formatTime(sale.createdAt)} · {sale.soldBy.name}
                  </p>
                  <p className="mt-1 truncate text-xs text-on-surface-variant">
                    {sale.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-on-surface">
                    {formatCurrency(sale.total)}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {sale.payments.map((p) => PAYMENT_LABELS[p.method] ?? p.method).join(" + ")}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-outline-variant pt-3">
                {sale.cashCut ? (
                  <Link
                    href={`/cash-cuts/daily/${sale.cashCut.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    <ReceiptIcon className="h-3.5 w-3.5" />
                    Corte {sale.cashCut.code}
                  </Link>
                ) : (
                  <span />
                )}

                {canCancel && sale.status !== "CANCELADA" && (
                  <button
                    disabled={cancellingId === sale.id}
                    onClick={() => handleCancel(sale)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-error hover:underline disabled:opacity-40"
                  >
                    <XIcon className="h-3.5 w-3.5" />
                    {cancellingId === sale.id ? "Cancelando..." : "Cancelar"}
                  </button>
                )}
              </div>
            </Card>
          ))}
      </div>
    </div>
  );
}
