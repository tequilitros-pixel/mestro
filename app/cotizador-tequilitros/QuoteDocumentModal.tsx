"use client";

import { useRef } from "react";
import {
  OFFICIAL_WHATSAPP_PHONE,
  OFFICIAL_WHATSAPP_DISPLAY,
  OFFICIAL_CONTRACT_CLAUSES,
  type TequilitrosQuoteMetadata,
} from "@/lib/tequilitros/quote-types";
import { PrinterIcon, XIcon, CheckIcon } from "@/components/ui/icons";

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

  const depositRequired = metadata.depositRequired || Math.round(data.saleAmount * 0.5);
  const balanceRemaining = data.saleAmount - (metadata.depositPaid ?? depositRequired);

  // Mensaje para WhatsApp cliente
  const whatsappClientText = isContract
    ? `📋 *CONTRATO Y RECIBO OFICIAL DE EVENTO - TEQUILITROS*\n` +
      `Folio: ${metadata.contractFolio || data.code}\n` +
      `Cliente: ${data.clientName}\n` +
      `Fecha confirmada: ${formattedDate}\n` +
      `Invitados: ${data.guestCount} personas\n` +
      `Total del servicio: $${data.saleAmount.toLocaleString("es-MX")} MXN\n` +
      `✅ *Anticipo recibido (50%):* $${(metadata.depositPaid ?? depositRequired).toLocaleString("es-MX")} MXN\n` +
      `Saldo pendiente a liquidar el día del evento: $${balanceRemaining.toLocaleString("es-MX")} MXN\n\n` +
      `¡Tu fecha está oficialmente congelada y apartada en agenda!`
    : `🍸 *COTIZACIÓN DE BARRA MÓVIL - TEQUILITROS EVENTOS*\n` +
      `Folio: ${data.code}\n` +
      `Cliente: ${data.clientName}\n` +
      `Fecha: ${formattedDate}\n` +
      `Lugar: ${data.location}\n` +
      `Invitados: ${data.guestCount} personas (aforo total)\n` +
      `Modalidad: ${metadata.modality === "libre" ? "Barra Libre (4 hrs base)" : "Barra a Consumo"}\n` +
      `Bebidas: ${metadata.selectedDrinks?.join(", ") || "Cantaritos, Vampiros, Palomas"}\n\n` +
      `*Inversión Total:* $${data.saleAmount.toLocaleString("es-MX")} MXN\n` +
      `*Anticipo para apartar (50%):* $${depositRequired.toLocaleString("es-MX")} MXN\n` +
      `*Saldo el día del evento:* $${depositRequired.toLocaleString("es-MX")} MXN\n\n` +
      `📲 Para apartar tu fecha, comunícate al WhatsApp oficial: ${OFFICIAL_WHATSAPP_DISPLAY}`;

  const clientWhatsAppUrl = data.clientPhone
    ? `https://wa.me/${data.clientPhone.replace(/\D/g, "")}?text=${encodeURIComponent(whatsappClientText)}`
    : null;

  const centralWhatsAppUrl = `https://wa.me/${OFFICIAL_WHATSAPP_PHONE}?text=${encodeURIComponent(
    `Hola, envío cotización para validar y apartar fecha:\n` + whatsappClientText
  )}`;

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

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-bold text-on-primary hover:opacity-90 transition shadow-sm"
              title="Imprimir o guardar como PDF"
            >
              <PrinterIcon className="h-4 w-4" />
              <span>Imprimir / PDF</span>
            </button>

            {clientWhatsAppUrl && (
              <a
                href={clientWhatsAppUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-sm"
                title="Mandar por WhatsApp al cliente"
              >
                <span>WhatsApp Cliente</span>
              </a>
            )}

            <a
              href={centralWhatsAppUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#E28735] px-3 py-1.5 text-xs font-bold text-black hover:opacity-90 transition shadow-sm"
              title="Validar con Tequilitros Central"
            >
              <span>WhatsApp Central</span>
            </a>

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
                  Para apartar tu fecha se requiere el <strong>50% de anticipo</strong>. Dicho anticipo puede pagarse en efectivo en sucursal o por transferencia, pero <strong>el bloqueo oficial de fecha se valida únicamente a través del WhatsApp de Tequilitros Eventos ({OFFICIAL_WHATSAPP_DISPLAY})</strong>.
                </p>
              </div>
            )}

            {/* Cuadro de totales */}
            <div className="rounded-xl border border-outline-variant bg-surface-container-high p-4 space-y-2 print:border-gray-300 print:bg-gray-50">
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant print:text-gray-600">Total del Servicio:</span>
                <span className="font-mono font-bold text-base text-on-surface print:text-black">
                  ${data.saleAmount.toLocaleString("es-MX")} MXN
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-outline-variant pt-2 print:border-gray-300">
                <span className="text-on-surface-variant print:text-gray-600">
                  {isContract ? "Anticipo Pagado (50%):" : "Anticipo Requerido (50%):"}
                </span>
                <span className="font-mono font-bold text-emerald-400 print:text-black">
                  ${(metadata.depositPaid ?? depositRequired).toLocaleString("es-MX")} MXN
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-outline-variant pt-2 print:border-gray-300">
                <span className="text-on-surface-variant print:text-gray-600">Saldo a Liquidar el Día del Evento:</span>
                <span className="font-mono font-bold text-primary print:text-black">
                  ${balanceRemaining.toLocaleString("es-MX")} MXN
                </span>
              </div>
            </div>
          </div>

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
