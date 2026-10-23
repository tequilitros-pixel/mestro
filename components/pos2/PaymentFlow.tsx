"use client";

import { useMemo, useState } from "react";
import { money, paymentSummary, type UiPayment } from "@/lib/pos2/ui/payment";

const currency = (value: string) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value));

export default function PaymentFlow({ total, busy, verifying, onBack, onComplete }: { total: string; busy: boolean; verifying: boolean; onBack: () => void; onComplete: (payments: UiPayment[]) => void }) {
  const [payments, setPayments] = useState<UiPayment[]>([]);
  const [method, setMethod] = useState<UiPayment["method"]>("CASH");
  const [amount, setAmount] = useState(total);
  const [tendered, setTendered] = useState(total);
  const [reference, setReference] = useState("");
  const summary = useMemo(() => paymentSummary(total, payments), [total, payments]);

  function selectMethod(value: UiPayment["method"]) {
    setMethod(value);
    setAmount(summary.remaining);
    if (value === "CASH") setTendered(summary.remaining);
  }

  function add() {
    try {
      const normalized = money(amount);
      if (Number(normalized) <= 0 || Number(normalized) > Number(summary.remaining)) return;
      if (method === "CASH" && Number(money(tendered)) < Number(normalized)) return;
      setPayments((items) => [...items, { method, amount: normalized, ...(method === "CASH" ? { tendered: money(tendered) } : { reference: reference.trim() }) }]);
      const nextRemaining = Math.max(0, Number(summary.remaining) - Number(normalized)).toFixed(2);
      setAmount(nextRemaining);
      setTendered(nextRemaining);
      setReference("");
    } catch {
      return;
    }
  }

  return <div className="pos2-payment">
    <div className="pos2-payment-header"><button disabled={busy} onClick={onBack}>← Volver</button><div><small>Total a cobrar</small><h1>{currency(total)}</h1></div><span className={verifying ? "warning" : "secure"}>{verifying ? "Verificando resultado…" : "Cobro seguro"}</span></div>
    <div className="pos2-payment-body">
      <section>
        <h2>Método de pago</h2>
        <div className="pos2-methods">
          {(["CASH", "CARD", "TRANSFER"] as const).map((value) => <button className={method === value ? "active" : ""} onClick={() => selectMethod(value)} key={value}><span>{value === "CASH" ? "$" : value === "CARD" ? "▣" : "↗"}</span>{value === "CASH" ? "Efectivo" : value === "CARD" ? "Tarjeta" : "Transferencia"}</button>)}
          <button className="split" onClick={() => { const half = (Number(summary.remaining) / 2).toFixed(2); setAmount(half); setTendered(half); }}><span>½</span>Dividir pago</button>
        </div>
        <label>Monto<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        {method === "CASH" ? <><label>Recibido<input inputMode="decimal" value={tendered} onChange={(event) => setTendered(event.target.value)} /></label><div className="pos2-quick-tender" aria-label="Montos rápidos de efectivo">{[100, 200].map((value) => <button key={value} onClick={() => setTendered(value.toFixed(2))}>{currency(String(value))}</button>)}<button onClick={() => setTendered(amount)}>Exacto</button></div></> : <label>Referencia opcional<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Folio de terminal externa" /></label>}
        <button className="pos2-add-payment" onClick={add}>Agregar pago</button>
      </section>
      <aside>
        <h2>Resumen</h2>
        {payments.map((payment, index) => <div className="pos2-payment-row" key={`${payment.method}-${index}`}><span>{payment.method === "CASH" ? "Efectivo" : payment.method === "CARD" ? "Tarjeta" : "Transferencia"}</span><b>{currency(payment.amount)}</b><button aria-label={`Quitar pago ${index + 1}`} onClick={() => setPayments((items) => items.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>)}
        {!payments.length && <p className="pos2-muted">Agrega uno o varios métodos para completar el total.</p>}
        <div className="pos2-payment-totals"><div><span>Pagado</span><b>{currency(summary.paid)}</b></div><div><span>Restante</span><b>{currency(summary.remaining)}</b></div>{Number(summary.change) > 0 && <div className="change"><span>Cambio</span><b>{currency(summary.change)}</b></div>}</div>
        <button data-testid="complete-sale" className="pos2-pay" disabled={!summary.valid || busy} onClick={() => onComplete(payments)}>{verifying ? "Consultar misma operación" : busy ? "Confirmando…" : "Confirmar venta"}</button>
        {verifying && <p className="pos2-verify-note">No inicies otro cobro. Reintentaremos con el mismo identificador para confirmar si la venta ya existe.</p>}
      </aside>
    </div>
  </div>;
}
