"use client";

import { useState } from "react";
import {
  type EmployeeLeaderboardItem,
  type TequilitrosQuoteMetadata,
  type QuoteStatus,
} from "@/lib/tequilitros/quote-types";
import { updateQuoteStatusAndDepositAction } from "../actions";
import QuoteDocumentModal from "../QuoteDocumentModal";
import {
  SearchIcon,
  PrinterIcon,
  CrownIcon,
  CheckIcon,
  DollarIcon,
  ListChecksIcon,
  XIcon,
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
  quotes: initialQuotes,
  leaderboard,
}: HistorialClientProps) {
  const [quotesList, setQuotesList] = useState<QuoteItem[]>(initialQuotes);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "PENDING" | "APPROVED" | "CONFIRMED" | "REJECTED">("ALL");
  const [copiedQuoteId, setCopiedQuoteId] = useState<string | null>(null);

  // Modal de documento (Cotización, Recibo o Contrato)
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
    documentType: "QUOTE" | "CONTRACT" | "RECEIPT";
  } | null>(null);

  // Modal para cambiar estatus y registrar anticipo
  const [statusModalQuote, setStatusModalQuote] = useState<QuoteItem | null>(null);
  const [modalStatus, setModalStatus] = useState<QuoteStatus>("CONFIRMED");
  const [modalDepositAmount, setModalDepositAmount] = useState<number>(0);
  const [modalDepositDate, setModalDepositDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [modalDepositMethod, setModalDepositMethod] = useState("Efectivo en Sucursal");
  const [modalNotes, setModalNotes] = useState("");
  const [submittingStatus, setSubmittingStatus] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Filtrado de la tabla
  const filteredQuotes = quotesList.filter((q) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      q.clientName.toLowerCase().includes(term) ||
      q.code.toLowerCase().includes(term) ||
      q.location.toLowerCase().includes(term) ||
      (q.metadata?.creatorName || "").toLowerCase().includes(term) ||
      (q.metadata?.contractFolio || "").toLowerCase().includes(term) ||
      (q.metadata?.receiptFolio || "").toLowerCase().includes(term);

    if (!matchesSearch) return false;

    const currentStatus = String(q.metadata?.status || (q.isConfirmed ? "CONFIRMED" : "PENDING")).toUpperCase();
    if (filterStatus === "PENDING") return currentStatus === "PENDING" || (!q.isConfirmed && currentStatus !== "APPROVED" && currentStatus !== "REJECTED");
    if (filterStatus === "APPROVED") return currentStatus === "APPROVED";
    if (filterStatus === "CONFIRMED") return currentStatus === "CONFIRMED" || q.isConfirmed;
    if (filterStatus === "REJECTED") return currentStatus === "REJECTED" || currentStatus === "CANCELLED";
    return true;
  });

  function openStatusModal(quote: QuoteItem) {
    setModalError(null);
    const meta = quote.metadata;
    const currentSt = (meta?.status as QuoteStatus) || (quote.isConfirmed ? "CONFIRMED" : "PENDING");
    setModalStatus(currentSt === "PENDING" ? "CONFIRMED" : currentSt);

    const isConsumo = meta?.modality === "consumo";
    const defaultAmount = isConsumo ? quote.saleAmount : Math.round(quote.saleAmount * 0.5);
    setModalDepositAmount(meta?.depositPaid ?? defaultAmount);

    if (meta?.depositPaidAt) {
      setModalDepositDate(meta.depositPaidAt.slice(0, 10));
    } else {
      setModalDepositDate(new Date().toISOString().slice(0, 10));
    }

    setModalDepositMethod(meta?.depositMethod || "Efectivo en Sucursal");
    setModalNotes(meta?.contractNotes || "");
    setStatusModalQuote(quote);
  }

  async function handleConfirmStatusUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!statusModalQuote) return;

    setSubmittingStatus(true);
    setModalError(null);

    try {
      const res = await updateQuoteStatusAndDepositAction({
        eventId: statusModalQuote.id, // Siempre editar el registro exacto, no el folio compartido.
        status: modalStatus,
        depositPaid: modalStatus === "CONFIRMED" || modalDepositAmount > 0 ? modalDepositAmount : 0,
        depositPaidAt: modalDepositDate,
        depositMethod: modalDepositMethod,
        contractNotes: modalNotes,
        branchName: statusModalQuote.metadata?.branchName,
      });

      if (res.success && res.metadata) {
        // Actualizar la lista en memoria inmediatamente
        setQuotesList((prev) =>
          prev.map((item) => {
            if (item.id === statusModalQuote.id || item.code === statusModalQuote.code) {
              const isConf = Boolean(res.metadata?.isContractConfirmed || res.metadata?.status === "CONFIRMED");
              return {
                ...item,
                status: res.metadata?.status || modalStatus,
                isConfirmed: isConf,
                metadata: res.metadata ?? item.metadata,
              };
            }
            return item;
          })
        );

        // Si se confirmó o aprobó, abrir el documento correspondiente
        const targetDocType: "QUOTE" | "CONTRACT" | "RECEIPT" =
          modalStatus === "CONFIRMED" ? "CONTRACT" : "QUOTE";

        setSelectedDoc({
          code: statusModalQuote.code,
          clientName: statusModalQuote.clientName,
          clientPhone: statusModalQuote.clientPhone,
          clientEmail: res.metadata.clientEmail,
          location: statusModalQuote.location,
          eventDate: statusModalQuote.eventDate,
          guestCount: statusModalQuote.guestCount,
          saleAmount: statusModalQuote.saleAmount,
          metadata: res.metadata,
          documentType: targetDocType,
        });

        setStatusModalQuote(null);
      } else {
        setModalError(res.error || "No se pudo actualizar el estatus.");
      }
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Error desconocido al actualizar.");
    } finally {
      setSubmittingStatus(false);
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
            Control de Cotizaciones, Estatus y Contratos
          </h1>
        </div>
        <p className="mt-1 text-xs sm:text-sm text-on-surface-variant">
          Historial completo de eventos presupuestados, gestión de aprobaciones, registro de anticipos y emisión de contratos y recibos oficiales.
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
            {leaderboard.length} colaborador{leaderboard.length === 1 ? "" : "es"} activos
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {leaderboard.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-outline-variant bg-surface-container-low p-6 text-center text-xs text-on-surface-variant italic">
              No hay métricas de cotizaciones registradas aún.
            </div>
          ) : (
            leaderboard.map((item, idx) => (
              <div
                key={item.userId}
                className="relative overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low p-4 shadow-sm hover:border-primary/50 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        idx === 0
                          ? "bg-amber-500 text-black shadow-sm"
                          : idx === 1
                            ? "bg-gray-300 text-black"
                            : idx === 2
                              ? "bg-amber-700 text-white"
                              : "bg-surface-container text-on-surface-variant"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <h3 className="font-bold text-sm text-on-surface truncate max-w-[140px]">
                      {item.userName}
                    </h3>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                    {item.quotesCount} cotiz.
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 border-t border-outline-variant pt-2 text-xs">
                  <div className="flex justify-between text-on-surface-variant">
                    <span>Contratos Cerrados:</span>
                    <strong className="text-emerald-400 font-mono">
                      {item.confirmedContractsCount}
                    </strong>
                  </div>
                  <div className="flex justify-between text-on-surface-variant">
                    <span>Efectividad de Cierre:</span>
                    <strong className="text-on-surface font-mono">
                      {item.quotesCount > 0
                        ? `${Math.round((item.confirmedContractsCount / item.quotesCount) * 100)}%`
                        : "0%"}
                    </strong>
                  </div>
                  <div className="flex justify-between text-on-surface-variant">
                    <span>Monto Cotizado:</span>
                    <strong className="text-on-surface font-mono">
                      ${item.totalQuotedAmount.toLocaleString("es-MX")}
                    </strong>
                  </div>
                  <div className="flex justify-between border-t border-outline-variant pt-1 text-emerald-400">
                    <span className="font-semibold">Monto Confirmado:</span>
                    <strong className="font-mono">
                      ${item.totalConfirmedAmount.toLocaleString("es-MX")}
                    </strong>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* SECCIÓN 2: HISTORIAL DE COTIZACIONES */}
      <div className="space-y-4 pt-4 border-t border-outline-variant">
        {/* Barra de Filtros y Búsqueda */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-on-surface-variant" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por cliente, folio, sede o asesor..."
              className="w-full rounded-xl border border-outline-variant bg-surface-container py-2 pl-9 pr-3 text-xs text-on-surface focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 self-stretch sm:self-auto text-xs bg-surface-container p-1 rounded-xl border border-outline-variant">
            <button
              onClick={() => setFilterStatus("ALL")}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                filterStatus === "ALL"
                  ? "bg-primary text-on-primary font-bold shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Todas ({quotesList.length})
            </button>
            <button
              onClick={() => setFilterStatus("PENDING")}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                filterStatus === "PENDING"
                  ? "bg-amber-500 text-black font-bold shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Pendientes
            </button>
            <button
              onClick={() => setFilterStatus("APPROVED")}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                filterStatus === "APPROVED"
                  ? "bg-blue-600 text-white font-bold shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Aprobadas
            </button>
            <button
              onClick={() => setFilterStatus("CONFIRMED")}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                filterStatus === "CONFIRMED"
                  ? "bg-emerald-600 text-white font-bold shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Confirmadas
            </button>
            <button
              onClick={() => setFilterStatus("REJECTED")}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                filterStatus === "REJECTED"
                  ? "bg-red-600 text-white font-bold shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Rechazadas
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
                <th className="py-3 px-4 font-bold text-right">Anticipo</th>
                <th className="py-3 px-4 font-bold">Asesor</th>
                <th className="py-3 px-4 font-bold text-center">Estatus</th>
                <th className="py-3 px-4 font-bold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {filteredQuotes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-on-surface-variant italic">
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

                  const currentSt = String(q.metadata?.status || (q.isConfirmed ? "CONFIRMED" : "PENDING")).toUpperCase();
                  const isConf = currentSt === "CONFIRMED" || q.isConfirmed;
                  const isAppr = currentSt === "APPROVED";
                  const isRej = currentSt === "REJECTED" || currentSt === "CANCELLED";
                  const depAmount = q.metadata?.depositPaid ?? 0;

                  return (
                    <tr key={q.id} className="hover:bg-surface-container/50 transition">
                      {/* Folio */}
                      <td className="py-3 px-4 font-mono font-bold text-on-surface">
                        <div>{q.code}</div>
                        {q.metadata?.contractFolio && (
                          <div className="text-[10px] text-purple-400 font-mono">
                            {q.metadata.contractFolio}
                          </div>
                        )}
                      </td>

                      {/* Cliente */}
                      <td className="py-3 px-4">
                        <p className="font-semibold text-on-surface">{q.clientName}</p>
                        {q.clientPhone && (
                          <p className="text-[11px] text-on-surface-variant">{q.clientPhone}</p>
                        )}
                      </td>

                      {/* Fecha del evento */}
                      <td className="py-3 px-4 font-medium text-on-surface whitespace-nowrap">
                        {eventDateStr}
                      </td>

                      {/* Aforo */}
                      <td className="py-3 px-4 text-center font-mono font-semibold">
                        {q.guestCount} pers.
                      </td>

                      {/* Monto Total */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-on-surface">
                        ${q.saleAmount.toLocaleString("es-MX")}
                      </td>

                      {/* Monto Anticipo */}
                      <td className="py-3 px-4 text-right font-mono">
                        {depAmount > 0 ? (
                          <span className="font-bold text-emerald-400">
                            ${depAmount.toLocaleString("es-MX")}
                          </span>
                        ) : (
                          <span className="text-on-surface-variant text-[11px] italic">Sin anticipo</span>
                        )}
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
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            isConf
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : isAppr
                                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                : isRej
                                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                  : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {isConf
                            ? "CONFIRMADO"
                            : isAppr
                              ? "APROBADO"
                              : isRej
                                ? "RECHAZADO"
                                : "PENDIENTE"}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                        {/* Botón Cambiar Estatus / Registrar Anticipo */}
                        <button
                          onClick={() => openStatusModal(q)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-500 transition shadow-sm cursor-pointer"
                          title="Cambiar estatus, registrar anticipo o cerrar contrato"
                        >
                          <DollarIcon className="h-3 w-3" />
                          <span>Estatus</span>
                        </button>

                        {/* Botón Ver Recibo (si tiene anticipo o contrato) */}
                        {depAmount > 0 && (
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
                                  documentType: "RECEIPT",
                                });
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-surface-container border border-emerald-500/30 text-emerald-300 px-2 py-1 text-[11px] font-bold hover:bg-emerald-500/10 transition cursor-pointer"
                            title="Ver Recibo Oficial de Anticipo"
                          >
                            <span>🧾</span>
                            <span>Recibo</span>
                          </button>
                        )}

                        {/* Botón Ver Contrato */}
                        {isConf && (
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
                                  documentType: "CONTRACT",
                                });
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-surface-container border border-purple-500/30 text-purple-300 px-2 py-1 text-[11px] font-bold hover:bg-purple-500/10 transition cursor-pointer"
                            title="Ver Contrato Oficial"
                          >
                            <span>📑</span>
                            <span>Contrato</span>
                          </button>
                        )}

                        {/* Botón Ver PDF Cotización */}
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
                                documentType: "QUOTE",
                              });
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-surface-container border border-outline-variant px-2 py-1 text-[11px] font-bold text-on-surface hover:bg-surface-container-high transition cursor-pointer"
                          title="Ver e imprimir Cotización"
                        >
                          <PrinterIcon className="h-3 w-3" />
                          <span>PDF</span>
                        </button>

                        {/* Botón Copiar Enlace Web */}
                        <button
                          onClick={async () => {
                            const folio = isConf ? q.metadata?.contractFolio || q.code : q.code;
                            const url = `${window.location.origin}/tequilitros/cotizacion/${encodeURIComponent(folio)}`;
                            try {
                              await navigator.clipboard.writeText(url);
                              setCopiedQuoteId(q.id);
                              setTimeout(() => setCopiedQuoteId(null), 2000);
                            } catch {
                              // fallback
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-surface-container border border-outline-variant px-2 py-1 text-[11px] font-bold text-on-surface hover:bg-surface-container-high transition cursor-pointer"
                          title="Copiar enlace web de cotización para el cliente"
                        >
                          {copiedQuoteId === q.id ? (
                            <>
                              <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                              <span className="text-emerald-400">¡Copiado!</span>
                            </>
                          ) : (
                            <>
                              <svg className="h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                              </svg>
                              <span>Link</span>
                            </>
                          )}
                        </button>

                        {/* Ver en nueva pestaña */}
                        <a
                          href={`/tequilitros/cotizacion/${encodeURIComponent(isConf ? q.metadata?.contractFolio || q.code : q.code)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded-lg bg-surface-container border border-outline-variant p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition align-middle"
                          title="Abrir página web del cliente"
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL PARA CAMBIAR ESTATUS Y REGISTRAR ANTICIPO */}
      {statusModalQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <form
            onSubmit={handleConfirmStatusUpdate}
            className="w-full max-w-lg rounded-2xl border border-outline-variant bg-surface p-6 shadow-2xl text-on-surface space-y-4"
          >
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Control Comercial & Cierre de Venta
                </span>
                <h3 className="text-base font-bold text-on-surface">
                  Actualizar Estatus / Anticipo · {statusModalQuote.code}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setStatusModalQuote(null)}
                className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container transition cursor-pointer"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            {modalError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/15 p-3 text-xs text-red-300 font-semibold">
                {modalError}
              </div>
            )}

            {/* Ficha rápida del cliente y total */}
            <div className="rounded-xl border border-outline-variant bg-surface-container-low p-3 text-xs flex justify-between items-center">
              <div>
                <strong className="text-on-surface">{statusModalQuote.clientName}</strong>
                <p className="text-on-surface-variant text-[11px] mt-0.5">
                  {statusModalQuote.guestCount} personas · {statusModalQuote.location}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase text-on-surface-variant block">Total Presupuestado</span>
                <span className="font-mono text-sm font-black text-on-surface">
                  ${statusModalQuote.saleAmount.toLocaleString("es-MX")} MXN
                </span>
              </div>
            </div>

            {/* Selector de Estatus */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-on-surface">
                Estatus del Evento *
              </label>
              <select
                value={modalStatus}
                onChange={(e) => setModalStatus(e.target.value as QuoteStatus)}
                className="w-full rounded-xl border border-outline-variant bg-surface-container px-3 py-2 text-xs font-semibold text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="CONFIRMED">🟢 Confirmada con Anticipo (Congelar fecha en agenda)</option>
                <option value="APPROVED">🔵 Aprobada por Cliente (Aceptó propuesta, pendiente pago)</option>
                <option value="PENDING">🟡 Pendiente (Enviada, esperando respuesta)</option>
                <option value="REJECTED">🔴 No Aprobada / Rechazada por el cliente</option>
                <option value="CANCELLED">⚫ Cancelada</option>
              </select>
            </div>

            {/* Monto de Anticipo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  Monto del Anticipo Recibido
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-on-surface-variant font-bold">$</span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={modalDepositAmount}
                    onChange={(e) => setModalDepositAmount(Number(e.target.value) || 0)}
                    className="w-full rounded-xl border border-outline-variant bg-surface-container pl-7 pr-3 py-2 text-xs font-mono font-bold text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex gap-1 mt-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setModalDepositAmount(Math.round(statusModalQuote.saleAmount * 0.5))}
                    className="text-primary hover:underline font-semibold"
                  >
                    50% (${Math.round(statusModalQuote.saleAmount * 0.5).toLocaleString("es-MX")})
                  </button>
                  <span className="text-on-surface-variant">·</span>
                  <button
                    type="button"
                    onClick={() => setModalDepositAmount(statusModalQuote.saleAmount)}
                    className="text-primary hover:underline font-semibold"
                  >
                    100% (${statusModalQuote.saleAmount.toLocaleString("es-MX")})
                  </button>
                </div>
              </div>

              {/* Fecha de Pago del Anticipo */}
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  Fecha en que Pagaron el Anticipo
                </label>
                <input
                  type="date"
                  value={modalDepositDate}
                  onChange={(e) => setModalDepositDate(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant bg-surface-container px-3 py-2 text-xs font-semibold text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Forma de Pago */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-on-surface">
                Método de Pago
              </label>
              <select
                value={modalDepositMethod}
                onChange={(e) => setModalDepositMethod(e.target.value)}
                className="w-full rounded-xl border border-outline-variant bg-surface-container px-3 py-2 text-xs font-semibold text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="Efectivo en Sucursal">Efectivo en Sucursal</option>
                <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                <option value="Depósito en OXXO / Banco">Depósito en OXXO / Banco</option>
                <option value="Otro">Otro medio</option>
              </select>
            </div>

            {/* Notas opcionales */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-on-surface">
                Notas y Acuerdos (se incluirán en el recibo/contrato)
              </label>
              <input
                type="text"
                value={modalNotes}
                onChange={(e) => setModalNotes(e.target.value)}
                placeholder="Ej. Anticipo recibido en matriz Colotlán. Saldo se liquidará en efectivo al inicio."
                className="w-full rounded-xl border border-outline-variant bg-surface-container px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant">
              <button
                type="button"
                onClick={() => setStatusModalQuote(null)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={submittingStatus}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {submittingStatus ? (
                  <span>Guardando...</span>
                ) : (
                  <>
                    <CheckIcon className="h-4 w-4" />
                    <span>Guardar y Ver Recibo/Contrato</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DE VISUALIZACIÓN / IMPRESIÓN DEL DOCUMENTO (COTIZACIÓN, RECIBO O CONTRATO) */}
      {selectedDoc && (
        <QuoteDocumentModal
          isOpen={true}
          onClose={() => setSelectedDoc(null)}
          documentType={selectedDoc.documentType}
          data={{
            code: selectedDoc.code,
            clientName: selectedDoc.clientName,
            clientPhone: selectedDoc.clientPhone,
            clientEmail: selectedDoc.clientEmail,
            location: selectedDoc.location,
            eventDate: selectedDoc.eventDate,
            guestCount: selectedDoc.guestCount,
            saleAmount: selectedDoc.saleAmount,
            metadata: selectedDoc.metadata,
          }}
          onUpdateMetadata={(newMeta) => {
            // Sincronizar actualización con la tabla en memoria
            setQuotesList((prev) =>
              prev.map((item) => {
                if (item.code === selectedDoc.code || item.id === selectedDoc.code) {
                  return {
                    ...item,
                    status: newMeta.status || item.status,
                    isConfirmed: Boolean(newMeta.isContractConfirmed || newMeta.status === "CONFIRMED"),
                    metadata: newMeta,
                  };
                }
                return item;
              })
            );
          }}
        />
      )}
    </div>
  );
}
