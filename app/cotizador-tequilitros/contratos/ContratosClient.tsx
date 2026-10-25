"use client";

import { useState } from "react";
import { type TequilitrosQuoteMetadata } from "@/lib/tequilitros/quote-types";
import QuoteDocumentModal from "../QuoteDocumentModal";
import {
  PrinterIcon,
  SearchIcon,
  CheckIcon,
  ClipboardIcon,
} from "@/components/ui/icons";

interface ContractItem {
  id: string;
  code: string;
  clientName: string;
  clientPhone?: string | null;
  location: string;
  eventDate: string;
  guestCount: number;
  saleAmount: number;
  metadata: TequilitrosQuoteMetadata | null;
}

interface ContratosClientProps {
  contracts: ContractItem[];
}

export default function ContratosClient({ contracts }: ContratosClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContract, setSelectedContract] = useState<{
    code: string;
    clientName: string;
    clientPhone?: string | null;
    clientEmail?: string | null;
    location: string;
    eventDate: string;
    guestCount: number;
    saleAmount: number;
    metadata: TequilitrosQuoteMetadata;
  } | null>(null);

  // Estadísticas de contratos
  const totalContracts = contracts.length;
  const totalAnticipos = contracts.reduce(
    (sum, c) => sum + (c.metadata?.depositPaid ?? Math.round(c.saleAmount * 0.5)),
    0
  );
  const totalSaldosPorCobrar = contracts.reduce((sum, c) => {
    const dep = c.metadata?.depositPaid ?? Math.round(c.saleAmount * 0.5);
    return sum + (c.saleAmount - dep);
  }, 0);

  const filtered = contracts.filter((c) => {
    const meta = c.metadata;
    const term = searchTerm.toLowerCase();
    return (
      c.clientName.toLowerCase().includes(term) ||
      c.code.toLowerCase().includes(term) ||
      (meta?.contractFolio || "").toLowerCase().includes(term) ||
      c.location.toLowerCase().includes(term)
    );
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Encabezado */}
      <div className="border-b border-outline-variant pb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400">
            <ClipboardIcon className="h-4 w-4" />
          </span>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-on-surface">
            Recibos Oficiales y Contratos de Servicio
          </h1>
        </div>
        <p className="mt-1 text-xs sm:text-sm text-on-surface-variant">
          Control de eventos con anticipo recibido del 50%, folios contractuales y políticas de servicio blindadas.
        </p>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
          <p className="text-xs text-on-surface-variant font-medium">Contratos Formalizados</p>
          <p className="text-2xl font-black text-on-surface mt-1 font-mono">{totalContracts}</p>
          <p className="text-[11px] text-on-surface-variant mt-0.5">Fechas bloqueadas en agenda</p>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-xs text-emerald-400 font-medium">Anticipos Recibidos (50%)</p>
          <p className="text-2xl font-black text-emerald-400 mt-1 font-mono">
            ${totalAnticipos.toLocaleString("es-MX")} <span className="text-xs font-normal">MXN</span>
          </p>
          <p className="text-[11px] text-emerald-400/80 mt-0.5">Ingresados en sucursales o transferencias</p>
        </div>

        <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
          <p className="text-xs text-on-surface-variant font-medium">Saldos Pendientes de Cobro</p>
          <p className="text-2xl font-black text-primary mt-1 font-mono">
            ${totalSaldosPorCobrar.toLocaleString("es-MX")} <span className="text-xs font-normal">MXN</span>
          </p>
          <p className="text-[11px] text-on-surface-variant mt-0.5">A liquidar el día del evento</p>
        </div>
      </div>

      {/* Buscador */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-on-surface-variant" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, folio o contrato..."
            className="w-full rounded-xl border border-outline-variant bg-surface-container py-2 pl-9 pr-3 text-xs text-on-surface focus:border-primary focus:outline-none"
          />
        </div>

        <span className="text-xs text-on-surface-variant self-end sm:self-auto">
          Mostrando {filtered.length} contrato{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Tabla de contratos */}
      <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container-low shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-container border-b border-outline-variant text-on-surface-variant">
            <tr>
              <th className="py-3 px-4 font-bold">Folio Contrato</th>
              <th className="py-3 px-4 font-bold">Cliente</th>
              <th className="py-3 px-4 font-bold">Fecha del Evento</th>
              <th className="py-3 px-4 font-bold text-right">Inversión Total</th>
              <th className="py-3 px-4 font-bold text-right">Anticipo Recibido</th>
              <th className="py-3 px-4 font-bold text-right">Saldo por Cobrar</th>
              <th className="py-3 px-4 font-bold">Cobrado en</th>
              <th className="py-3 px-4 font-bold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-on-surface-variant italic">
                  No se encontraron contratos emitidos aún. Los contratos se generan al registrar el anticipo de una cotización.
                </td>
              </tr>
            ) : (
              filtered.map((c) => {
                const meta = c.metadata;
                const contractFolio = meta?.contractFolio || `CTR-${c.code}`;
                const depositPaid = meta?.depositPaid ?? Math.round(c.saleAmount * 0.5);
                const saldo = c.saleAmount - depositPaid;
                const formattedEventDate = new Date(c.eventDate).toLocaleDateString("es-MX", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  timeZone: "UTC",
                });

                return (
                  <tr key={c.id} className="hover:bg-surface-container/50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-purple-400">
                      {contractFolio}
                    </td>

                    <td className="py-3 px-4">
                      <p className="font-semibold text-on-surface">{c.clientName}</p>
                      {c.clientPhone && (
                        <p className="text-[11px] text-on-surface-variant">{c.clientPhone}</p>
                      )}
                    </td>

                    <td className="py-3 px-4 font-medium text-on-surface">
                      📅 {formattedEventDate}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-on-surface">
                      ${c.saleAmount.toLocaleString("es-MX")}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                      ${depositPaid.toLocaleString("es-MX")}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-primary">
                      ${saldo.toLocaleString("es-MX")}
                    </td>

                    <td className="py-3 px-4">
                      <p className="font-medium text-on-surface">
                        {meta?.depositMethod || "Efectivo"}
                      </p>
                      <p className="text-[10px] text-on-surface-variant">
                        {meta?.depositBranchName || meta?.branchName || "Sucursal"}
                      </p>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          if (meta) {
                            setSelectedContract({
                              code: c.code,
                              clientName: c.clientName,
                              clientPhone: c.clientPhone,
                              clientEmail: meta.clientEmail,
                              location: c.location,
                              eventDate: c.eventDate,
                              guestCount: c.guestCount,
                              saleAmount: c.saleAmount,
                              metadata: meta,
                            });
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1 text-[11px] font-bold text-on-primary hover:opacity-90 transition shadow-sm"
                      >
                        <PrinterIcon className="h-3.5 w-3.5" />
                        <span>Ver Contrato PDF</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal para ver e imprimir Contrato */}
      {selectedContract && (
        <QuoteDocumentModal
          isOpen={Boolean(selectedContract)}
          onClose={() => setSelectedContract(null)}
          documentType="CONTRACT"
          data={selectedContract}
        />
      )}
    </div>
  );
}
