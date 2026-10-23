"use client";

import React from "react";

export type ReceiptData = {
  saleId: string;
  saleCode: string;
  branchName: string;
  branchAddress?: string | null;
  date: string;
  cashierName?: string | null;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  subtotal: number;
  discountAmount: number;
  total: number;
  payments: Array<{
    method: string;
    amount: number;
  }>;
  cashReceived?: number | null;
  change?: number | null;
  isOffline?: boolean;
};

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(val);

const paymentLabels: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
  DIDI: "DiDi",
  UBER: "Uber",
  RAPPI: "Rappi",
  VALES: "Vales",
  OTRO: "Otro",
};

export default function ReceiptTicket({
  data,
  containerId = "thermal-receipt-print-area",
  showPreviewBorders = true,
  printable = true,
}: {
  data: ReceiptData;
  containerId?: string;
  showPreviewBorders?: boolean;
  printable?: boolean;
}) {
  return (
    <div
      id={containerId}
      className={`mx-auto w-full max-w-[320px] bg-white p-4 font-mono text-xs text-black leading-tight ${
        showPreviewBorders ? "rounded-xl border border-gray-200 shadow-sm" : ""
      }`}
    >
      {printable && <style>{`
        @media print {
          @page {
            margin: 0;
            size: 80mm auto;
          }
          body * {
            visibility: hidden !important;
          }
          #${containerId}, #${containerId} * {
            visibility: visible !important;
          }
          #${containerId} {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 78mm !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 4mm 2mm !important;
            background: #fff !important;
            color: #000 !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>}

      {/* Header */}
      <div className="text-center pb-2 border-b border-dashed border-gray-400">
        <h2 className="text-sm font-black uppercase tracking-wider">
          DESTILADORA DEL NORTE
        </h2>
        <p className="text-[11px] font-semibold text-gray-800">{data.branchName}</p>
        {data.branchAddress && (
          <p className="text-[10px] text-gray-600">{data.branchAddress}</p>
        )}
      </div>

      {/* Metadata */}
      <div className="py-2 border-b border-dashed border-gray-400 text-[10px] space-y-0.5">
        <div className="flex justify-between">
          <span className="text-gray-600">Folio:</span>
          <span className="font-bold">{data.saleCode}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Fecha:</span>
          <span>{data.date}</span>
        </div>
        {data.cashierName && (
          <div className="flex justify-between">
            <span className="text-gray-600">Atendió:</span>
            <span>{data.cashierName}</span>
          </div>
        )}
        {data.isOffline && (
          <div className="text-center font-bold text-[10px] bg-gray-100 py-0.5 rounded text-gray-700">
            * OPERACIÓN REGISTRADA SIN CONEXIÓN *
          </div>
        )}
      </div>

      {/* Table Items */}
      <div className="py-2 border-b border-dashed border-gray-400 space-y-1.5">
        <div className="flex justify-between text-[10px] font-bold uppercase text-gray-500 pb-0.5">
          <span>Cant · Concepto</span>
          <span>Importe</span>
        </div>
        {data.items.map((item, index) => (
          <div key={index} className="flex justify-between items-start gap-1">
            <div className="min-w-0 pr-1">
              <span className="font-semibold">{item.quantity}×</span>{" "}
              <span>{item.name}</span>
              {item.quantity > 1 && (
                <div className="text-[9px] text-gray-500">
                  {formatCurrency(item.unitPrice)} c/u
                </div>
              )}
            </div>
            <span className="font-bold shrink-0">
              {formatCurrency(item.lineTotal)}
            </span>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="py-2 border-b border-dashed border-gray-400 space-y-1 text-xs">
        <div className="flex justify-between text-gray-700">
          <span>Subtotal</span>
          <span>{formatCurrency(data.subtotal)}</span>
        </div>
        {data.discountAmount > 0 && (
          <div className="flex justify-between text-gray-700">
            <span>Descuento</span>
            <span>−{formatCurrency(data.discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-black pt-1 border-t border-gray-300">
          <span>TOTAL</span>
          <span>{formatCurrency(data.total)}</span>
        </div>
      </div>

      {/* Payments */}
      <div className="py-2 border-b border-dashed border-gray-400 text-[10px] space-y-0.5">
        <span className="font-bold uppercase text-gray-500 block mb-0.5">
          Forma de Pago
        </span>
        {data.payments.map((p, index) => (
          <div key={index} className="flex justify-between">
            <span>{paymentLabels[p.method] ?? p.method}</span>
            <span className="font-semibold">{formatCurrency(p.amount)}</span>
          </div>
        ))}
        {typeof data.cashReceived === "number" && data.cashReceived > 0 && (
          <div className="flex justify-between text-gray-600 pt-0.5">
            <span>Efectivo recibido:</span>
            <span>{formatCurrency(data.cashReceived)}</span>
          </div>
        )}
        {typeof data.change === "number" && data.change > 0 && (
          <div className="flex justify-between font-bold text-gray-900 pt-0.5">
            <span>Cambio entregado:</span>
            <span>{formatCurrency(data.change)}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-3 text-center text-[10px] text-gray-600 space-y-1">
        <p className="font-bold text-black">¡GRACIAS POR SU COMPRA!</p>
        <p className="text-[9px]">Comprobante simplificado de venta</p>
      </div>
    </div>
  );
}
