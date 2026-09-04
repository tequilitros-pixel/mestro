"use client";
import Link from "next/link";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { Accordion } from "./CashCutAccordion";
import { CashCutSummaryCard } from "./CashCutSummaryCard";

interface CashCut {
  id: string;
  code: string;
  status: string;
  branch: { id: string; name: string };
  startingFund: number;
  cashCounted: number | null;
  cashExpected: number | null;
  difference: number | null;
  envelopeAmount: number | null;
  envelopeNumber: string | null;
  nextFund: number | null;
  totalSales: number | null;
  totalOutflows: number | null;
  totalInflows: number | null;
  openedAt: string;
  closedAt: string | null;
  responsible: { id: string; name: string };
  createdBy: { id: string; name: string };
  updatedBy: { id: string; name: string } | null;
  event: { id: string; code: string; clientName: string; location: string; eventDate: string } | null;
  salesByMethod: Array<{ id: string; method: string; amount: number }>;
  posSales: Array<{
    id: string;
    code: string;
    subtotal: number;
    discountAmount: number;
    total: number;
    createdAt: string;
    soldBy: { id: string; name: string };
    items: Array<{ id: string; name: string; description: string | null; quantity: number; unitPrice: number; lineTotal: number }>;
  }>;
  inflows: Array<{ id: string; type: string; amount: number }>;
  outflows: Array<{ id: string; concept: string; category: string; amount: number }>;
  evidences: Array<{ id: string; type: string; url: string; notes: string | null; createdAt: string }>;
}

const formatMoney = (v: number | null) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(v ?? 0);
const formatDateTime = (v: string | null) => v ? new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" }).format(new Date(v)) : "Sin registrar";

const METODOS = [
  { key: "EFECTIVO", label: "Efectivo" },
  { key: "TARJETA", label: "Tarjeta" },
  { key: "TRANSFERENCIA", label: "Transferencia" },
  { key: "DIDI", label: "DiDi" },
  { key: "UBER", label: "Uber" },
  { key: "RAPPI", label: "Rappi" },
  { key: "VALES", label: "Vales" },
  { key: "OTRO", label: "Otro" },
];

const TIPOS_EVIDENCIA = [
  { key: "DINERO_CONTADO", label: "Dinero contado" },
  { key: "SOBRE", label: "Sobre" },
  { key: "TICKET", label: "Ticket" },
  { key: "NOTA", label: "Nota" },
  { key: "FACTURA", label: "Factura" },
  { key: "OTRO", label: "Otro" },
];

export function ClosedCutSummaryRefactored({ cashCut }: { cashCut: CashCut }) {
  const posSales = cashCut.posSales ?? [];
  const products = new Map<string, { name: string; quantity: number; total: number }>();
  for (const sale of posSales) {
    for (const item of sale.items) {
      const name = item.description || item.name;
      const current = products.get(name) ?? { name, quantity: 0, total: 0 };
      current.quantity += item.quantity;
      current.total += item.lineTotal;
      products.set(name, current);
    }
  }
  const productRows = [...products.values()].sort((a, b) => b.total - a.total);
  const posTotal = posSales.reduce((sum, sale) => sum + sale.total, 0);
  const discountTotal = posSales.reduce((sum, sale) => sum + sale.discountAmount, 0);
  const manualSales = Math.max(0, (cashCut.totalSales ?? 0) - posTotal);

  return (
    <div className="mx-auto max-w-3xl p-6 pb-24 sm:pb-6">
      <Link href="/cash-cuts" className="inline-flex items-center gap-1 text-sm font-semibold text-primary mb-6">
        <ChevronLeftIcon className="h-4 w-4" /> Volver a cortes
      </Link>

      <Card highlight className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardLabel>{cashCut.branch.name}</CardLabel>
            <CardValue>{cashCut.code}</CardValue>
            <p className="mt-1 text-sm text-on-surface-variant">Radiografía completa del turno</p>
          </div>
          <span className="rounded-full bg-surface-container-highest px-3 py-1 text-xs font-bold text-on-surface-variant">
            {cashCut.status}
          </span>
        </div>
      </Card>

      {/* Resumen crítico flotante */}
      {cashCut.cashCounted !== null && (
        <CashCutSummaryCard
          summary={{
            cashCounted: cashCut.cashCounted,
            cashExpected: cashCut.cashExpected ?? 0,
            difference: cashCut.difference ?? 0,
            envelopeAmount: cashCut.envelopeAmount ?? 0,
            nextFund: cashCut.nextFund ?? 0,
          }}
        />
      )}

      <div className="space-y-3">
        {/* Turno y responsables */}
        <Accordion title={`Turno y responsables • ${formatDateTime(cashCut.openedAt)}`}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-on-surface-variant">Responsable</p>
              <p className="font-semibold text-on-surface">{cashCut.responsible?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">Abierto por</p>
              <p className="font-semibold text-on-surface">{cashCut.createdBy?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">Cierre</p>
              <p className="font-semibold text-on-surface">{formatDateTime(cashCut.closedAt)}</p>
            </div>
            {cashCut.event && (
              <div>
                <p className="text-xs text-on-surface-variant">Evento</p>
                <p className="font-semibold text-on-surface text-sm">{cashCut.event.code}</p>
              </div>
            )}
          </div>
        </Accordion>

        {/* Ventas */}
        <Accordion title={`Ventas • ${formatMoney(cashCut.totalSales)}`} defaultOpen>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-on-surface-variant">Tickets POS</p>
                <p className="font-bold">{posSales.length}</p>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant">Captura manual</p>
                <p className="font-bold">{formatMoney(manualSales)}</p>
              </div>
            </div>

            {cashCut.salesByMethod.filter((s) => s.amount > 0).length > 0 && (
              <div className="pt-2 border-t border-outline-variant space-y-1.5">
                {cashCut.salesByMethod.filter((s) => s.amount > 0).map((sale) => (
                  <div key={sale.id} className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">{METODOS.find((m) => m.key === sale.method)?.label ?? sale.method}</span>
                    <span className="font-semibold text-on-surface">{formatMoney(sale.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Accordion>

        {/* Productos vendidos */}
        {productRows.length > 0 && (
          <Accordion title={`Productos • ${productRows.length} tipo(s)`}>
            <div className="space-y-2">
              {productRows.map((product) => (
                <div key={product.name} className="flex justify-between text-sm">
                  <div>
                    <p className="font-semibold text-on-surface">{product.name}</p>
                    <p className="text-xs text-on-surface-variant">{product.quantity} unidad(es)</p>
                  </div>
                  <p className="font-bold text-on-surface">{formatMoney(product.total)}</p>
                </div>
              ))}
            </div>
          </Accordion>
        )}

        {/* Movimientos */}
        {(cashCut.inflows.length > 0 || cashCut.outflows.length > 0) && (
          <Accordion title="Movimientos del turno">
            <div className="grid grid-cols-2 gap-3">
              {cashCut.inflows.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-on-surface-variant mb-2">Entradas • {formatMoney(cashCut.totalInflows)}</p>
                  <div className="space-y-1">
                    {cashCut.inflows.map((entry) => (
                      <div key={entry.id} className="flex justify-between text-sm">
                        <span className="text-on-surface-variant">{entry.type}</span>
                        <b className="text-on-surface">{formatMoney(entry.amount)}</b>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {cashCut.outflows.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-on-surface-variant mb-2">Salidas • {formatMoney(cashCut.totalOutflows)}</p>
                  <div className="space-y-1">
                    {cashCut.outflows.map((entry) => (
                      <div key={entry.id} className="flex justify-between text-sm">
                        <span className="text-on-surface-variant">{entry.concept}</span>
                        <b className="text-on-surface">{formatMoney(entry.amount)}</b>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Accordion>
        )}

        {/* Evidencias */}
        {cashCut.evidences.length > 0 && (
          <Accordion title={`Evidencias • ${cashCut.evidences.length}`}>
            <p className="text-sm text-on-surface-variant">{cashCut.evidences.length} archivo(s) asociado(s).</p>
          </Accordion>
        )}
      </div>
    </div>
  );
}
