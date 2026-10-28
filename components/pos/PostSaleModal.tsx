"use client";

import React, { useEffect, useState } from "react";
import {
  CheckIcon,
  MailIcon,
  PrinterIcon,
  XIcon,
  SettingsIcon,
  RefreshIcon,
  AlertIcon,
} from "@/components/ui/icons";
import ReceiptTicket, { type ReceiptData } from "./ReceiptTicket";
import { enqueueOperation } from "@/lib/offline/queue";
import {
  type PrinterSettings,
  type PrinterConnectionType,
  getStoredPrinterSettings,
  saveStoredPrinterSettings,
  printReceiptUniversal,
  isWebBluetoothSupported,
  isWebSerialSupported,
} from "@/lib/pos/thermalPrinter";
import PrinterSettingsModal from "./PrinterSettingsModal";
import { triggerAlertFeedback } from "@/lib/feedback";

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

  // Impresión térmica universal
  const [printerSettings, setPrinterSettings] = useState<PrinterSettings>(getStoredPrinterSettings);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printStatus, setPrintStatus] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printSuccess, setPrintSuccess] = useState(false);
  const [showPrinterSettings, setShowPrinterSettings] = useState(false);

  useEffect(() => {
    triggerAlertFeedback("success");
    setPrinterSettings(getStoredPrinterSettings());
  }, []);

  async function handlePrint(overrideType?: PrinterConnectionType) {
    const currentSettings = overrideType
      ? { ...printerSettings, type: overrideType }
      : printerSettings;

    if (overrideType && overrideType !== printerSettings.type) {
      saveStoredPrinterSettings(currentSettings);
      setPrinterSettings(currentSettings);
    }

    setIsPrinting(true);
    setPrintStatus("Preparando impresión…");
    setPrintError(null);
    setPrintSuccess(false);

    try {
      const res = await printReceiptUniversal(receipt, currentSettings, (status) => {
        setPrintStatus(status);
      });

      if (res.success) {
        setPrintSuccess(true);
        setPrintStatus(`Ticket impreso en ${res.deviceName || "impresora"}`);
        setTimeout(() => {
          setPrintSuccess(false);
          setPrintStatus(null);
        }, 4000);
      } else {
        setPrintError(res.error || "No fue posible imprimir el ticket.");
      }
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : "Error al enviar el ticket.");
    } finally {
      setIsPrinting(false);
    }
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
          {/* Printer Selector & Status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                <PrinterIcon className="h-4 w-4" /> Impresora de Tickets ({printerSettings.paperWidth})
              </span>
              <button
                type="button"
                onClick={() => setShowPrinterSettings(true)}
                className="flex items-center gap-1 font-semibold text-primary hover:underline"
              >
                <SettingsIcon className="h-3.5 w-3.5" />
                Configurar
              </button>
            </div>

            {/* Quick Switch Buttons */}
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-surface-container-high border border-outline-variant">
              <button
                type="button"
                onClick={() => handlePrint("bluetooth")}
                disabled={isPrinting}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition ${
                  printerSettings.type === "bluetooth"
                    ? "bg-surface text-primary shadow-sm ring-1 ring-primary/30"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface/50"
                }`}
                title="Impresión portátil inalámbrica Bluetooth"
              >
                <span>📱</span>
                <span className="truncate">Bluetooth</span>
              </button>

              <button
                type="button"
                onClick={() => handlePrint("usb")}
                disabled={isPrinting}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition ${
                  printerSettings.type === "usb"
                    ? "bg-surface text-primary shadow-sm ring-1 ring-primary/30"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface/50"
                }`}
                title="Conexión directa por cable USB Tipo-C u OTG"
              >
                <span>🔌</span>
                <span className="truncate">Cable USB</span>
              </button>

              <button
                type="button"
                onClick={() => handlePrint("system")}
                disabled={isPrinting}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition ${
                  printerSettings.type === "system"
                    ? "bg-surface text-primary shadow-sm ring-1 ring-primary/30"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface/50"
                }`}
                title="Ventana estándar de impresión del sistema / PDF"
              >
                <span>🖨️</span>
                <span className="truncate">Sistema</span>
              </button>
            </div>
          </div>

          {/* Primary Action Button: Print Ticket */}
          <button
            type="button"
            disabled={isPrinting}
            onClick={() => handlePrint()}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary px-5 py-3.5 text-base font-bold text-on-primary shadow-lg shadow-primary/25 transition active:scale-[0.98] hover:opacity-95 disabled:opacity-60"
          >
            {isPrinting ? (
              <>
                <RefreshIcon className="h-5 w-5 animate-spin" />
                <span>{printStatus || "Imprimiendo…"}</span>
              </>
            ) : (
              <>
                <PrinterIcon className="h-5 w-5" />
                <span>
                  Imprimir Ticket (
                  {printerSettings.type === "bluetooth"
                    ? "Bluetooth"
                    : printerSettings.type === "usb"
                    ? "Cable USB"
                    : "Sistema"}
                  )
                </span>
              </>
            )}
          </button>

          {/* Print Feedback Status */}
          {printSuccess && (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 p-2.5 text-xs font-semibold text-emerald-600 border border-emerald-500/20">
              <CheckIcon className="h-4 w-4" />
              <span>{printStatus}</span>
            </div>
          )}

          {printError && (
            <div className="rounded-xl bg-error/10 p-3 text-xs font-semibold text-error border border-error/20 space-y-2">
              <div className="flex items-start gap-2">
                <AlertIcon className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="flex-1">{printError}</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1 border-t border-error/20">
                <span className="text-[11px] text-error/80 self-center">Opciones rápidas:</span>
                {printerSettings.type !== "usb" && (
                  <button
                    type="button"
                    onClick={() => handlePrint("usb")}
                    className="rounded-lg bg-surface px-2.5 py-1 text-[11px] font-bold text-on-surface shadow-sm hover:bg-surface-container-high transition"
                  >
                    🔌 Probar con Cable USB
                  </button>
                )}
                {printerSettings.type !== "system" && (
                  <button
                    type="button"
                    onClick={() => handlePrint("system")}
                    className="rounded-lg bg-surface px-2.5 py-1 text-[11px] font-bold text-on-surface shadow-sm hover:bg-surface-container-high transition"
                  >
                    🖨️ Usar Diálogo del Sistema
                  </button>
                )}
              </div>
            </div>
          )}

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
              <ReceiptTicket
                data={receipt}
                paperWidth={printerSettings.paperWidth}
                containerId="thermal-receipt-preview"
                showPreviewBorders={false}
                printable={false}
              />
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
      <div className="hidden print:block">
        <ReceiptTicket
          data={receipt}
          paperWidth={printerSettings.paperWidth}
          containerId="thermal-receipt-print-area"
        />
      </div>

      {/* Printer Settings Modal */}
      {showPrinterSettings && (
        <PrinterSettingsModal
          settings={printerSettings}
          onSave={(newSettings) => setPrinterSettings(newSettings)}
          onClose={() => setShowPrinterSettings(false)}
        />
      )}
    </div>
  );
}
