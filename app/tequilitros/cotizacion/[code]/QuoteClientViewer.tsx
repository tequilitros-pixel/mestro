"use client";

import { useState } from "react";
import Link from "next/link";
import {
  OFFICIAL_WHATSAPP_PHONE,
  OFFICIAL_WHATSAPP_DISPLAY,
  CONSUMO_PRICES_CATALOG,
} from "@/lib/tequilitros/quote-types";
import { generateTequilitrosPdfBlob } from "@/lib/tequilitros/pdf-generator";
import type { PublicQuoteViewData } from "@/app/cotizador-tequilitros/actions";

interface QuoteClientViewerProps {
  quote: PublicQuoteViewData;
}

export default function QuoteClientViewer({ quote }: QuoteClientViewerProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const { metadata } = quote;
  const isContract = Boolean(quote.isConfirmed || metadata.isContractConfirmed);
  const isConsumo = metadata.modality === "consumo";

  const formattedEventDate = new Date(quote.eventDate).toLocaleDateString("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  const formattedIssueDate = new Date(quote.createdAt).toLocaleDateString("es-MX", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const atencionTotal = metadata.durationHours * 250;
  const totalFijo = isConsumo ? atencionTotal + metadata.viaticosCost : quote.saleAmount;
  const depositRequired = isConsumo
    ? totalFijo
    : metadata.depositRequired || Math.round(quote.saleAmount * 0.5);
  const depositPaid = metadata.depositPaid ?? (isContract ? depositRequired : 0);
  const balanceRemaining = isConsumo ? 0 : quote.saleAmount - depositPaid;

  const displayFolio = isContract ? metadata.contractFolio || quote.code : quote.code;

  // Enlace para apartar fecha por WhatsApp Central
  const whatsappApartarText = isContract
    ? `Hola Tequilitros, tengo mi Contrato ${displayFolio} para mi evento (${metadata.eventType} el ${formattedEventDate}) y deseo consultar un detalle de la logística.`
    : `Hola Tequilitros, tengo mi cotización ${quote.code} para mi evento (${metadata.eventType} el ${formattedEventDate}) con ${quote.guestCount} personas en ${quote.location}. Deseo confirmar y realizar el anticipo del 50% ($${depositRequired.toLocaleString("es-MX")} MXN) para congelar mi fecha.`;

  const whatsappApartarUrl = `https://wa.me/${OFFICIAL_WHATSAPP_PHONE}?text=${encodeURIComponent(
    whatsappApartarText
  )}`;

  const handleDownloadPdf = async (typeOverride?: "QUOTE" | "CONTRACT" | "RECEIPT") => {
    try {
      setIsGeneratingPdf(true);
      const targetType = typeOverride || (isContract ? "CONTRACT" : "QUOTE");
      const blob = await generateTequilitrosPdfBlob({
        code: quote.code,
        clientName: quote.clientName,
        clientPhone: quote.clientPhone,
        clientEmail: quote.clientEmail,
        location: quote.location,
        eventDate: quote.eventDate,
        guestCount: quote.guestCount,
        saleAmount: quote.saleAmount,
        documentType: targetType,
        metadata: quote.metadata,
      });

      const prefix =
        targetType === "RECEIPT"
          ? "Recibo"
          : targetType === "CONTRACT"
            ? "Contrato"
            : "Cotizacion";
      const fileFolio =
        targetType === "RECEIPT"
          ? metadata.receiptFolio || displayFolio
          : displayFolio;

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

  const handleShare = async () => {
    const shareUrl = window.location.href;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Cotización Tequilitros ${displayFolio} · ${quote.clientName}`,
          text: `Presupuesto oficial para ${quote.clientName} - Barra Móvil Tequilitros:`,
          url: shareUrl,
        });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-[#0C0E12] text-[#F3F4F6] selection:bg-[#E28735]/30">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0C0E12]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/tequilitros"
            className="flex items-center gap-2 group transition"
          >
            <span className="text-lg font-black tracking-tight text-[#E28735] group-hover:brightness-110">
              TEQUILITROS®
            </span>
            <span className="text-[11px] uppercase tracking-wider text-white/50 border-l border-white/15 pl-2 font-medium">
              Eventos & Barras
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/10 transition cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-emerald-400">¡Enlace Copiado!</span>
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  <span>Compartir</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#E28735] px-3.5 py-1.5 text-xs font-bold text-black hover:bg-[#F29645] transition disabled:opacity-50 cursor-pointer shadow-sm"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>{isGeneratingPdf ? "Generando..." : "Descargar PDF"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 space-y-8">
        {/* Hero Card */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] via-white/[0.03] to-transparent p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-[#E28735]/10 blur-3xl pointer-events-none" />

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-white/10 pb-6">
            <div>
              <div
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold mb-3 ${
                  isContract
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                    : quote.status === "APPROVED"
                      ? "border-blue-500/40 bg-blue-500/15 text-blue-300"
                      : quote.status === "REJECTED"
                        ? "border-red-500/40 bg-red-500/15 text-red-300"
                        : "border-[#E28735]/40 bg-[#E28735]/15 text-[#F29645]"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full animate-pulse ${
                    isContract
                      ? "bg-emerald-400"
                      : quote.status === "APPROVED"
                        ? "bg-blue-400"
                        : quote.status === "REJECTED"
                          ? "bg-red-400"
                          : "bg-[#E28735]"
                  }`}
                />
                {isContract
                  ? "FECHA OFICIALMENTE APARTADA Y CONTRATADA"
                  : quote.status === "APPROVED"
                    ? "COTIZACIÓN APROBADA POR EL CLIENTE"
                    : quote.status === "REJECTED"
                      ? "COTIZACIÓN NO APROBADA"
                      : "PRESUPUESTO FORMAL ACTIVO"}
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
                Cotización para {quote.clientName}
              </h1>
              <p className="mt-1.5 text-sm sm:text-base text-white/70">
                {metadata.eventType} · {quote.location}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-left sm:text-right shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">
                Folio Oficial
              </span>
              <span className="font-mono text-base sm:text-lg font-black text-[#E28735]">
                {displayFolio}
              </span>
              <span className="text-[11px] text-white/40 block mt-0.5">
                Emitido el {formattedIssueDate}
              </span>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6">
            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
              <span className="text-[11px] font-semibold text-white/50 block uppercase tracking-wider">
                Fecha del Evento
              </span>
              <span className="text-sm sm:text-base font-bold text-white capitalize mt-1 block">
                {formattedEventDate}
              </span>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
              <span className="text-[11px] font-semibold text-white/50 block uppercase tracking-wider">
                Aforo Estimado
              </span>
              <span className="text-sm sm:text-base font-bold text-white mt-1 block">
                {quote.guestCount} personas
              </span>
              <span className="text-[10px] text-white/40 block">Aforo total 100%</span>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
              <span className="text-[11px] font-semibold text-white/50 block uppercase tracking-wider">
                Duración de Servicio
              </span>
              <span className="text-sm sm:text-base font-bold text-white mt-1 block">
                {metadata.durationHours} horas
              </span>
              <span className="text-[10px] text-white/40 block">Atención continua</span>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
              <span className="text-[11px] font-semibold text-white/50 block uppercase tracking-wider">
                Modalidad
              </span>
              <span className="text-sm sm:text-base font-bold text-[#E28735] mt-1 block">
                {isConsumo ? "Barra a Consumo" : "Barra Libre"}
              </span>
              <span className="text-[10px] text-white/40 block">
                {isConsumo ? "$250/hr + consumo" : `$${metadata.pricePerGuest} / persona`}
              </span>
            </div>
          </div>
        </div>

        {/* 2-Column Details: Drinks Catalog & Economic Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column (7 cols): Drinks & Inclusions */}
          <div className="lg:col-span-7 space-y-6">
            {/* Drinks Card */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8 space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>🍸</span> Coctelería Oficial Incluida
                  </h2>
                  <p className="text-xs text-white/60 mt-0.5">
                    Servicio servido en vaso jumbo de 32 oz (946 ml) con recetas originales
                  </p>
                </div>
                <span className="rounded-full bg-[#E28735]/10 border border-[#E28735]/20 px-2.5 py-0.5 text-[11px] font-bold text-[#E28735]">
                  {metadata.selectedDrinks?.length || 7} variedades
                </span>
              </div>

              {/* Drinks Chips */}
              <div className="flex flex-wrap gap-2">
                {(metadata.selectedDrinks && metadata.selectedDrinks.length > 0
                  ? metadata.selectedDrinks
                  : [
                      "Cantarito",
                      "Paloma",
                      "Vampiro",
                      "Tequimiche",
                      "Tequimora",
                      "Tequimojito",
                      "Coscorrón",
                    ]
                ).map((drink) => (
                  <div
                    key={drink}
                    className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2 text-xs font-semibold text-white hover:border-[#E28735]/40 transition"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[#E28735]" />
                    <span>{drink}</span>
                  </div>
                ))}
              </div>

              {/* Inclusions Feature List */}
              <div className="rounded-2xl border border-white/5 bg-black/30 p-4 space-y-2.5 text-xs text-white/80">
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span><strong>Tequila Artesanal de la Casa:</strong> Destilado premium blanco y reposado para todas las preparaciones de barra.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span><strong>Insumos Completos:</strong> Refrescos (Squirt/Peñafiel), jugo de toronja, sangrita, Clamato, hielo ilimitado y escarchados Tajín.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span><strong>Opciones Sin Alcohol (Mocktails):</strong> Bebidas refrescantes preparadas para menores, niños y no bebedores.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span><strong>Personal Calificado:</strong> Bartenders experimentados y montaje de módulo móvil de madera 1.5 horas antes del evento.</span>
                </div>
              </div>
            </div>

            {/* Special Notes (if any) */}
            {metadata.specialNotes && (
              <div className="rounded-3xl border border-amber-500/20 bg-amber-500/[0.05] p-6 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Acuerdos y Especificaciones Logísticas
                </h3>
                <p className="text-sm text-white/90 leading-relaxed">
                  {metadata.specialNotes}
                </p>
              </div>
            )}

            {/* If Barra a Consumo: Price Catalog Preview */}
            {isConsumo && (
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="text-sm font-bold text-white">
                    Tarifario Oficial por Producto Consumido
                  </h3>
                  <span className="text-[10px] text-white/50">Pág. 4 del Manual</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {CONSUMO_PRICES_CATALOG.slice(0, 10).map((item) => (
                    <div key={item.item} className="flex items-center justify-between py-1 border-b border-white/5">
                      <span className="text-white/70">{item.item}</span>
                      <strong className="text-white font-mono">${item.price} MXN</strong>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-white/50 italic">
                  * El producto se contabiliza y liquida en sitio al concluir el evento.
                </p>
              </div>
            )}

            {/* Contract Clauses Summary */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 space-y-3 text-xs text-white/70">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Condiciones y Políticas de Reserva
              </h3>
              <ul className="space-y-2 list-disc list-inside">
                <li><strong className="text-white">Apartado de Fecha:</strong> Se requiere el 50% de anticipo para congelar la fecha en agenda oficial.</li>
                <li><strong className="text-white">Anticipo No Reembolsable:</strong> Por bloqueo exclusivo de fecha y rechazo de otros solicitantes para ese día.</li>
                <li><strong className="text-white">Cómputo de Aforo:</strong> La modalidad Barra Libre computa al 100% de los asistentes (incluyendo niños y adultos).</li>
                <li><strong className="text-white">Cambios de Fecha:</strong> Requieren mínimo 15 días naturales de anticipación y están sujetos a disponibilidad.</li>
                <li><strong className="text-white">Liquidación del Saldo:</strong> El 50% restante se liquida el día del evento antes de iniciar el servicio.</li>
              </ul>
            </div>
          </div>

          {/* Right Column (5 cols): Investment & CTAs */}
          <div className="lg:col-span-5 space-y-6">
            {/* Investment Breakdown Card */}
            <div className="rounded-3xl border border-[#E28735]/30 bg-gradient-to-b from-[#E28735]/10 via-white/[0.04] to-black/40 p-6 sm:p-8 space-y-6 shadow-xl">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#E28735] block">
                  Resumen Económico
                </span>
                <h3 className="text-xl font-black text-white mt-0.5">
                  Desglose de Presupuesto
                </h3>
              </div>

              {/* Rows */}
              <div className="space-y-3 text-xs border-y border-white/10 py-4">
                {!isConsumo ? (
                  <>
                    <div className="flex items-center justify-between text-white/80">
                      <span>Servicio Barra Libre ({quote.guestCount} pers. x ${metadata.pricePerGuest})</span>
                      <strong className="font-mono text-white text-sm">
                        ${(quote.guestCount * metadata.pricePerGuest).toLocaleString("es-MX")} MXN
                      </strong>
                    </div>

                    {metadata.extraHours > 0 && (
                      <div className="flex items-center justify-between text-white/80">
                        <span>Horas Extra ({metadata.extraHours} hrs x ${quote.guestCount * 20})</span>
                        <strong className="font-mono text-white text-sm">
                          ${metadata.extraHoursCost.toLocaleString("es-MX")} MXN
                        </strong>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-between text-white/80">
                    <span>Atención de Bartenders ({metadata.durationHours} hrs x $250)</span>
                    <strong className="font-mono text-white text-sm">
                      ${atencionTotal.toLocaleString("es-MX")} MXN
                    </strong>
                  </div>
                )}

                <div className="flex items-center justify-between text-white/80">
                  <span>Viáticos y Traslado ({metadata.viaticosZone})</span>
                  <strong className="font-mono text-white text-sm">
                    {metadata.viaticosCost > 0 ? `$${metadata.viaticosCost.toLocaleString("es-MX")} MXN` : "Sin costo"}
                  </strong>
                </div>
              </div>

              {/* Total Card */}
              <div className="rounded-2xl border border-white/10 bg-black/50 p-4 space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-semibold text-white/70">
                    {isConsumo ? "Total Fijo (Horas + Viáticos):" : "Total del Servicio:"}
                  </span>
                  <span className="text-2xl font-black font-mono text-white">
                    ${(isConsumo ? totalFijo : quote.saleAmount).toLocaleString("es-MX")}{" "}
                    <span className="text-xs font-normal text-white/60">MXN</span>
                  </span>
                </div>

                <div className="border-t border-white/10 pt-3 flex items-baseline justify-between text-emerald-400">
                  <span className="text-xs font-bold">
                    {isContract ? "Anticipo Cubierto:" : "Anticipo para Congelar (50%):"}
                  </span>
                  <span className="text-lg font-black font-mono">
                    ${(isContract ? depositPaid : depositRequired).toLocaleString("es-MX")} MXN
                  </span>
                </div>

                <div className="flex items-baseline justify-between text-white/70 text-xs">
                  <span>
                    {isConsumo ? "Consumo de producto:" : "Saldo previo al evento:"}
                  </span>
                  <span className="font-bold font-mono text-white">
                    {isConsumo ? "A liquidar en evento" : `$${balanceRemaining.toLocaleString("es-MX")} MXN`}
                  </span>
                </div>
              </div>

              {/* Contract Status or Apartar CTA */}
              {isContract ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center space-y-1">
                  <span className="text-emerald-400 font-bold text-sm block">
                    ✓ Fecha Oficialmente Apartada
                  </span>
                  <p className="text-xs text-white/70">
                    Tu servicio está confirmado y registrado en la agenda operativa de Tequilitros.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <a
                    href={whatsappApartarUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-bold text-white hover:bg-emerald-500 transition shadow-lg shadow-emerald-900/30 text-center"
                  >
                    <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                    <span>Apartar Fecha por WhatsApp</span>
                  </a>
                  <p className="text-[11px] text-white/50 text-center">
                    Serás atendido directamente por el equipo central de Tequilitros ({OFFICIAL_WHATSAPP_DISPLAY})
                  </p>
                </div>
              )}

              {/* Secondary Download Button */}
              <div className="space-y-2">
                {metadata.depositPaid && metadata.depositPaid > 0 ? (
                  <>
                    <button
                      onClick={() => handleDownloadPdf("RECEIPT")}
                      disabled={isGeneratingPdf}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-600/20 border border-emerald-500/40 px-4 py-3 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 transition cursor-pointer"
                    >
                      <span>🧾</span>
                      <span>{isGeneratingPdf ? "Preparando..." : "Descargar Recibo Oficial de Anticipo"}</span>
                    </button>

                    <button
                      onClick={() => handleDownloadPdf("CONTRACT")}
                      disabled={isGeneratingPdf}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/10 transition cursor-pointer"
                    >
                      <span>📑</span>
                      <span>{isGeneratingPdf ? "Preparando..." : "Descargar Contrato Oficial"}</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleDownloadPdf("QUOTE")}
                    disabled={isGeneratingPdf}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-xs font-bold text-white hover:bg-white/10 transition cursor-pointer"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>{isGeneratingPdf ? "Preparando documento..." : "Descargar Cotización en PDF"}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Support / Contact Note */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/60 space-y-1">
              <span className="font-bold text-white block">Atención Personalizada</span>
              <p>
                Cotización elaborada por <strong>{metadata.creatorName}</strong> ({metadata.branchName || "Sucursal"}). Si requieres ajustar el aforo o la selección de bebidas, contáctanos antes de congelar tu fecha.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/60 py-8 px-4 text-center text-xs text-white/40 space-y-2 mt-12">
        <p>
          TEQUILITROS® · Destiladora del Norte · Colotlán, Jalisco, México
        </p>
        <p>
          Línea directa WhatsApp: {OFFICIAL_WHATSAPP_DISPLAY} · Servicio en Jalisco, Zacatecas y Aguascalientes
        </p>
      </footer>
    </div>
  );
}
