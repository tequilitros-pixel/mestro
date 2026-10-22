"use client";

import React, { useState } from "react";
import { CheckIcon, MailIcon, PrinterIcon, XIcon } from "@/components/ui/icons";
import ReceiptTicket, { type ReceiptData } from "./ReceiptTicket";
import { enqueueOperation } from "@/lib/offline/queue";

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(val);

export default function PostSaleModal({
  receipt,
  onClose,
}: {
  receipt: ReceiptData;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<"idle" | "success" | "error" | "queued">("idle");
  const [emailMessage, setEmailMessage] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  function handlePrint() {
    window.print();
  }

  async function handleSendEmail(e: React.FormEvent) {
    e.preventDefault();
    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      setEmailStatus("error");
      setEmailMessage("Ingresa un correo electrónico válido.");
      return;
    }

    setIsSendingEmail(true);
    setEmailStatus("idle");
    setEmailMessage("");

    // Si no hay internet, encolamos el envío de correo en la cola offline
    if (!navigator.onLine) {
      try {
        await enqueueOperation({
          id: `email-${crypto.randomUUID()}`,
          kind: "pos.sale.email",
          payload: {
            saleId: receipt.saleId,
            email: targetEmail,
            fallbackReceipt: receipt,
          },
          createdAt: new Date().toISOString(),
        });
        setEmailStatus("queued");
        setEmailMessage(`Sin conexión. El recibo se enviará a ${targetEmail} al volver el internet.`);
      } catch {
        setEmailStatus("error");
        setEmailMessage("No fue posible guardar el envío en este dispositivo.");
      } finally {
        setIsSendingEmail(false);
      }
      return;
    }

    // Si hay internet, llamamos a la API directamente
    try {
      const res = await fetch(`/api/pos/sales/${receipt.saleId}/receipt-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: targetEmail,
          fallbackReceipt: receipt,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error ?? "Error al enviar el correo.");
      }

      setEmailStatus("success");
      setEmailMessage(`¡Recibo enviado exitosamente a ${targetEmail}!`);
    } catch (err) {
      setEmailStatus("error");
      setEmailMessage(err instanceof Error ? err.message : "Error al enviar el correo.");
    } finally {
      setIsSendingEmail(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-outline-variant bg-surface-container p-6 shadow-2xl sm:p-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high transition"
          aria-label="Cerrar y nueva venta"
        >
          <XIcon className="h-5 w-5" />
        </button>

        {/* Header / Success Indicator (Estilo Square) */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500 shadow-inner">
            <CheckIcon className="h-8 w-8 stroke-[3]" />
          </div>
          <h2 className="text-2xl font-black text-on-surface">Cobro Exitoso</h2>
          <p className="text-sm font-semibold text-on-surface-variant">
            Folio: <span className="font-mono text-on-surface font-bold">{receipt.saleCode}</span>
          </p>
        </div>

        {/* Change Banner (si hubo pago en efectivo y cambio) */}
        {typeof receipt.change === "number" && receipt.change > 0 && (
          <div className="mt-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-center">
            <span className="text-xs uppercase tracking-wider font-bold text-emerald-600 block">
              Cambio a Entregar
            </span>
            <span className="text-3xl font-black text-emerald-600">
              {formatCurrency(receipt.change)}
            </span>
            {receipt.cashReceived && (
              <p className="text-xs text-on-surface-variant mt-1">
                Recibido: {formatCurrency(receipt.cashReceived)} · Total: {formatCurrency(receipt.total)}
              </p>
            )}
          </div>
        )}

        {/* Main Amount */}
        {(!receipt.change || receipt.change <= 0) && (
          <div className="mt-4 text-center">
            <span className="text-xs uppercase tracking-wider font-bold text-on-surface-variant block">
              Total Cobrado
            </span>
            <span className="text-3xl font-black text-on-surface">
              {formatCurrency(receipt.total)}
            </span>
          </div>
        )}

        {/* Square-style Actions */}
        <div className="mt-6 space-y-4">
          {/* Button: Print Ticket */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary px-5 py-3.5 text-base font-bold text-on-primary shadow-lg shadow-primary/25 transition active:scale-[0.98] hover:opacity-95"
          >
            <PrinterIcon className="h-5 w-5" />
            Imprimir Ticket Térmico
          </button>

          {/* Form: Email Ticket */}
          <form onSubmit={handleSendEmail} className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
              <MailIcon className="h-4 w-4" /> Enviar por correo electrónico
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cliente@ejemplo.com"
                disabled={isSendingEmail}
                className="flex-1 rounded-xl border border-outline-variant bg-surface px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSendingEmail || !email.trim()}
                className="rounded-xl border border-outline-variant bg-surface-container-high px-4 py-2.5 text-sm font-bold text-on-surface hover:bg-surface-container-highest transition disabled:opacity-50"
              >
                {isSendingEmail ? "Enviando…" : "Enviar"}
              </button>
            </div>

            {/* Email Feedback status */}
            {emailStatus === "success" && (
              <p className="text-xs font-semibold text-emerald-600 bg-emerald-500/10 p-2 rounded-lg text-center">
                {emailMessage}
              </p>
            )}
            {emailStatus === "queued" && (
              <p className="text-xs font-semibold text-amber-600 bg-amber-500/10 p-2 rounded-lg text-center">
                {emailMessage}
              </p>
            )}
            {emailStatus === "error" && (
              <p className="text-xs font-semibold text-error bg-error/10 p-2 rounded-lg text-center">
                {emailMessage}
              </p>
            )}
          </form>

          {/* Preview Toggle */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs font-semibold text-primary underline underline-offset-4 hover:opacity-80 transition"
            >
              {showPreview ? "Ocultar vista previa del ticket" : "Ver vista previa del ticket"}
            </button>
          </div>

          {/* Collapsible Ticket Preview */}
          {showPreview && (
            <div className="max-h-60 overflow-y-auto rounded-2xl bg-surface-container-high p-3">
              <ReceiptTicket data={receipt} showPreviewBorders={false} />
            </div>
          )}

          {/* Done / Next Sale Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl border border-outline-variant py-3 text-sm font-bold text-on-surface hover:bg-surface-container-high transition"
          >
            Siguiente Venta (Listo)
          </button>
        </div>
      </div>

      {/* Hidden container for thermal printing */}
      <div className="hidden">
        <ReceiptTicket data={receipt} containerId="thermal-receipt-print-area" />
      </div>
    </div>
  );
}
