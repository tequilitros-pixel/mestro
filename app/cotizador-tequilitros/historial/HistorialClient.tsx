"use client";

import { useState } from "react";
import {
  type EmployeeLeaderboardItem,
  type TequilitrosQuoteMetadata,
} from "@/lib/tequilitros/quote-types";
import { registerDepositAction } from "../actions";
import QuoteDocumentModal from "../QuoteDocumentModal";
import {
  SearchIcon,
  PrinterIcon,
  CrownIcon,
  CheckIcon,
  DollarIcon,
  ListChecksIcon,
} from "@/components/ui/icons";

interface QuoteItem {
  id: string;
  code: string;
  clientName: string;
  clientPhone?: string | null;
  location: string;
  eventDate: string;
  guestCount: number;
  saleAmount: number;
  status: string;
  createdAt: string;
  metadata: TequilitrosQuoteMetadata | null;
  isConfirmed: boolean;
}

interface HistorialClientProps {
  quotes: QuoteItem[];
  leaderboard: EmployeeLeaderboardItem[];
}

export default function HistorialClient({
  quotes,
  leaderboard,
}: HistorialClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "PENDING" | "CONFIRMED">("ALL");

  // Modal de documento (Cotización o Contrato)
  const [selectedDoc, setSelectedDoc] = useState<{
    code: string;
    clientName: string;
    clientPhone?: string | null;
    clientEmail?: string | null;
    location: string;
    eventDate: string;
    guestCount: number;
    saleAmount: number;
    metadata: TequilitrosQuoteMetadata;
    documentType: "QUOTE" | "CONTRACT";
  } | null>(null);

  // Modal para registrar anticipo
  const [depositModalQuote, setDepositModalQuote] = useState<QuoteItem | null>(null);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [depositMethod, setDepositMethod] = useState("Efectivo en Sucursal");
  const [depositNotes, setDepositNotes] = useState("");
  const [submittingDeposit, setSubmittingDeposit] = useState(false);

  // Filtrado de la tabla
  const filteredQuotes = quotes.filter((q) => {
    const matchesSearch =
      q.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.metadata?.creatorName || "").toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filterStatus === "PENDING") return !q.isConfirmed;
    if (filterStatus === "CONFIRMED") return q.isConfirmed;
    return true;
  });

  function openDepositModal(quote: QuoteItem) {
    const half = Math.round(quote.saleAmount * 0.5);
    setDepositAmount(half);
    setDepositModalQuote(quote);
  }

  async function handleConfirmDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (!depositModalQuote) return;

    setSubmittingDeposit(true);
    try {
      const res = await registerDepositAction({
        eventId: depositModalQuote.id,
        depositPaid: depositAmount,
        depositMethod,
        contractNotes: depositNotes,
        branchName: depositModalQuote.metadata?.branchName,
      });

      if (res.success && res.metadata) {
        // Abrir el contrato formal de inmediato
        setSelectedDoc({
          code: depositModalQuote.code,
          clientName: depositModalQuote.clientName,
          clientPhone: depositModalQuote.clientPhone,
          clientEmail: depositModalQuote.metadata?.clientEmail,
          location: depositModalQuote.location,
          eventDate: depositModalQuote.eventDate,
          guestCount: depositModalQuote.guestCount,
          saleAmount: depositModalQuote.saleAmount,
          metadata: res.metadata,
          documentType: "CONTRACT",
        });
        setDepositModalQuote(null);
      } else {
        alert(res.error || "No se pudo registrar el anticipo.");
      }
    } finally {
      setSubmittingDeposit(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Encabezado */}
      <div className="border-b border-outline-variant pb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
            <ListChecksIcon className="h-4 w-4" />
          </span>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-on-surface">
            Control de Cotizaciones y Productividad
          </h1>
        </div>
        <p className="mt-1 text-xs sm:text-sm text-on-surface-variant">
          Historial de cotizaciones generadas y métricas de desempeño por trabajador.
        </p>
      </div>

      {/* SECCIÓN 1: PANEL DE RENDIMIENTO Y CONTROL POR TRABAJADOR */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CrownIcon className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface">
              Métricas y Ranking de Cotizaciones por Empleado
            </h2>
          </div>
          <span className="text-xs text-on-surface-variant">
            {leaderboard.length} colaborador{leaderboard.length !== 1 ? "es" : ""} activo{leaderboard.length !== 1 ? "s" : ""}
          </span>
        </div>

        {leaderboard.length === 0 ? (
          <div className="rounded-2xl border border-outline-variant bg-surface-container p-6 text-center text-xs text-on-surface-variant">
            Aún no hay cotizaciones registradas por trabajadores.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {leaderboard.map((item, index) => {
              const isFirst = index === 0;
              return (
                <div
                  key={item.userId}
                  className={`rounded-2xl border p-4 transition shadow-sm ${
                    isFirst
                      ? "border-amber-500/40 bg-amber-500/10"
                      : "border-outline-variant bg-surface-container-low"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                        Puesto #{index + 1}
                      </span>
                      <p className="font-bold text-sm text-on-surface mt-0.5 truncate">
                        {item.userName}
                      </p>
                    </div>
                    {isFirst && (
                      <span className="rounded-full bg-amber-500/20 p-1.5 text-amber-400">
                        <CrownIcon className="h-4 w-4" />
                      </span>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs border-t border-outline-variant pt-3">
                    <div>
                      <p className="text-[11px] text-on-surface-variant">Cotizaciones</p>
                      <p className="font-mono text-base font-bold text-primary">
                        {item.quotesCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-on-surface-variant">Confirmadas</p>
                      <p className="font-mono text-base font-bold text-emerald-400">
                        {item.confirmedContractsCount}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 text-[11px] text-on-surface-variant pt-2 border-t border-outline-variant/60">
                    <span>Monto cotizado: </span>
                    <strong className="font-mono text-on-surface">
                      ${item.totalQuotedAmount.toLocaleString("es-MX")}
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECCIÓN 2: TABLA DE COTIZACIONES */}
      <div className="space-y-4">
        {/* Barra de Filtros y Búsqueda */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-on-surface-variant" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por cliente, folio, lugar o empleado..."
              className="w-full rounded-xl border border-outline-variant bg-surface-container py-2 pl-9 pr-3 text-xs text-on-surface focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 self-stretch sm:self-auto text-xs bg-surface-container p-1 rounded-xl border border-outline-variant">
            <button
              onClick={() => setFilterStatus("ALL")}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                filterStatus === "ALL"
                  ? "bg-primary text-on-primary font-bold shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Todas ({quotes.length})
            </button>
            <button
              onClick={() => setFilterStatus("PENDING")}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                filterStatus === "PENDING"
                  ? "bg-amber-500 text-black font-bold shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Pendientes
            </button>
            <button
              onClick={() => setFilterStatus("CONFIRMED")}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                filterStatus === "CONFIRMED"
                  ? "bg-emerald-600 text-white font-bold shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Confirmadas
            </button>
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container-low shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-container border-b border-outline-variant text-on-surface-variant">
              <tr>
                <th className="py-3 px-4 font-bold">Folio / Fecha</th>
                <th className="py-3 px-4 font-bold">Cliente</th>
                <th className="py-3 px-4 font-bold">Fecha del Evento</th>
                <th className="py-3 px-4 font-bold text-center">Aforo</th>
                <th className="py-3 px-4 font-bold text-right">Inversión</th>
                <th className="py-3 px-4 font-bold">Elaborado por</th>
                <th className="py-3 px-4 font-bold text-center">Estatus</th>
                <th className="py-3 px-4 font-bold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {filteredQuotes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-on-surface-variant italic">
                    No se encontraron cotizaciones con los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                filteredQuotes.map((q) => {
                  const eventDateStr = new Date(q.eventDate).toLocaleDateString("es-MX", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    timeZone: "UTC",
                  });

                  return (
                    <tr key={q.id} className="hover:bg-surface-container/50 transition">
                      {/* Folio */}
                      <td className="py-3 px-4 font-mono font-bold text-on-surface">
                        {q.code}
                      </td>

                      {/* Cliente */}
                      <td className="py-3 px-4">
                        <p className="font-semibold text-on-surface">{q.clientName}</p>
                        {q.clientPhone && (
                          <p className="text-[11px] text-on-surface-variant">{q.clientPhone}</p>
                        )}
                      </td>

                      {/* Fecha del evento */}
                      <td className="py-3 px-4 font-medium text-on-surface">
                        {eventDateStr}
                      </td>

                      {/* Aforo */}
                      <td className="py-3 px-4 text-center font-mono font-semibold">
                        {q.guestCount} pers.
                      </td>

                      {/* Monto */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-on-surface">
                        ${q.saleAmount.toLocaleString("es-MX")}
                      </td>

                      {/* Empleado y Sucursal */}
                      <td className="py-3 px-4">
                        <p className="font-medium text-on-surface">
                          {q.metadata?.creatorName || "Sucursal"}
                        </p>
                        <p className="text-[10px] text-primary">
                          {q.metadata?.branchName || "Matriz"}
                        </p>
                      </td>

                      {/* Estatus */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            q.isConfirmed
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {q.isConfirmed ? "CONFIRMADO" : "PENDIENTE"}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                        {/* Botón Ver PDF / Cotización */}
                        <button
                          onClick={() => {
                            if (q.metadata) {
                              setSelectedDoc({
                                code: q.code,
                                clientName: q.clientName,
                                clientPhone: q.clientPhone,
                                clientEmail: q.metadata.clientEmail,
                                location: q.location,
                                eventDate: q.eventDate,
                                guestCount: q.guestCount,
                                saleAmount: q.saleAmount,
                                metadata: q.metadata,
                                documentType: q.isConfirmed ? "CONTRACT" : "QUOTE",
                              });
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-surface-container border border-outline-variant px-2.5 py-1 text-[11px] font-bold text-on-surface hover:bg-surface-container-high transition"
                          title="Ver e imprimir PDF"
                        >
                          <PrinterIcon className="h-3.5 w-3.5" />
                          <span>PDF</span>
                        </button>

                        {/* Botón Registrar Anticipo si sigue pendiente */}
                        {!q.isConfirmed && (
                          <button
                            onClick={() => openDepositModal(q)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-500 transition shadow-sm"
                            title="Registrar anticipo del 50% y generar contrato"
                          >
                            <DollarIcon className="h-3.5 w-3.5" />
                            <span>Anticipo</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL PARA REGISTRAR ANTICIPO */}
      {depositModalQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleConfirmDeposit}
            className="w-full max-w-md rounded-2xl border border-outline-variant bg-surface p-6 shadow-2xl text-on-surface space-y-4"
          >
            <div className="border-b border-outline-variant pb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                Paso Final · Cerrar Trato
              </span>
              <h3 className="text-base font-bold text-on-surface">
                Registrar Anticipo y Emitir Contrato
              </h3>
              <p className="text-xs text-on-surface-variant mt-1">
                Cliente: <strong>{depositModalQuote.clientName}</strong> · Folio: {depositModalQuote.code}
              </p>
              <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-300">
                Confirma este paso solo después de verificar el pago. Este registro reserva la fecha, pero no crea un movimiento de caja o contabilidad.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">
                  Monto del Anticipo Recibido (50% sugerido) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-on-surface-variant font-mono">$</span>
                  <input
                    type="number"
                    required
                    min="1"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(Number(e.target.value))}
                    className="w-full rounded-lg border border-outline-variant bg-surface pl-7 pr-3 py-2 font-mono font-bold text-sm text-on-surface focus:border-primary focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-on-surface-variant mt-1">
                  Total del evento: ${depositModalQuote.saleAmount.toLocaleString("es-MX")} MXN
                </p>
              </div>

              <div>
                <label className="block font-semibold mb-1">Forma de Pago del Anticipo *</label>
                <select
                  value={depositMethod}
                  onChange={(e) => setDepositMethod(e.target.value)}
                  className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-xs text-on-surface focus:border-primary focus:outline-none"
                >
                  <option value="Efectivo en Sucursal">Efectivo en Sucursal</option>
                  <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                  <option value="Tarjeta de Débito/Crédito">Tarjeta de Débito/Crédito</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Notas de Cobro (opcional)</label>
                <input
                  type="text"
                  value={depositNotes}
                  onChange={(e) => setDepositNotes(e.target.value)}
                  placeholder="Ej. Entregado en caja Canoas con recibo provisorio"
                  className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-xs text-on-surface focus:border-primary focus:outline-none"
                />
              </div>

              {/* Recordatorio clave */}
              <div className="rounded-lg bg-surface-container p-2.5 text-[11px] leading-relaxed text-on-surface-variant border border-outline-variant">
                ⚠️ <strong className="text-on-surface">Importante:</strong> Al registrar este anticipo, el evento se marca como <span className="text-red-400 font-bold">CONFIRMADO</span>, se genera el contrato oficial foliado y la fecha suma para el límite de 3 eventos del calendario.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant">
              <button
                type="button"
                onClick={() => setDepositModalQuote(null)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submittingDeposit}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition shadow-sm"
              >
                {submittingDeposit ? "Registrando..." : "Confirmar y Ver Contrato"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DE VISUALIZACIÓN / IMPRESIÓN DE DOCUMENTO */}
      {selectedDoc && (
        <QuoteDocumentModal
          isOpen={Boolean(selectedDoc)}
          onClose={() => setSelectedDoc(null)}
          documentType={selectedDoc.documentType}
          data={selectedDoc}
        />
      )}
    </div>
  );
}
