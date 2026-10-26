"use client";

import { useRef, useState } from "react";
import {
  OFFICIAL_WHATSAPP_PHONE,
  OFFICIAL_WHATSAPP_DISPLAY,
  OFFICIAL_CONTRACT_CLAUSES,
  CONSUMO_PRICES_CATALOG,
  type TequilitrosQuoteMetadata,
} from "@/lib/tequilitros/quote-types";
import { generateTequilitrosPdfBlob } from "@/lib/tequilitros/pdf-generator";
import { PrinterIcon, XIcon, CheckIcon, ArrowDownIcon } from "@/components/ui/icons";

interface QuoteDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: "QUOTE" | "CONTRACT";
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
}

export default function QuoteDocumentModal({
  isOpen,
  onClose,
  documentType,
  data,
}: QuoteDocumentModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const { metadata } = data;
  const isContract = documentType === "CONTRACT" || metadata.isContractConfirmed;

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

  const isConsumo = metadata.modality === "consumo";
  const atencionTotal = metadata.durationHours * 250;
  const fijoTotal = isConsumo ? atencionTotal + metadata.viaticosCost : data.saleAmount;

  const depositRequired = isConsumo ? fijoTotal : (metadata.depositRequired || Math.round(data.saleAmount * 0.5));
  const balanceRemaining = isConsumo ? 0 : data.saleAmount - (metadata.depositPaid ?? depositRequired);

  // Mensaje para WhatsApp cliente
  const whatsappClientText = isContract
    ? isConsumo
      ? `📋 *CONTRATO Y RECIBO OFICIAL (BARRA A CONSUMO) - TEQUILITROS*\n` +
        `Folio: ${metadata.contractFolio || data.code}\n` +
        `Cliente: ${data.clientName}\n` +
        `Fecha confirmada: ${formattedDate}\n` +
        `Duración de atención: ${metadata.durationHours} horas ($${atencionTotal.toLocaleString("es-MX")} MXN)\n` +
        `Viáticos de traslado: $${metadata.viaticosCost.toLocaleString("es-MX")} MXN\n` +
        `✅ *Monto cubierto para congelar fecha:* $${fijoTotal.toLocaleString("es-MX")} MXN\n` +
        `🍸 *Consumo de producto:* Se contabiliza y liquida el día del evento conforme a la lista oficial de precios.\n\n` +
        `¡Tu fecha está oficialmente congelada y apartada en agenda!`
      : `📋 *CONTRATO Y RECIBO OFICIAL DE EVENTO - TEQUILITROS*\n` +
        `Folio: ${metadata.contractFolio || data.code}\n` +
        `Cliente: ${data.clientName}\n` +
        `Fecha confirmada: ${formattedDate}\n` +
        `Invitados: ${data.guestCount} personas\n` +
        `Total del servicio: $${data.saleAmount.toLocaleString("es-MX")} MXN\n` +
        `✅ *Anticipo recibido (50%):* $${(metadata.depositPaid ?? depositRequired).toLocaleString("es-MX")} MXN\n` +
        `Saldo pendiente a liquidar el día del evento: $${balanceRemaining.toLocaleString("es-MX")} MXN\n\n` +
        `¡Tu fecha está oficialmente congelada y apartada en agenda!`
    : isConsumo
      ? `🍸 *COTIZACIÓN DE BARRA MÓVIL (A CONSUMO) - TEQUILITROS EVENTOS*\n` +
        `Folio: ${data.code}\n` +
        `Cliente: ${data.clientName}\n` +
        `Fecha: ${formattedDate}\n` +
        `Lugar: ${data.location}\n` +
        `Invitados estimados: ${data.guestCount} personas\n` +
        `Modalidad: Barra a Consumo ($250 MXN / hr + viáticos)\n` +
        `- Horas de atención: ${metadata.durationHours} horas ($${atencionTotal.toLocaleString("es-MX")} MXN)\n` +
        `- Viáticos de traslado: $${metadata.viaticosCost.toLocaleString("es-MX")} MXN\n` +
        `*Total fijo para apartar y congelar fecha:* $${fijoTotal.toLocaleString("es-MX")} MXN\n\n` +
        `📌 *Sobre el consumo de producto:* No se cobra por adelantado; se liquida al concluir el evento conforme a la lista oficial de precios (Tequila 1L $350, Licores $150, Sangría $90, Peñafiel $30, etc.).\n\n` +
        `📲 Para apartar tu fecha, comunícate al WhatsApp oficial: ${OFFICIAL_WHATSAPP_DISPLAY}`
      : `🍸 *COTIZACIÓN DE BARRA MÓVIL - TEQUILITROS EVENTOS*\n` +
        `Folio: ${data.code}\n` +
        `Cliente: ${data.clientName}\n` +
        `Fecha: ${formattedDate}\n` +
        `Lugar: ${data.location}\n` +
        `Invitados: ${data.guestCount} personas (aforo total)\n` +
        `Modalidad: Barra Libre (4 hrs base)\n` +
        `Bebidas: ${metadata.selectedDrinks?.join(", ") || "Cantaritos, Vampiros, Palomas"}\n\n` +
        `*Inversión Total:* $${data.saleAmount.toLocaleString("es-MX")} MXN\n` +
        `*Anticipo para apartar (50%):* $${depositRequired.toLocaleString("es-MX")} MXN\n` +
        `*Saldo el día del evento:* $${balanceRemaining.toLocaleString("es-MX")} MXN\n\n` +
        `📲 Para apartar tu fecha, comunícate al WhatsApp oficial: ${OFFICIAL_WHATSAPP_DISPLAY}`;

  const clientWhatsAppUrl = data.clientPhone
    ? `https://wa.me/${data.clientPhone.replace(/\D/g, "")}?text=${encodeURIComponent(whatsappClientText)}`
    : null;

  const centralWhatsAppUrl = `https://wa.me/${OFFICIAL_WHATSAPP_PHONE}?text=${encodeURIComponent(
    `Hola, envío cotización para validar y apartar fecha:\n` + whatsappClientText
  )}`;

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      const blob = await generateTequilitrosPdfBlob({
        ...data,
        documentType,
      });
      const fileName = `${isContract ? "Contrato" : "Cotizacion"}-${metadata.contractFolio || data.code}.pdf`;
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
        ...data,
        documentType,
      });
      const fileName = `${isContract ? "Contrato" : "Cotizacion"}-${metadata.contractFolio || data.code}.pdf`;
      const file = new File([blob], fileName, { type: "application/pdf" });

      if (typeof navigator !== "undefined" && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${isContract ? "Contrato" : "Cotización"} Tequilitros ${data.code}`,
          text: `Cotización oficial de Barra Móvil Tequilitros para ${data.clientName}`,
        });
      } else if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: `${isContract ? "Contrato" : "Cotización"} Tequilitros ${data.code}`,
          text: whatsappClientText,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Error al compartir:", err);
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-3 sm:p-6 backdrop-blur-sm print:p-0 print:bg-white print:static print:overflow-visible print:block">
      {/* Contenedor Modal */}
      <div className="relative flex max-h-[95vh] w-full max-w-4xl flex-col rounded-2xl border border-outline-variant bg-surface text-on-surface shadow-2xl print:max-h-none print:border-none print:shadow-none print:w-full print:max-w-none print:bg-white print:text-black print:static print:block">
        {/* Barra superior de acciones (oculta al imprimir) */}
        <div className="flex items-center justify-between border-b border-outline-variant px-5 py-3.5 print:hidden bg-surface-container">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                isContract
                  ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                  : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
              }`}
            >
              {isContract ? "CONTRATO Y RECIBO OFICIAL" : "COTIZACIÓN FORMAL"}
            </span>
            <span className="font-mono text-xs text-on-surface-variant font-semibold">
              {isContract ? metadata.contractFolio || data.code : data.code}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Descargar PDF */}
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary hover:opacity-90 disabled:opacity-50 transition shadow-sm cursor-pointer"
              title="Descargar archivo PDF directamente a tu dispositivo"
            >
              <ArrowDownIcon className="h-4 w-4" />
              <span>{isGeneratingPdf ? "Generando..." : "Descargar PDF"}</span>
            </button>

            {/* Compartir / AirDrop */}
            <button
              onClick={handleSharePdf}
              disabled={isGeneratingPdf}
              className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50 transition shadow-sm cursor-pointer"
              title="Compartir vía AirDrop, WhatsApp, Correo o Guardar en Archivos"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>Compartir / AirDrop</span>
            </button>

            {/* WhatsApp Cliente */}
            {clientWhatsAppUrl && (
              <a
                href={clientWhatsAppUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-sm"
                title="Mandar por WhatsApp al cliente"
              >
                <span>WhatsApp</span>
              </a>
            )}

            {/* Validar WhatsApp Central */}
            <a
              href={centralWhatsAppUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden md:inline-flex items-center gap-1 rounded-lg bg-[#E28735] px-2.5 py-1.5 text-xs font-bold text-black hover:opacity-90 transition shadow-sm"
              title="Validar con Tequilitros Central"
            >
              <span>Central</span>
            </a>

            {/* Imprimir */}
            <button
              onClick={handlePrint}
              className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-surface-container-high border border-outline-variant px-2.5 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container-highest transition shadow-sm"
              title="Imprimir"
            >
              <PrinterIcon className="h-3.5 w-3.5" />
              <span>Imprimir</span>
            </button>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ÁREA IMPRIMIBLE DEL DOCUMENTO */}
        <div
          ref={printAreaRef}
          className="quote-print-document overflow-y-auto p-6 sm:p-10 space-y-6 text-sm print:p-8 print:text-black print:overflow-visible print:bg-white"
        >
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
                {isContract ? "CONTRATO Y RECIBO DE PAGO" : "PRESUPUESTO FORMAL"}
              </p>
              <p className="font-mono text-base font-bold text-on-surface print:text-black">
                FOLIO: {isContract ? metadata.contractFolio || data.code : data.code}
              </p>
              <p className="text-xs text-on-surface-variant print:text-gray-600">
                Fecha de Emisión: {formattedIssueDate}
              </p>
              <p className="text-xs text-on-surface-variant print:text-gray-600">
                Atendido por: <strong className="text-on-surface print:text-black">{metadata.creatorName}</strong> ({metadata.branchName || "Sucursal"})
              </p>
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
              {metadata.clientEmail && (
                <p className="text-xs text-on-surface-variant print:text-gray-700">
                  Email: {metadata.clientEmail}
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
                📍 {data.location} ({metadata.viaticosZone})
              </p>
              <p className="text-xs text-on-surface-variant print:text-gray-700">
                👥 {data.guestCount} personas · {metadata.durationHours} horas de atención
              </p>
              <p className="text-xs text-on-surface-variant print:text-gray-700">
                🍸 Tipo: {metadata.eventType} ({metadata.modality === "libre" ? "Barra Libre" : "A Consumo"})
              </p>
            </div>
          </div>

          {/* BEBIDAS SELECCIONADAS */}
          {metadata.selectedDrinks && metadata.selectedDrinks.length > 0 && (
            <div className="rounded-xl border border-outline-variant p-4 bg-surface-container-lowest print:border-gray-300 print:bg-white">
              <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant print:text-gray-600 mb-2">
                Preparaciones y Cócteles Incluidos en la Barra
              </p>
              <div className="flex flex-wrap gap-2">
                {metadata.selectedDrinks.map((drink, i) => (
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
                          Atención y Operación de Barra Móvil ({metadata.durationHours} hrs)
                        </p>
                        <p className="text-xs text-on-surface-variant print:text-gray-600">
                          Servicio con bartenders profesionales, montaje de barra y coctelería continua ($250 MXN/hr).
                        </p>
                      </td>
                      <td className="py-3 px-4 text-center font-mono">{metadata.durationHours} hrs</td>
                      <td className="py-3 px-4 text-right font-mono">$250 MXN/hr</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold">
                        ${(metadata.durationHours * 250).toLocaleString("es-MX")} MXN
                      </td>
                    </tr>

                    <tr>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-on-surface print:text-black">
                          Viáticos y Traslado de Equipo
                        </p>
                        <p className="text-xs text-on-surface-variant print:text-gray-600">
                          Ruta: {metadata.viaticosZone}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-center font-mono">1 servicio</td>
                      <td className="py-3 px-4 text-right font-mono">
                        ${metadata.viaticosCost.toLocaleString("es-MX")} MXN
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold">
                        ${metadata.viaticosCost.toLocaleString("es-MX")} MXN
                      </td>
                    </tr>

                    <tr>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-on-surface print:text-black">
                          Consumo de Producto en Evento
                        </p>
                        <p className="text-xs text-on-surface-variant print:text-gray-600">
                          Tequila, licores, refrescos e insumos consumidos. No se cobra por adelantado; se liquida al concluir el evento.
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
                          Servicio de Barra Móvil Tequilitros ({metadata.durationHours} hrs)
                        </p>
                        <p className="text-xs text-on-surface-variant print:text-gray-600">
                          Incluye bartenders, barra de atención, insumos completos, hielo y cristalería/vasos.
                        </p>
                      </td>
                      <td className="py-3 px-4 text-center font-mono">{data.guestCount} pers.</td>
                      <td className="py-3 px-4 text-right font-mono">${metadata.pricePerGuest} MXN</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold">
                        ${(data.guestCount * metadata.pricePerGuest).toLocaleString("es-MX")} MXN
                      </td>
                    </tr>

                    {metadata.extraHours > 0 && (
                      <tr>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-on-surface print:text-black">
                            Horas Extra de Servicio ({metadata.extraHours} hr{metadata.extraHours > 1 ? "s" : ""})
                          </p>
                          <p className="text-xs text-on-surface-variant print:text-gray-600">
                            Atención extendida de barra.
                          </p>
                        </td>
                        <td className="py-3 px-4 text-center font-mono">{metadata.extraHours} hrs</td>
                        <td className="py-3 px-4 text-right font-mono">${(data.guestCount * 20)} MXN/hr</td>
                        <td className="py-3 px-4 text-right font-mono font-semibold">
                          ${metadata.extraHoursCost.toLocaleString("es-MX")} MXN
                        </td>
                      </tr>
                    )}

                    <tr>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-on-surface print:text-black">
                          Viáticos y Traslado de Equipo
                        </p>
                        <p className="text-xs text-on-surface-variant print:text-gray-600">
                          Ruta: {metadata.viaticosZone}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-center font-mono">1 servicio</td>
                      <td className="py-3 px-4 text-right font-mono">
                        ${metadata.viaticosCost.toLocaleString("es-MX")} MXN
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold">
                        ${metadata.viaticosCost.toLocaleString("es-MX")} MXN
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* TOTALES Y FORMA DE PAGO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            {/* Si es contrato: comprobante de pago de anticipo */}
            {isContract ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 print:border-gray-400 print:bg-gray-50">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-400 print:text-black flex items-center gap-1.5">
                  <CheckIcon className="h-4 w-4 text-emerald-500 print:text-black" />
                  Comprobante de Anticipo Recibido
                </p>
                <div className="mt-2 space-y-1 text-xs">
                  <p>
                    <strong className="text-on-surface print:text-black">Monto Recibido:</strong>{" "}
                    <span className="font-mono text-sm font-bold text-emerald-400 print:text-black">
                      ${(metadata.depositPaid ?? depositRequired).toLocaleString("es-MX")} MXN
                    </span>
                  </p>
                  <p>
                    <strong className="text-on-surface print:text-black">Método de Pago:</strong>{" "}
                    {metadata.depositMethod || "Efectivo en Sucursal"}
                  </p>
                  <p>
                    <strong className="text-on-surface print:text-black">Receptor:</strong>{" "}
                    {metadata.depositReceivedByName || metadata.creatorName} ({metadata.depositBranchName || "Sucursal"})
                  </p>
                  {metadata.depositPaidAt && (
                    <p className="text-on-surface-variant print:text-gray-600">
                      Fecha de pago: {new Date(metadata.depositPaidAt).toLocaleString("es-MX")}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-on-surface-variant print:border-gray-300 print:bg-gray-50 print:text-black">
                <p className="font-bold text-amber-400 print:text-black uppercase tracking-wider">
                  ⚠️ Instrucciones para Congelar Fecha
                </p>
                <p className="mt-1.5">
                  {isConsumo ? (
                    <>
                      Para apartar tu fecha en Barra a Consumo se cubren las <strong>horas de atención pactadas y viáticos (${data.saleAmount.toLocaleString("es-MX")} MXN)</strong>. El producto consumido no se cobra por adelantado; se contabiliza y liquida el día del evento. <strong>El bloqueo oficial se valida por WhatsApp ({OFFICIAL_WHATSAPP_DISPLAY})</strong>.
                    </>
                  ) : (
                    <>
                      Para apartar tu fecha se requiere el <strong>50% de anticipo (${depositRequired.toLocaleString("es-MX")} MXN)</strong>. Puede pagarse en efectivo en sucursal o transferencia, pero <strong>el bloqueo oficial de fecha se valida únicamente por el WhatsApp de Tequilitros Eventos ({OFFICIAL_WHATSAPP_DISPLAY})</strong>.
                    </>
                  )}
                </p>
              </div>
            )}

            {/* Cuadro de totales */}
            <div className="rounded-xl border border-outline-variant bg-surface-container-high p-4 space-y-2 print:border-gray-300 print:bg-gray-50">
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant print:text-gray-600">
                  {isConsumo ? "Total Servicio Fijo (Horas + Viáticos):" : "Total del Servicio:"}
                </span>
                <span className="font-mono font-bold text-base text-on-surface print:text-black">
                  ${data.saleAmount.toLocaleString("es-MX")} MXN
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-outline-variant pt-2 print:border-gray-300">
                <span className="text-on-surface-variant print:text-gray-600">
                  {isConsumo
                    ? (isContract ? "Monto Cubierto para Apartar:" : "Monto para Congelar Fecha:")
                    : (isContract ? "Anticipo Pagado (50%):" : "Anticipo Requerido (50%):")}
                </span>
                <span className="font-mono font-bold text-emerald-400 print:text-black">
                  ${(metadata.depositPaid ?? depositRequired).toLocaleString("es-MX")} MXN
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-outline-variant pt-2 print:border-gray-300">
                <span className="text-on-surface-variant print:text-gray-600">
                  {isConsumo ? "Consumo de Producto en Evento:" : "Saldo a Liquidar el Día del Evento:"}
                </span>
                <span className="font-mono font-bold text-primary print:text-black">
                  {isConsumo ? "A liquidar en evento" : `$${balanceRemaining.toLocaleString("es-MX")} MXN`}
                </span>
              </div>
            </div>
          </div>

          {/* LISTA OFICIAL DE PRECIOS POR PRODUCTO (BARRA A CONSUMO) */}
          {isConsumo && (
            <div className="rounded-xl border border-outline-variant p-4 bg-surface-container-low print:border-gray-300 print:bg-white space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-outline-variant pb-2 print:border-gray-300 gap-1">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-primary print:text-black">
                    Lista Oficial de Precios por Producto (Barra a Consumo)
                  </p>
                  <p className="text-[11px] text-on-surface-variant print:text-gray-600">
                    Precios oficiales por unidad consumida para la liquidación final durante el evento.
                  </p>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-surface-container-high border border-outline-variant text-on-surface print:bg-gray-100 print:text-black self-start sm:self-auto">
                  Tarifario Oficial (Pág. 4)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                {CONSUMO_PRICES_CATALOG.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center py-1 border-b border-outline-variant/30 print:border-gray-200"
                  >
                    <span className="text-on-surface print:text-black font-medium">{item.item}</span>
                    <span className="font-mono text-on-surface print:text-black font-semibold">
                      ${item.price} MXN <span className="text-[10px] font-normal text-on-surface-variant print:text-gray-600">/{item.unit}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NOTAS ESPECIALES */}
          {metadata.specialNotes && (
            <div className="rounded-xl border border-outline-variant p-3 bg-surface-container print:border-gray-300 print:bg-gray-50 text-xs">
              <strong className="text-on-surface print:text-black">Notas / Solicitudes Especiales:</strong>{" "}
              <span className="text-on-surface-variant print:text-gray-700">{metadata.specialNotes}</span>
            </div>
          )}

          {/* CLÁUSULAS OFICIALES Y CONDICIONES (IMPRESCINDIBLE EN EL CONTRATO) */}
          <div className="rounded-xl border border-outline-variant p-4 bg-surface-container-low print:border-gray-300 print:bg-white space-y-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface print:text-black border-b border-outline-variant pb-1.5 print:border-gray-300">
              Términos, Condiciones y Políticas de Contratación
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] leading-relaxed text-on-surface-variant print:text-gray-800">
              {OFFICIAL_CONTRACT_CLAUSES.map((clause, idx) => (
                <div key={idx} className="space-y-0.5">
                  <p className="font-bold text-on-surface print:text-black">{clause.title}</p>
                  <p>{clause.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* SECCIÓN DE FIRMAS (SOLO EN CONTRATO O AL IMPRIMIR) */}
          <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs print:pt-12">
            <div className="space-y-1">
              <div className="mx-auto w-48 border-b border-outline-variant print:border-black mb-2" />
              <p className="font-bold text-on-surface print:text-black">TEQUILITROS® EVENTOS</p>
              <p className="text-[11px] text-on-surface-variant print:text-gray-600">
                Prestador del Servicio · {metadata.creatorName}
              </p>
            </div>

            <div className="space-y-1">
              <div className="mx-auto w-48 border-b border-outline-variant print:border-black mb-2" />
              <p className="font-bold text-on-surface print:text-black">{data.clientName}</p>
              <p className="text-[11px] text-on-surface-variant print:text-gray-600">
                Firma de Conformidad del Cliente
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
