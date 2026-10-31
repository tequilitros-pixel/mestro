"use client";

import { useRef, useState } from "react";
import {
  OFFICIAL_WHATSAPP_PHONE,
  OFFICIAL_WHATSAPP_DISPLAY,
  OFFICIAL_CONTRACT_CLAUSES,
  CONSUMO_PRICES_CATALOG,
  type TequilitrosQuoteMetadata,
  type QuoteStatus,
} from "@/lib/tequilitros/quote-types";
import { generateTequilitrosPdfBlob } from "@/lib/tequilitros/pdf-generator";
import { updateQuoteStatusAndDepositAction } from "./actions";
import { PrinterIcon, XIcon, CheckIcon, ArrowDownIcon } from "@/components/ui/icons";

interface QuoteDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType?: "QUOTE" | "CONTRACT" | "RECEIPT";
  data: {
    code: string;
    clientName: string;
    clientPhone?: string | null;
    clientEmail?: string | null;
    location: string;
    eventDate: string; // ISO
    guestCount: number;
    saleAmount: number;
    metadata: TequilitrosQuoteMetadata;
  };
  onUpdateMetadata?: (newMetadata: TequilitrosQuoteMetadata) => void;
}

export default function QuoteDocumentModal({
  isOpen,
  onClose,
  documentType = "QUOTE",
  data,
  onUpdateMetadata,
}: QuoteDocumentModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Estado del metadata dinámico (permite actualizarse dentro del mismo modal)
  const [currentMetadata, setCurrentMetadata] = useState<TequilitrosQuoteMetadata>(data.metadata);

  // Tipo de documento activo (Pestañas: Cotización, Recibo, Contrato)
  const [activeDocType, setActiveDocType] = useState<"QUOTE" | "CONTRACT" | "RECEIPT">(() => {
    if (documentType) return documentType;
    if (data.metadata.isContractConfirmed || data.metadata.status === "CONFIRMED") return "CONTRACT";
    return "QUOTE";
  });

  // Panel de gestión de estatus y anticipo
  const [showStatusManager, setShowStatusManager] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<QuoteStatus>(
    currentMetadata.status || (currentMetadata.isContractConfirmed ? "CONFIRMED" : "PENDING")
  );
  const [depositInput, setDepositInput] = useState<number>(() => {
    if (currentMetadata.depositPaid && currentMetadata.depositPaid > 0) return currentMetadata.depositPaid;
    return currentMetadata.modality === "consumo"
      ? data.saleAmount
      : currentMetadata.depositRequired || Math.round(data.saleAmount * 0.5);
  });
  const [depositDateInput, setDepositDateInput] = useState<string>(() => {
    if (currentMetadata.depositPaidAt) {
      return currentMetadata.depositPaidAt.slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  });
  const [depositMethodInput, setDepositMethodInput] = useState<string>(
    currentMetadata.depositMethod || "Efectivo en Sucursal"
  );
  const [notesInput, setNotesInput] = useState<string>(currentMetadata.contractNotes || "");
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [copiedLink, setCopiedLink] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  if (!isOpen) return null;

  const isConfirmed = Boolean(currentMetadata.isContractConfirmed || currentMetadata.status === "CONFIRMED");
  const isApproved = currentMetadata.status === "APPROVED";
  const isRejected = currentMetadata.status === "REJECTED";
  const isConsumo = currentMetadata.modality === "consumo";

  const formattedDate = new Date(data.eventDate).toLocaleDateString("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  const formattedIssueDate = new Date().toLocaleDateString("es-MX", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const atencionTotal = currentMetadata.durationHours * 250;
  const fijoTotal = isConsumo ? atencionTotal + currentMetadata.viaticosCost : data.saleAmount;

  const depositRequired = isConsumo
    ? fijoTotal
    : currentMetadata.depositRequired || Math.round(data.saleAmount * 0.5);
  const depositPaid = currentMetadata.depositPaid ?? (isConfirmed ? depositRequired : 0);
  const balanceRemaining = isConsumo ? 0 : Math.max(0, data.saleAmount - depositPaid);
  const creditBalance = isConsumo ? 0 : Math.max(0, depositPaid - data.saleAmount);

  const displayFolio = isConfirmed
    ? currentMetadata.contractFolio || data.code
    : currentMetadata.folio || data.code;
  const receiptFolio = currentMetadata.receiptFolio || `REC-${displayFolio.replace(/[^0-9]/g, "").slice(-4) || "0001"}`;

  const publicQuoteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/tequilitros/cotizacion/${encodeURIComponent(displayFolio)}`
      : `https://maestro-destiladora.space/tequilitros/cotizacion/${encodeURIComponent(displayFolio)}`;

  const handleCopyLink = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(publicQuoteUrl);
      } else {
        throw new Error("No clipboard");
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      const input = document.createElement("input");
      input.value = publicQuoteUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // Guardar estatus, anticipo y generar contrato/recibo
  const handleSaveStatusAndDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingStatus(true);
    setStatusFeedback(null);

    try {
      const res = await updateQuoteStatusAndDepositAction({
        eventId: data.code,
        status: selectedStatus,
        depositPaid: selectedStatus === "CONFIRMED" || depositInput > 0 ? depositInput : 0,
        depositPaidAt: depositDateInput,
        depositMethod: depositMethodInput,
        contractNotes: notesInput,
        branchName: currentMetadata.branchName,
      });

      if (res.success && res.metadata) {
        setCurrentMetadata(res.metadata);
        onUpdateMetadata?.(res.metadata);
        setStatusFeedback({ type: "success", text: "¡Estatus y anticipo guardados correctamente!" });

        // Si se confirmó, cambiar la vista al Contrato o Recibo automáticamente
        if (selectedStatus === "CONFIRMED") {
          setActiveDocType("CONTRACT");
        }

        setTimeout(() => {
          setShowStatusManager(false);
          setStatusFeedback(null);
        }, 1500);
      } else {
        setStatusFeedback({ type: "error", text: res.error || "No se pudo actualizar la cotización." });
      }
    } catch (err) {
      setStatusFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Error inesperado al guardar.",
      });
    } finally {
      setSavingStatus(false);
    }
  };

  // Mensaje para WhatsApp cliente
  const whatsappClientText = isConfirmed
    ? activeDocType === "RECEIPT"
      ? `🧾 *RECIBO OFICIAL DE ANTICIPO - TEQUILITROS EVENTOS*\n` +
        `Folio de Recibo: ${receiptFolio}\n` +
        `Contrato de Referencia: ${displayFolio}\n` +
        `Cliente: ${data.clientName}\n` +
        `Fecha de Evento: ${formattedDate}\n` +
        `✅ *Anticipo Recibido:* $${depositPaid.toLocaleString("es-MX")} MXN (${currentMetadata.depositMethod || "Efectivo"})\n` +
        `Saldo pendiente el día del evento: $${balanceRemaining.toLocaleString("es-MX")} MXN\n\n` +
        `🌐 *Ver tu recibo y contrato oficial en línea:* \n${publicQuoteUrl}\n\n` +
        `¡Tu fecha está oficialmente congelada y apartada!`
      : `📋 *CONTRATO OFICIAL DE EVENTO - TEQUILITROS*\n` +
        `Folio: ${displayFolio}\n` +
        `Cliente: ${data.clientName}\n` +
        `Fecha confirmada: ${formattedDate}\n` +
        `Invitados: ${data.guestCount} personas\n` +
        `Total del servicio: $${data.saleAmount.toLocaleString("es-MX")} MXN\n` +
        `✅ *Anticipo recibido:* $${depositPaid.toLocaleString("es-MX")} MXN\n` +
        `Saldo pendiente el día del evento: $${balanceRemaining.toLocaleString("es-MX")} MXN\n\n` +
        `🌐 *Ver tu contrato oficial en línea:* \n${publicQuoteUrl}\n\n` +
        `¡Tu fecha está oficialmente congelada y apartada en agenda!`
    : `🍸 *COTIZACIÓN DE BARRA MÓVIL - TEQUILITROS EVENTOS*\n` +
      `Folio: ${data.code}\n` +
      `Cliente: ${data.clientName}\n` +
      `Fecha: ${formattedDate}\n` +
      `Lugar: ${data.location}\n` +
      `Invitados: ${data.guestCount} personas\n` +
      `Modalidad: ${isConsumo ? "Barra a Consumo" : `Barra Libre (${currentMetadata.durationHours} hrs)`}\n` +
      `*Inversión Total:* $${data.saleAmount.toLocaleString("es-MX")} MXN\n` +
      `*Anticipo para apartar (50%):* $${depositRequired.toLocaleString("es-MX")} MXN\n\n` +
      `🌐 *Consulta tu presupuesto interactivo en línea:* \n${publicQuoteUrl}\n\n` +
      `📲 Para apartar tu fecha, comunícate al WhatsApp oficial: ${OFFICIAL_WHATSAPP_DISPLAY}`;

  const clientWhatsAppUrl = data.clientPhone
    ? `https://wa.me/${data.clientPhone.replace(/\D/g, "")}?text=${encodeURIComponent(whatsappClientText)}`
    : null;

  const handleDownloadPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      const blob = await generateTequilitrosPdfBlob({
        code: data.code,
        clientName: data.clientName,
        clientPhone: data.clientPhone,
        clientEmail: data.clientEmail,
        location: data.location,
        eventDate: data.eventDate,
        guestCount: data.guestCount,
        saleAmount: data.saleAmount,
        documentType: activeDocType,
        metadata: currentMetadata,
      });

      const prefix =
        activeDocType === "RECEIPT"
          ? "Recibo"
          : activeDocType === "CONTRACT"
            ? "Contrato"
            : "Cotizacion";
      const fileFolio =
        activeDocType === "RECEIPT"
          ? receiptFolio
          : activeDocType === "CONTRACT"
            ? currentMetadata.contractFolio || data.code
            : data.code;

      const fileName = `${prefix}-${fileFolio}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error al descargar PDF:", err);
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleSharePdf = async () => {
    try {
      setIsGeneratingPdf(true);
      const blob = await generateTequilitrosPdfBlob({
        code: data.code,
        clientName: data.clientName,
        clientPhone: data.clientPhone,
        clientEmail: data.clientEmail,
        location: data.location,
        eventDate: data.eventDate,
        guestCount: data.guestCount,
        saleAmount: data.saleAmount,
        documentType: activeDocType,
        metadata: currentMetadata,
      });

      const prefix =
        activeDocType === "RECEIPT"
          ? "Recibo"
          : activeDocType === "CONTRACT"
            ? "Contrato"
            : "Cotizacion";
      const fileFolio =
        activeDocType === "RECEIPT"
          ? receiptFolio
          : activeDocType === "CONTRACT"
            ? currentMetadata.contractFolio || data.code
            : data.code;

      const fileName = `${prefix}-${fileFolio}.pdf`;
      const file = new File([blob], fileName, { type: "application/pdf" });

      if (
        typeof navigator !== "undefined" &&
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: `${prefix} Tequilitros ${fileFolio}`,
          text: `${prefix} oficial de Barra Móvil Tequilitros para ${data.clientName}`,
        });
      } else {
        await handleDownloadPdf();
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Error al compartir:", err);
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-3 sm:p-6 backdrop-blur-sm print:p-0 print:bg-white print:static print:overflow-visible print:block">
      <div className="relative flex max-h-[96vh] w-full max-w-4xl flex-col rounded-2xl border border-outline-variant bg-surface text-on-surface shadow-2xl print:max-h-none print:border-none print:shadow-none print:w-full print:max-w-none print:bg-white print:text-black print:static print:block">
        {/* BARRA SUPERIOR DE PESTAÑAS Y ACCIONES */}
        <div className="border-b border-outline-variant px-5 py-3 print:hidden bg-surface-container space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Pestañas de Vista de Documento */}
            <div className="flex items-center gap-1.5 bg-surface-container-high p-1 rounded-xl border border-outline-variant text-xs">
              <button
                type="button"
                onClick={() => setActiveDocType("QUOTE")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  activeDocType === "QUOTE"
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span>📄</span>
                <span>Cotización</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveDocType("RECEIPT")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  activeDocType === "RECEIPT"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span>🧾</span>
                <span>Recibo de Anticipo</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveDocType("CONTRACT")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  activeDocType === "CONTRACT"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span>📑</span>
                <span>Contrato</span>
              </button>
            </div>

            {/* Botón para abrir el Gestor de Estatus y Anticipo */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowStatusManager((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition cursor-pointer shadow-sm border ${
                  showStatusManager
                    ? "bg-primary text-on-primary border-primary"
                    : isConfirmed
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25"
                      : isApproved
                        ? "bg-blue-500/15 border-blue-500/40 text-blue-300 hover:bg-blue-500/25"
                        : "bg-[#E28735]/15 border-[#E28735]/40 text-[#E28735] hover:bg-[#E28735]/25"
                }`}
              >
                <span>⚡</span>
                <span>
                  {showStatusManager
                    ? "Ocultar Gestor"
                    : isConfirmed
                      ? "Anticipo & Estatus (Confirmado)"
                      : "Registrar Anticipo / Estatus"}
                </span>
              </button>

              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition cursor-pointer"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Barra de Acciones de Exportación / Enlace */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-outline-variant/50">
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                  isConfirmed
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : isApproved
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      : isRejected
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                }`}
              >
                {isConfirmed
                  ? "CONFIRMADA CON ANTICIPO"
                  : isApproved
                    ? "APROBADA POR CLIENTE"
                    : isRejected
                      ? "NO APROBADA / RECHAZADA"
                      : "COTIZACIÓN PENDIENTE"}
              </span>
              <span className="font-mono text-xs text-on-surface-variant font-bold">
                {activeDocType === "RECEIPT"
                  ? receiptFolio
                  : activeDocType === "CONTRACT"
                    ? currentMetadata.contractFolio || data.code
                    : data.code}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {/* Descargar PDF */}
              <button
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary hover:opacity-90 disabled:opacity-50 transition shadow-sm cursor-pointer"
              >
                <ArrowDownIcon className="h-4 w-4" />
                <span>
                  {isGeneratingPdf
                    ? "Generando..."
                    : activeDocType === "RECEIPT"
                      ? "Descargar Recibo"
                      : activeDocType === "CONTRACT"
                        ? "Descargar Contrato"
                        : "Descargar Cotización"}
                </span>
              </button>

              {/* Copiar enlace */}
              <button
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1 rounded-lg bg-surface-container-high border border-outline-variant px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container-highest transition shadow-sm cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <CheckIcon className="h-4 w-4 text-emerald-400" />
                    <span className="text-emerald-400">¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <span>Copiar Link</span>
                  </>
                )}
              </button>

              {/* WhatsApp Cliente */}
              {clientWhatsAppUrl && (
                <a
                  href={clientWhatsAppUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-sm"
                >
                  <span>WhatsApp</span>
                </a>
              )}

              {/* Compartir */}
              <button
                onClick={handleSharePdf}
                disabled={isGeneratingPdf}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50 transition shadow-sm cursor-pointer"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>Compartir</span>
              </button>

              {/* Imprimir */}
              <button
                onClick={() => window.print()}
                className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-surface-container-high border border-outline-variant px-2.5 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container-highest transition shadow-sm cursor-pointer"
              >
                <PrinterIcon className="h-3.5 w-3.5" />
                <span>Imprimir</span>
              </button>
            </div>
          </div>
        </div>

        {/* PANEL INTERACTIVO DE GESTIÓN DE ESTATUS Y ANTICIPO (DESPLEGABLE) */}
        {showStatusManager && (
          <form
            onSubmit={handleSaveStatusAndDeposit}
            className="border-b border-outline-variant bg-surface-container-low p-4 sm:p-5 space-y-4 print:hidden animate-in fade-in duration-200"
          >
            <div className="flex items-center justify-between border-b border-outline-variant pb-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-primary flex items-center gap-2">
                <span>⚙️</span> Control de Estatus, Aprobación y Anticipo
              </h3>
              <span className="text-[11px] text-on-surface-variant font-mono">
                Folio: {data.code}
              </span>
            </div>

            {statusFeedback && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold ${
                  statusFeedback.type === "success"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-red-500/20 text-red-300 border border-red-500/40"
                }`}
              >
                {statusFeedback.text}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Selector de Estatus */}
              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  Estatus de la Cotización *
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as QuoteStatus)}
                  className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-xs font-semibold text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="PENDING">🟡 Pendiente (Sin respuesta)</option>
                  <option value="APPROVED">🔵 Aprobada (Cliente aceptó)</option>
                  <option value="CONFIRMED">🟢 Confirmada con Anticipo (Apartada)</option>
                  <option value="REJECTED">🔴 No Aprobada / Rechazada</option>
                  <option value="CANCELLED">⚫ Cancelada</option>
                </select>
              </div>

              {/* Monto de Anticipo */}
              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  Monto Recibido (MXN)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-on-surface-variant font-bold">$</span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={depositInput}
                    onChange={(e) => setDepositInput(Number(e.target.value) || 0)}
                    className="w-full rounded-lg border border-outline-variant bg-surface pl-7 pr-3 py-2 text-xs font-mono font-bold text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex gap-1 mt-1">
                  <button
                    type="button"
                    onClick={() => setDepositInput(Math.round(data.saleAmount * 0.5))}
                    className="text-[10px] text-primary hover:underline font-semibold"
                  >
                    50% (${Math.round(data.saleAmount * 0.5).toLocaleString("es-MX")})
                  </button>
                  <span className="text-[10px] text-on-surface-variant">·</span>
                  <button
                    type="button"
                    onClick={() => setDepositInput(data.saleAmount)}
                    className="text-[10px] text-primary hover:underline font-semibold"
                  >
                    Total (${data.saleAmount.toLocaleString("es-MX")})
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-on-surface-variant">
                  Puedes registrar el importe real recibido, aunque supere el anticipo sugerido.
                </p>
              </div>

              {/* Cuándo pusieron el anticipo */}
              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  Fecha de Pago del Anticipo
                </label>
                <input
                  type="date"
                  value={depositDateInput}
                  onChange={(e) => setDepositDateInput(e.target.value)}
                  className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-xs font-semibold text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Forma de Pago */}
              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  Método de Pago
                </label>
                <select
                  value={depositMethodInput}
                  onChange={(e) => setDepositMethodInput(e.target.value)}
                  className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-xs font-semibold text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Efectivo en Sucursal">Efectivo en Sucursal</option>
                  <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                  <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                  <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                  <option value="Depósito en OXXO / Banco">Depósito en OXXO / Banco</option>
                  <option value="Otro">Otro medio</option>
                </select>
              </div>
            </div>

            {/* Notas opcionales del anticipo o contrato */}
            <div>
              <label className="block text-[11px] font-bold text-on-surface mb-1">
                Notas del Contrato / Recibo (opcional)
              </label>
              <input
                type="text"
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder="Ej. Anticipo entregado en matriz por la mamá de la novia, resto a pagar en efectivo."
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowStatusManager(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingStatus}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {savingStatus ? (
                  <span>Guardando...</span>
                ) : (
                  <>
                    <CheckIcon className="h-4 w-4" />
                    <span>Guardar Estatus y Generar Recibo / Contrato</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ÁREA DE VISUALIZACIÓN / IMPRESIÓN DEL DOCUMENTO */}
        <div
          ref={printAreaRef}
          className="quote-print-document overflow-y-auto p-6 sm:p-10 space-y-6 text-sm print:p-8 print:text-black print:overflow-visible print:bg-white"
        >
          {/* ========================================================= */}
          {/* VISTA 1: RECIBO OFICIAL DE ANTICIPO */}
          {/* ========================================================= */}
          {activeDocType === "RECEIPT" ? (
            <div className="space-y-6">
              {/* ENCABEZADO RECIBO */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b pb-6 border-outline-variant print:border-gray-300">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black tracking-tight text-primary print:text-black">
                      TEQUILITROS®
                    </span>
                    <span className="text-xs uppercase tracking-widest font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 print:bg-gray-100 print:text-black">
                      Recibo Oficial de Anticipo
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-on-surface-variant print:text-gray-600">
                    Destiladora del Norte · Coctelería Premium de Tequila
                  </p>
                  <p className="text-xs text-on-surface-variant print:text-gray-600">
                    Atención y Validación WhatsApp: {OFFICIAL_WHATSAPP_DISPLAY}
                  </p>
                </div>

                <div className="text-left sm:text-right space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-400 print:text-black">
                    COMPROBANTE DE PAGO
                  </p>
                  <p className="font-mono text-base font-black text-on-surface print:text-black">
                    FOLIO: {receiptFolio}
                  </p>
                  <p className="text-xs text-on-surface-variant print:text-gray-600">
                    Contrato Ref: <strong className="font-mono">{displayFolio}</strong>
                  </p>
                  <p className="text-xs text-on-surface-variant print:text-gray-600">
                    Emisión: {formattedIssueDate}
                  </p>
                </div>
              </div>

              {/* FICHA TÉCNICA CLIENTE Y EVENTO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-outline-variant p-4 bg-surface-container-low print:bg-gray-50 print:border-gray-300">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant print:text-gray-600">
                    Cliente / Titular
                  </p>
                  <p className="font-bold text-base text-on-surface print:text-black mt-1">
                    {data.clientName}
                  </p>
                  {data.clientPhone && (
                    <p className="text-xs text-on-surface-variant print:text-gray-700">
                      Tel: {data.clientPhone}
                    </p>
                  )}
                  {data.clientEmail && (
                    <p className="text-xs text-on-surface-variant print:text-gray-700">
                      Correo: {data.clientEmail}
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant print:text-gray-600">
                    Evento Reservado
                  </p>
                  <p className="text-sm font-bold text-on-surface print:text-black mt-1">
                    📅 {formattedDate}
                  </p>
                  <p className="text-xs text-on-surface-variant print:text-gray-700">
                    📍 {data.location} ({currentMetadata.viaticosZone})
                  </p>
                  <p className="text-xs text-on-surface-variant print:text-gray-700">
                    👥 {data.guestCount} personas · {currentMetadata.durationHours} horas de barra
                  </p>
                </div>
              </div>

              {/* RECUADRO CENTRAL DESTACADO DEL ANTICIPO */}
              <div className="rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/10 p-6 print:border-gray-400 print:bg-gray-50 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 print:text-black block">
                  Monto Total del Anticipo Recibido
                </span>
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                  <span className="font-mono text-3xl sm:text-4xl font-black text-emerald-400 print:text-black">
                    ${depositPaid.toLocaleString("es-MX")}{" "}
                    <span className="text-sm font-normal text-on-surface-variant print:text-gray-600">MXN</span>
                  </span>
                  <span className="text-xs font-bold text-on-surface print:text-black bg-surface-container px-3 py-1.5 rounded-lg border border-outline-variant">
                    Método: {currentMetadata.depositMethod || "Efectivo en Sucursal"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-emerald-500/20 text-xs text-on-surface-variant print:text-gray-700">
                  <p>
                    Fecha en que se cubrió:{" "}
                    <strong className="text-on-surface print:text-black">
                      {currentMetadata.depositPaidAt
                        ? new Date(currentMetadata.depositPaidAt).toLocaleDateString("es-MX", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })
                        : formattedIssueDate}
                    </strong>
                  </p>
                  <p>
                    Recibido por:{" "}
                    <strong className="text-on-surface print:text-black">
                      {currentMetadata.depositReceivedByName || currentMetadata.creatorName}
                    </strong>{" "}
                    ({currentMetadata.depositBranchName || currentMetadata.branchName || "Sucursal"})
                  </p>
                </div>
              </div>

              {/* ESTADO DE CUENTA Y SALDO RESTANTE */}
              <div className="rounded-xl border border-outline-variant bg-surface-container-high p-4 space-y-2 print:border-gray-300 print:bg-gray-50 text-xs sm:text-sm">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant print:text-gray-600">Inversión Total Contratada del Servicio:</span>
                  <span className="font-mono font-bold text-on-surface print:text-black">
                    ${data.saleAmount.toLocaleString("es-MX")} MXN
                  </span>
                </div>
                <div className="flex justify-between border-t border-outline-variant pt-2 text-emerald-400 print:text-black">
                  <span className="font-bold">(-) Anticipo Recibido en este Acto:</span>
                  <span className="font-mono font-bold">
                    -${depositPaid.toLocaleString("es-MX")} MXN
                  </span>
                </div>
                <div className="flex justify-between border-t border-outline-variant pt-2 text-primary print:text-black font-bold">
                  <span>Saldo Pendiente a Liquidar el Día del Evento:</span>
                  <span className="font-mono text-base">
                    {isConsumo ? "Consumo de producto en evento" : `$${balanceRemaining.toLocaleString("es-MX")} MXN`}
                  </span>
                </div>
              </div>

              {/* CLÁUSULAS DEL RECIBO */}
              <div className="rounded-xl border border-outline-variant p-4 bg-surface-container-low text-[11px] space-y-1.5 text-on-surface-variant print:text-gray-700">
                <p className="font-bold text-on-surface print:text-black uppercase tracking-wider text-xs">
                  Términos del Apartado de Fecha
                </p>
                <p>1. Este recibo constituye el comprobante formal de reserva y apartado exclusivo de fecha en el calendario oficial de Tequilitros.</p>
                <p>2. El anticipo es estrictamente NO REEMBOLSABLE por concepto de bloqueo exclusivo de agenda y preparación logística.</p>
                <p>3. El saldo restante deberá liquidarse previo al inicio del servicio el día del evento pactado.</p>
              </div>

              {/* FIRMAS RECIBO */}
              <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs print:pt-10">
                <div className="space-y-1">
                  <div className="mx-auto w-44 border-b border-outline-variant print:border-black mb-2" />
                  <p className="font-bold text-on-surface print:text-black">TEQUILITROS® EVENTOS</p>
                  <p className="text-[11px] text-on-surface-variant print:text-gray-600">Recibió (Firma y Sello)</p>
                </div>

                <div className="space-y-1">
                  <div className="mx-auto w-44 border-b border-outline-variant print:border-black mb-2" />
                  <p className="font-bold text-on-surface print:text-black">{data.clientName}</p>
                  <p className="text-[11px] text-on-surface-variant print:text-gray-600">Firma de Conformidad del Cliente</p>
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================= */
            /* VISTA 2 Y 3: COTIZACIÓN FORMAL O CONTRATO LEGAL */
            /* ========================================================= */
            <div className="space-y-6">
              {/* ENCABEZADO */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b pb-6 border-outline-variant print:border-gray-300">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black tracking-tight text-primary print:text-black">
                      TEQUILITROS®
                    </span>
                    <span className="text-xs uppercase tracking-widest font-semibold px-2 py-0.5 rounded bg-surface-container-highest text-on-surface print:bg-gray-100 print:text-black">
                      Barras Móviles & Eventos
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-on-surface-variant print:text-gray-600">
                    Destiladora del Norte · Coctelería Premium de Tequila
                  </p>
                  <p className="text-xs text-on-surface-variant print:text-gray-600">
                    Atención y Reservas WhatsApp: {OFFICIAL_WHATSAPP_DISPLAY}
                  </p>
                </div>

                <div className="text-left sm:text-right space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary print:text-black">
                    {activeDocType === "CONTRACT" ? "CONTRATO OFICIAL DE SERVICIO" : "PRESUPUESTO FORMAL"}
                  </p>
                  <p className="font-mono text-base font-bold text-on-surface print:text-black">
                    FOLIO: {activeDocType === "CONTRACT" ? currentMetadata.contractFolio || data.code : data.code}
                  </p>
                  <p className="text-xs text-on-surface-variant print:text-gray-600">
                    Fecha de Emisión: {formattedIssueDate}
                  </p>
                  <p className="text-xs text-on-surface-variant print:text-gray-600">
                    Atendido por: <strong className="text-on-surface print:text-black">{currentMetadata.creatorName}</strong> ({currentMetadata.branchName || "Sucursal"})
                  </p>
                </div>
              </div>

              {/* BANNER DE ENLACE WEB PARA EL CLIENTE (Oculto al imprimir) */}
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs print:hidden">
                <div className="flex items-start sm:items-center gap-2.5">
                  <span className="text-xl">🌐</span>
                  <div>
                    <strong className="text-on-surface text-xs block">Enlace de consulta digital para el cliente:</strong>
                    <p className="text-on-surface-variant text-[11px] font-mono break-all mt-0.5">
                      {publicQuoteUrl}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary hover:opacity-90 transition cursor-pointer"
                  >
                    {copiedLink ? <CheckIcon className="h-3.5 w-3.5" /> : null}
                    <span>{copiedLink ? "¡Copiado!" : "Copiar Enlace"}</span>
                  </button>
                  <a
                    href={publicQuoteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-outline-variant bg-surface-container px-2.5 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container-high transition"
                  >
                    <span>Abrir ↗</span>
                  </a>
                </div>
              </div>

              {/* FICHA TÉCNICA DEL EVENTO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-outline-variant p-4 bg-surface-container-low print:bg-gray-50 print:border-gray-300">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant print:text-gray-600">
                    Datos del Cliente
                  </p>
                  <p className="font-semibold text-base text-on-surface print:text-black mt-1">
                    {data.clientName}
                  </p>
                  {data.clientPhone && (
                    <p className="text-xs text-on-surface-variant print:text-gray-700">
                      Tel: {data.clientPhone}
                    </p>
                  )}
                  {currentMetadata.clientEmail && (
                    <p className="text-xs text-on-surface-variant print:text-gray-700">
                      Email: {currentMetadata.clientEmail}
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant print:text-gray-600">
                    Detalles del Evento
                  </p>
                  <p className="text-sm font-semibold text-on-surface print:text-black mt-1">
                    📅 {formattedDate}
                  </p>
                  <p className="text-xs text-on-surface-variant print:text-gray-700">
                    📍 {data.location} ({currentMetadata.viaticosZone})
                  </p>
                  <p className="text-xs text-on-surface-variant print:text-gray-700">
                    👥 {data.guestCount} personas · {currentMetadata.durationHours} horas de atención
                  </p>
                  <p className="text-xs text-on-surface-variant print:text-gray-700">
                    🍸 Tipo: {currentMetadata.eventType} ({isConsumo ? "A Consumo" : "Barra Libre"})
                  </p>
                </div>
              </div>

              {/* BEBIDAS SELECCIONADAS */}
              {currentMetadata.selectedDrinks && currentMetadata.selectedDrinks.length > 0 && (
                <div className="rounded-xl border border-outline-variant p-4 bg-surface-container-lowest print:border-gray-300 print:bg-white">
                  <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant print:text-gray-600 mb-2">
                    Preparaciones y Cócteles Incluidos en la Barra (Vaso 32 oz)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {currentMetadata.selectedDrinks.map((drink, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-surface-container border border-outline-variant text-on-surface font-medium print:border-gray-300 print:bg-gray-100 print:text-black"
                      >
                        <CheckIcon className="h-3 w-3 text-emerald-500 print:text-black" />
                        {drink}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* TABLA DE CONCEPTOS ECONÓMICOS */}
              <div className="rounded-xl border border-outline-variant overflow-hidden print:border-gray-300">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-surface-container-high border-b border-outline-variant print:bg-gray-100 print:border-gray-300 text-on-surface-variant print:text-black">
                    <tr>
                      <th className="py-2.5 px-4 font-bold">Concepto</th>
                      <th className="py-2.5 px-4 font-bold text-center">Cantidad</th>
                      <th className="py-2.5 px-4 font-bold text-right">Precio Unitario</th>
                      <th className="py-2.5 px-4 font-bold text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant print:divide-gray-200">
                    {isConsumo ? (
                      <>
                        <tr>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-on-surface print:text-black">
                              Atención y Operación de Barra Móvil ({currentMetadata.durationHours} hrs)
                            </p>
                            <p className="text-xs text-on-surface-variant print:text-gray-600">
                              Servicio con bartenders profesionales, montaje de barra y coctelería continua.
                            </p>
                          </td>
                          <td className="py-3 px-4 text-center font-mono">{currentMetadata.durationHours} hrs</td>
                          <td className="py-3 px-4 text-right font-mono">$250 MXN/hr</td>
                          <td className="py-3 px-4 text-right font-mono font-semibold">
                            ${(currentMetadata.durationHours * 250).toLocaleString("es-MX")} MXN
                          </td>
                        </tr>

                        <tr>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-on-surface print:text-black">
                              Viáticos y Traslado de Equipo
                            </p>
                            <p className="text-xs text-on-surface-variant print:text-gray-600">
                              Ruta: {currentMetadata.viaticosZone}
                            </p>
                          </td>
                          <td className="py-3 px-4 text-center font-mono">1 servicio</td>
                          <td className="py-3 px-4 text-right font-mono">
                            ${currentMetadata.viaticosCost.toLocaleString("es-MX")} MXN
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold">
                            ${currentMetadata.viaticosCost.toLocaleString("es-MX")} MXN
                          </td>
                        </tr>

                        <tr>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-on-surface print:text-black">
                              Consumo de Producto en Evento
                            </p>
                            <p className="text-xs text-on-surface-variant print:text-gray-600">
                              Tequila, refrescos e insumos consumidos. Se liquida al concluir en sitio.
                            </p>
                          </td>
                          <td className="py-3 px-4 text-center font-mono italic">A consumo</td>
                          <td className="py-3 px-4 text-right font-mono text-xs">Según carta oficial</td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-primary print:text-black">
                            Variable en evento
                          </td>
                        </tr>
                      </>
                    ) : (
                      <>
                        <tr>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-on-surface print:text-black">
                              Servicio de Barra Libre Tequilitros ({currentMetadata.durationHours} hrs)
                            </p>
                            <p className="text-xs text-on-surface-variant print:text-gray-600">
                              Incluye bartenders, tequila artesanal, coctelería ilimitada en vaso de 32 oz y hielo.
                            </p>
                          </td>
                          <td className="py-3 px-4 text-center font-mono">{data.guestCount} pers.</td>
                          <td className="py-3 px-4 text-right font-mono">${currentMetadata.pricePerGuest} MXN</td>
                          <td className="py-3 px-4 text-right font-mono font-semibold">
                            ${(data.guestCount * currentMetadata.pricePerGuest).toLocaleString("es-MX")} MXN
                          </td>
                        </tr>

                        {currentMetadata.extraHours > 0 && (
                          <tr>
                            <td className="py-3 px-4">
                              <p className="font-semibold text-on-surface print:text-black">
                                Horas Extra de Servicio ({currentMetadata.extraHours} hr{currentMetadata.extraHours > 1 ? "s" : ""})
                              </p>
                            </td>
                            <td className="py-3 px-4 text-center font-mono">{currentMetadata.extraHours} hrs</td>
                            <td className="py-3 px-4 text-right font-mono">${data.guestCount * 20} MXN</td>
                            <td className="py-3 px-4 text-right font-mono font-semibold">
                              ${currentMetadata.extraHoursCost.toLocaleString("es-MX")} MXN
                            </td>
                          </tr>
                        )}

                        <tr>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-on-surface print:text-black">
                              Viáticos y Traslado de Equipo
                            </p>
                            <p className="text-xs text-on-surface-variant print:text-gray-600">
                              Ruta: {currentMetadata.viaticosZone}
                            </p>
                          </td>
                          <td className="py-3 px-4 text-center font-mono">1 servicio</td>
                          <td className="py-3 px-4 text-right font-mono">
                            ${currentMetadata.viaticosCost.toLocaleString("es-MX")} MXN
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold">
                            ${currentMetadata.viaticosCost.toLocaleString("es-MX")} MXN
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              {/* TOTALES Y COMPROBANTE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                {isConfirmed ? (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 print:border-gray-400 print:bg-gray-50">
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-400 print:text-black flex items-center gap-1.5">
                      <CheckIcon className="h-4 w-4 text-emerald-500 print:text-black" />
                      Comprobante de Anticipo Registrado
                    </p>
                    <div className="mt-2 space-y-1 text-xs">
                      <p>
                        <strong className="text-on-surface print:text-black">Monto Cubierto:</strong>{" "}
                        <span className="font-mono text-sm font-bold text-emerald-400 print:text-black">
                          ${depositPaid.toLocaleString("es-MX")} MXN
                        </span>
                      </p>
                      <p>
                        <strong className="text-on-surface print:text-black">Forma de Pago:</strong>{" "}
                        {currentMetadata.depositMethod || "Efectivo en Sucursal"}
                      </p>
                      <p>
                        <strong className="text-on-surface print:text-black">Recibido por:</strong>{" "}
                        {currentMetadata.depositReceivedByName || currentMetadata.creatorName} ({currentMetadata.depositBranchName || "Sucursal"})
                      </p>
                      {currentMetadata.depositPaidAt && (
                        <p className="text-on-surface-variant print:text-gray-600">
                          Fecha de pago: {new Date(currentMetadata.depositPaidAt).toLocaleDateString("es-MX")}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-on-surface-variant print:border-gray-300 print:bg-gray-50 print:text-black">
                    <p className="font-bold text-amber-400 print:text-black uppercase tracking-wider">
                      ⚠️ Instrucciones para Congelar Fecha
                    </p>
                    <p className="mt-1.5 leading-relaxed">
                      Para apartar la fecha se requiere el <strong>50% de anticipo (${depositRequired.toLocaleString("es-MX")} MXN)</strong>. El apartado formal se valida directamente en sucursal o con el WhatsApp oficial ({OFFICIAL_WHATSAPP_DISPLAY}).
                    </p>
                  </div>
                )}

                {/* Cuadro de totales */}
                <div className="rounded-xl border border-outline-variant bg-surface-container-high p-4 space-y-2 print:border-gray-300 print:bg-gray-50">
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant print:text-gray-600">
                      {isConsumo ? "Total Servicio Fijo:" : "Total del Servicio:"}
                    </span>
                    <span className="font-mono font-bold text-base text-on-surface print:text-black">
                      ${data.saleAmount.toLocaleString("es-MX")} MXN
                    </span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-outline-variant pt-2 print:border-gray-300">
                    <span className="text-on-surface-variant print:text-gray-600">
                      {isConfirmed ? "Anticipo Cubierto:" : "Anticipo para Apartar (50%):"}
                    </span>
                    <span className="font-mono font-bold text-emerald-400 print:text-black">
                      ${(isConfirmed ? depositPaid : depositRequired).toLocaleString("es-MX")} MXN
                    </span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-outline-variant pt-2 print:border-gray-300">
                    <span className="text-on-surface-variant print:text-gray-600">
                      {creditBalance > 0 ? "Saldo a Favor del Cliente:" : "Saldo a Liquidar en Evento:"}
                    </span>
                    <span className={`font-mono font-bold print:text-black ${creditBalance > 0 ? "text-emerald-400" : "text-primary"}`}>
                      {isConsumo ? "A liquidar en evento" : creditBalance > 0 ? `$${creditBalance.toLocaleString("es-MX")} MXN` : `$${balanceRemaining.toLocaleString("es-MX")} MXN`}
                    </span>
                  </div>
                </div>
              </div>

              {/* LISTA DE PRECIOS SI ES CONSUMO */}
              {isConsumo && (
                <div className="rounded-xl border border-outline-variant p-4 bg-surface-container-low print:border-gray-300 print:bg-white space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary print:text-black">
                    Lista Oficial de Precios por Producto (Barra a Consumo - Pág. 4)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                    {CONSUMO_PRICES_CATALOG.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-1 border-b border-outline-variant/30">
                        <span className="text-on-surface font-medium">{item.item}</span>
                        <span className="font-mono font-semibold">${item.price} MXN /{item.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* NOTAS ESPECIALES */}
              {currentMetadata.specialNotes && (
                <div className="rounded-xl border border-outline-variant p-3 bg-surface-container text-xs">
                  <strong className="text-on-surface">Notas / Acuerdos Especiales:</strong>{" "}
                  <span className="text-on-surface-variant">{currentMetadata.specialNotes}</span>
                </div>
              )}

              {/* CLÁUSULAS CONTRACTUALES SI ES CONTRATO */}
              {activeDocType === "CONTRACT" && (
                <div className="rounded-xl border border-outline-variant p-4 bg-surface-container-low text-[11px] space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-on-surface border-b border-outline-variant pb-1.5">
                    Términos, Condiciones y Políticas de Contratación
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 leading-relaxed text-on-surface-variant">
                    {OFFICIAL_CONTRACT_CLAUSES.map((clause, idx) => (
                      <div key={idx} className="space-y-0.5">
                        <p className="font-bold text-on-surface">{clause.title}</p>
                        <p>{clause.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECCIÓN DE FIRMAS */}
              <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs print:pt-10">
                <div className="space-y-1">
                  <div className="mx-auto w-44 border-b border-outline-variant print:border-black mb-2" />
                  <p className="font-bold text-on-surface print:text-black">TEQUILITROS® EVENTOS</p>
                  <p className="text-[11px] text-on-surface-variant print:text-gray-600">
                    Prestador del Servicio · {currentMetadata.creatorName}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="mx-auto w-44 border-b border-outline-variant print:border-black mb-2" />
                  <p className="font-bold text-on-surface print:text-black">{data.clientName}</p>
                  <p className="text-[11px] text-on-surface-variant print:text-gray-600">
                    Firma de Conformidad del Cliente
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
