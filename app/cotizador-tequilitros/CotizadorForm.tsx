"use client";

import { useState, useMemo } from "react";
import {
  VIATICOS_OPTIONS,
  DRINKS_CATALOG,
  EVENT_TYPES,
  CONSUMO_PRICES_CATALOG,
  type TequilitrosQuoteMetadata,
} from "@/lib/tequilitros/quote-types";
import { createQuoteAction } from "./actions";
import QuoteDocumentModal from "./QuoteDocumentModal";
import {
  AlertIcon,
  CheckIcon,
  PartyIcon,
  PrinterIcon,
} from "@/components/ui/icons";

interface CotizadorFormProps {
  currentUser: {
    id: string;
    name: string;
    role: string;
  };
  branches: Array<{ id: string; name: string }>;
  initialAvailabilityMap?: Record<string, { confirmedCount: number; pendingCount: number }>;
}

export default function CotizadorForm({
  currentUser,
  branches,
  initialAvailabilityMap = {},
}: CotizadorFormProps) {
  // Form State
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [eventType, setEventType] = useState("Boda");
  const [dateStr, setDateStr] = useState("");
  const [location, setLocation] = useState("");
  const [viaticosId, setViaticosId] = useState<string>("colotlan");
  const [guestCount, setGuestCount] = useState<number>(100);
  const [durationHours, setDurationHours] = useState<number>(4);
  const [modality, setModality] = useState<"libre" | "consumo">("libre");
  const [selectedDrinks, setSelectedDrinks] = useState<string[]>([
    "Cantarito",
    "Paloma",
    "Vampiro",
  ]);
  const [branchName, setBranchName] = useState(
    branches[0]?.name || "Canoas"
  );
  const [specialNotes, setSpecialNotes] = useState("");
  const [showPriceList, setShowPriceList] = useState(false);

  // Loading & Submission State
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState<{
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

  // Viático seleccionado
  const selectedViatico = useMemo(
    () => VIATICOS_OPTIONS.find((v) => v.id === viaticosId) ?? VIATICOS_OPTIONS[0],
    [viaticosId]
  );

  // Cálculos matemáticos
  const isConsumo = modality === "consumo";
  const extraHours = Math.max(0, durationHours - 4);
  const pricePerGuest = isConsumo ? 0 : 90;
  const extraHoursCost = !isConsumo ? extraHours * (guestCount * 20) : 0;
  const atencionCost = durationHours * 250;

  const baseServiceCost = !isConsumo
    ? guestCount * pricePerGuest
    : atencionCost;

  const totalAmount = !isConsumo
    ? baseServiceCost + extraHoursCost + selectedViatico.cost
    : atencionCost + selectedViatico.cost;

  // En barra a consumo: se congelan horas + viáticos para apartar (ej. $1,500 MXN)
  const depositRequired = !isConsumo
    ? Math.round(totalAmount * 0.5)
    : totalAmount;

  const balanceRemaining = !isConsumo ? totalAmount - depositRequired : 0;

  // Chequeo de disponibilidad en la fecha seleccionada
  const dateAvailability = useMemo(() => {
    if (!dateStr) return null;
    const info = initialAvailabilityMap[dateStr] ?? { confirmedCount: 0, pendingCount: 0 };
    if (info.confirmedCount >= 3) {
      return {
        status: "RED" as const,
        label: "Capacidad Máxima Alcanzada (3 eventos confirmados)",
        desc: "Ya no se pueden agendar más barras móviles para esta fecha.",
      };
    }
    if (info.pendingCount > 0) {
      return {
        status: "YELLOW" as const,
        label: `Fecha Tentativa (${info.pendingCount} cotización${info.pendingCount > 1 ? "es" : ""} en proceso)`,
        desc: "Existen cotizaciones pendientes para este día. Recomienda al cliente apartar pronto.",
      };
    }
    return {
      status: "GREEN" as const,
      label: "Fecha Disponible",
      desc: "Agenda libre para reservar servicio de barra.",
    };
  }, [dateStr, initialAvailabilityMap]);

  function toggleDrink(drink: string) {
    setSelectedDrinks((prev) =>
      prev.includes(drink) ? prev.filter((d) => d !== drink) : [...prev, drink]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!clientName.trim()) {
      setErrorMsg("Ingresa el nombre del cliente.");
      return;
    }
    if (!clientPhone.trim()) {
      setErrorMsg("Ingresa el teléfono o WhatsApp del cliente.");
      return;
    }
    if (!dateStr) {
      setErrorMsg("Selecciona la fecha del evento.");
      return;
    }
    if (guestCount < 1) {
      setErrorMsg("Ingresa un número válido de personas.");
      return;
    }

    setLoading(true);
    try {
      const result = await createQuoteAction({
        clientName,
        clientPhone,
        clientEmail,
        eventType,
        dateStr,
        location: location || selectedViatico.label,
        guestCount,
        durationHours,
        modality,
        selectedDrinks,
        viaticosId: selectedViatico.id,
        viaticosZone: selectedViatico.label,
        viaticosCost: selectedViatico.cost,
        specialNotes,
        branchName,
      });

      if (!result.success || !result.metadata) {
        setErrorMsg(result.error || "No se pudo generar la cotización.");
        return;
      }

      setGeneratedDoc({
        code: result.code || "COT-NUEVA",
        clientName: clientName.trim(),
        clientPhone,
        clientEmail,
        location: location || selectedViatico.label,
        eventDate: new Date(`${dateStr}T12:00:00Z`).toISOString(),
        guestCount,
        saleAmount: totalAmount,
        metadata: result.metadata,
      });

      setModalOpen(true);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error inesperado al generar cotización.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-outline-variant pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 text-primary">
              <PartyIcon className="h-4 w-4" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-on-surface">
              Cotizador de Barras Tequilitros
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-on-surface-variant">
            Herramienta para empleados y sucursales. Genera cotizaciones precisas, PDF formal y contratos en segundos.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-on-surface-variant bg-surface-container px-3 py-1.5 rounded-lg border border-outline-variant">
          <span>Atendido por:</span>
          <strong className="text-on-surface">{currentUser.name}</strong>
          <span className="text-primary font-semibold">({branchName})</span>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-error/15 border border-error/30 p-4 text-xs sm:text-sm text-error">
          <AlertIcon className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Grid: Formulario a la izquierda + Resumen a la derecha */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Datos del Evento */}
        <div className="lg:col-span-7 space-y-5 rounded-2xl border border-outline-variant bg-surface-container-low p-5 sm:p-7 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wider text-primary border-b border-outline-variant pb-2">
            1. Datos del Cliente y Sede
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Nombre del Cliente *
              </label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ej. María Fernanda González"
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Teléfono / WhatsApp *
              </label>
              <input
                type="tel"
                required
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="Ej. 331 234 5678"
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Correo Electrónico (opcional)
              </label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="cliente@ejemplo.com"
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Tipo de Evento
              </label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Fecha del Evento *
              </label>
              <input
                type="date"
                required
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
              />

              {/* Semáforo de disponibilidad debajo de la fecha */}
              {dateAvailability && (
                <div
                  className={`mt-2 p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                    dateAvailability.status === "RED"
                      ? "bg-red-500/15 border-red-500/30 text-red-400"
                      : dateAvailability.status === "YELLOW"
                      ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                      : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                  }`}
                >
                  <span
                    className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                      dateAvailability.status === "RED"
                        ? "bg-red-500"
                        : dateAvailability.status === "YELLOW"
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                  />
                  <div>
                    <p className="font-bold">{dateAvailability.label}</p>
                    <p className="text-[11px] opacity-90">{dateAvailability.desc}</p>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Sucursal Emisora
              </label>
              <select
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
              >
                {branches.length > 0 ? (
                  branches.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Canoas">Sucursal Canoas</option>
                    <option value="Colotlán Matriz">Colotlán Matriz</option>
                    <option value="Planta">Planta Principal</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Lugar / Salón / Dirección
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ej. Hacienda Las Palmas, Colotlán"
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Zona de Viáticos
              </label>
              <select
                value={viaticosId}
                onChange={(e) => setViaticosId(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
              >
                {VIATICOS_OPTIONS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <h2 className="text-sm font-bold uppercase tracking-wider text-primary border-b border-outline-variant pt-4 pb-2">
            2. Configuración del Servicio de Barra
          </h2>

          {/* Modalidad de Servicio */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setModality("libre")}
              className={`p-3 rounded-xl border text-left transition ${
                modality === "libre"
                  ? "border-primary bg-primary/10 text-on-surface"
                  : "border-outline-variant bg-surface text-on-surface-variant hover:border-outline"
              }`}
            >
              <p className="font-bold text-xs sm:text-sm">Barra Libre</p>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                $90 MXN / persona · 4 horas continuas
              </p>
            </button>

            <button
              type="button"
              onClick={() => setModality("consumo")}
              className={`p-3 rounded-xl border text-left transition ${
                modality === "consumo"
                  ? "border-primary bg-primary/10 text-on-surface"
                  : "border-outline-variant bg-surface text-on-surface-variant hover:border-outline"
              }`}
            >
              <p className="font-bold text-xs sm:text-sm">Barra a Consumo</p>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                $250/hr atención + viáticos para apartar · Producto liquidable en evento
              </p>
            </button>
          </div>

          {/* Cantidad de Invitados con Alerta de Aforo Total */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-on-surface">
                {isConsumo ? "Asistentes Estimados (Referencial)" : "Número de Invitados (Aforo Total) *"}
              </label>
              <span className="font-mono text-base font-bold text-primary">
                {guestCount} personas
              </span>
            </div>

            <input
              type="range"
              min="40"
              max="500"
              step="5"
              value={guestCount}
              onChange={(e) => setGuestCount(Number(e.target.value))}
              className="w-full accent-primary"
            />

            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={guestCount}
                onChange={(e) => setGuestCount(Math.max(1, Number(e.target.value)))}
                className="w-28 rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-xs font-mono text-on-surface"
              />
              <span className="text-xs text-on-surface-variant">
                (Ajuste manual directo)
              </span>
            </div>

            {/* NOTA CLAVE DE NEGOCIO */}
            <div className="rounded-lg bg-surface-container p-2.5 text-[11px] leading-relaxed text-on-surface-variant border border-outline-variant">
              {isConsumo ? (
                <>
                  🍸 <strong className="text-on-surface">Barra a Consumo:</strong> En esta modalidad el producto <span className="underline font-semibold">no se cobra por adelantado</span>. Solo se cubren las horas pactadas ($250/hr) y viáticos para apartar y congelar la fecha. El producto que se consuma se liquida al concluir el evento.
                </>
              ) : (
                <>
                  💡 <strong className="text-on-surface">Regla de Aforo Total:</strong> Barra Libre se cotiza por el 100% de asistentes al evento (incluyendo niños y adultos sin excepción), dado que consumen refrescos, jugos, aguas minerales, hielo y cristalería.
                </>
              )}
            </div>
          </div>

          {/* Duración de Horas */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-on-surface">
                Horas de Servicio
              </label>
              <span className="font-mono text-sm font-bold text-primary">
                {durationHours} horas {extraHours > 0 && `(+${extraHours} hr extra)`}
              </span>
            </div>

            <input
              type="range"
              min="4"
              max="10"
              step="1"
              value={durationHours}
              onChange={(e) => setDurationHours(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          {/* Bebidas incluidas */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-on-surface">
              Bebidas y Cócteles sugeridos en la Barra
            </label>
            <div className="flex flex-wrap gap-2">
              {DRINKS_CATALOG.map((drink) => {
                const active = selectedDrinks.includes(drink);
                return (
                  <button
                    key={drink}
                    type="button"
                    onClick={() => toggleDrink(drink)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                      active
                        ? "bg-primary/20 border-primary text-primary font-bold"
                        : "bg-surface border-outline-variant text-on-surface-variant hover:border-outline"
                    }`}
                  >
                    {active && "✓ "} {drink}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notas especiales */}
          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              Notas adicionales o condiciones especiales
            </label>
            <textarea
              rows={2}
              value={specialNotes}
              onChange={(e) => setSpecialNotes(e.target.value)}
              placeholder="Ej. Requieren montaje a las 4:00 PM, agregar centros de mesa..."
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-xs text-on-surface focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Columna Derecha: Tarjeta de Desglose y Presupuesto en Vivo */}
        <div className="lg:col-span-5 space-y-5 rounded-2xl border border-outline-variant bg-surface-container p-5 sm:p-7 shadow-sm sticky top-20">
          <div className="flex items-center justify-between border-b border-outline-variant pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Presupuesto en Tiempo Real
            </span>
            <span className="text-xs text-on-surface-variant">
              {guestCount} pers · {durationHours} hrs
            </span>
          </div>

          {/* Desglose de conceptos */}
          <div className="space-y-2.5 text-xs">
            {isConsumo ? (
              <>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">
                    Atención de Barra ({durationHours} hrs × $250/hr):
                  </span>
                  <span className="font-mono font-semibold text-on-surface">
                    ${atencionCost.toLocaleString("es-MX")} MXN
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-on-surface-variant">
                    Viáticos ({selectedViatico.label.split("(")[0]}):
                  </span>
                  <span className="font-mono font-semibold text-on-surface">
                    +${selectedViatico.cost.toLocaleString("es-MX")} MXN
                  </span>
                </div>

                <div className="border-t border-outline-variant pt-3 space-y-1">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm font-bold text-on-surface">Total Fijo para Congelar:</span>
                    <span className="font-mono text-2xl font-black text-primary">
                      ${totalAmount.toLocaleString("es-MX")} <span className="text-xs font-normal">MXN</span>
                    </span>
                  </div>
                </div>

                {/* Anticipo para apartar */}
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-1">
                  <div className="flex justify-between text-xs font-bold text-emerald-400">
                    <span>Monto para Congelar Fecha:</span>
                    <span className="font-mono text-sm">
                      ${depositRequired.toLocaleString("es-MX")} MXN
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-emerald-400/80">
                    <span>Saldo de atención y viáticos:</span>
                    <span className="font-mono">$0 MXN (100% cubierto)</span>
                  </div>
                </div>

                {/* Producto a Consumo */}
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-amber-400">
                    <span>🍸 Producto Consumido:</span>
                    <span>A liquidar en evento</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    No se cobra por adelantado. Se contabiliza y paga al finalizar el evento conforme a la lista oficial.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowPriceList((prev) => !prev)}
                    className="text-xs font-bold text-primary hover:underline cursor-pointer block pt-1"
                  >
                    {showPriceList ? "Ocultar catálogo de precios ▲" : "Ver catálogo de precios por producto ▼"}
                  </button>
                </div>

                {showPriceList && (
                  <div className="rounded-xl border border-outline-variant bg-surface-container-low p-3 space-y-2 text-xs max-h-56 overflow-y-auto">
                    <p className="font-bold text-[11px] uppercase tracking-wider text-on-surface">
                      Tarifario Oficial por Producto:
                    </p>
                    <div className="space-y-1 text-[11px]">
                      {CONSUMO_PRICES_CATALOG.map((p, idx) => (
                        <div key={idx} className="flex justify-between border-b border-outline-variant/30 py-0.5">
                          <span className="text-on-surface-variant">{p.item}</span>
                          <span className="font-mono font-bold text-on-surface">
                            ${p.price} <span className="text-[10px] font-normal text-on-surface-variant">/{p.unit}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">
                    Barra Libre (base 4 hrs):
                  </span>
                  <span className="font-mono font-semibold text-on-surface">
                    ${baseServiceCost.toLocaleString("es-MX")} MXN
                  </span>
                </div>

                {extraHours > 0 && (
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">
                      Horas Extra ({extraHours} hr{extraHours > 1 ? "s" : ""}):
                    </span>
                    <span className="font-mono font-semibold text-on-surface">
                      +${extraHoursCost.toLocaleString("es-MX")} MXN
                    </span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-on-surface-variant">
                    Viáticos ({selectedViatico.label.split("(")[0]}):
                  </span>
                  <span className="font-mono font-semibold text-on-surface">
                    +${selectedViatico.cost.toLocaleString("es-MX")} MXN
                  </span>
                </div>

                <div className="border-t border-outline-variant pt-3 space-y-1">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm font-bold text-on-surface">Total Inversión:</span>
                    <span className="font-mono text-2xl font-black text-primary">
                      ${totalAmount.toLocaleString("es-MX")} <span className="text-xs font-normal">MXN</span>
                    </span>
                  </div>
                </div>

                {/* Anticipo del 50% */}
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-1">
                  <div className="flex justify-between text-xs font-bold text-emerald-400">
                    <span>Anticipo para Apartar (50%):</span>
                    <span className="font-mono text-sm">
                      ${depositRequired.toLocaleString("es-MX")} MXN
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-emerald-400/80">
                    <span>Saldo el día del evento:</span>
                    <span className="font-mono">${balanceRemaining.toLocaleString("es-MX")} MXN</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Reglas de contratación clave */}
          <div className="rounded-xl bg-surface-container-low p-3 border border-outline-variant text-[11px] space-y-1 text-on-surface-variant">
            <p className="font-semibold text-on-surface">Condiciones para Congelar Fecha:</p>
            <p>• 50% de anticipo (estrictamente no reembolsable).</p>
            <p>• La reserva oficial se coordina por WhatsApp Tequilitros (+52 56 6298 9202).</p>
            <p>• Cambios de fecha con 15 días y sujetos a disponibilidad mutua.</p>
          </div>

          {/* Botón de Generar Cotización */}
          <button
            type="submit"
            disabled={loading || dateAvailability?.status === "RED"}
            className="w-full rounded-xl bg-primary py-3.5 px-4 font-bold text-sm text-on-primary hover:opacity-90 disabled:opacity-50 transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <span>Generando Cotización...</span>
            ) : (
              <>
                <PrinterIcon className="h-4 w-4" />
                <span>Generar Cotización y Crear PDF</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Modal con el PDF / Documento oficial */}
      {generatedDoc && (
        <QuoteDocumentModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          documentType="QUOTE"
          data={generatedDoc}
        />
      )}
    </div>
  );
}
