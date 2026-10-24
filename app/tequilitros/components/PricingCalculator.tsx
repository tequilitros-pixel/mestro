"use client";

import { useMemo, useState } from "react";

const WHATSAPP_PHONE = "525662989202";

// Lista oficial de precios por producto en Barra a Consumo (Página 4 del manual)
const CONSUMO_PRICES = [
  { item: "Tequila blanco, 1 L", price: 350, unit: "botella" },
  { item: "Licores de la casa", price: 150, unit: "botella" },
  { item: "Sangría, 1 L", price: 90, unit: "botella" },
  { item: "Peñafiel toronja", price: 30, unit: "pieza" },
  { item: "Agua mineral", price: 28, unit: "pieza" },
  { item: "Jugo de toronja", price: 75, unit: "litro" },
  { item: "Tampico", price: 45, unit: "litro" },
  { item: "Limón exprimido", price: 60, unit: "litro" },
  { item: "Hielo, bolsa de 5 kg", price: 20, unit: "bolsa" },
  { item: "Vasos 32 oz (Reyma)", price: 70, unit: "paq. 25 pzas" },
  { item: "Servilletas", price: 55, unit: "paquete" },
  { item: "Popotes", price: 60, unit: "por kg" },
  { item: "Sal", price: 20, unit: "por kg" },
  { item: "Chile limón", price: 60, unit: "bote" },
  { item: "Madrileña", price: 90, unit: "botella" },
  { item: "Clamato", price: 50, unit: "botella" },
  { item: "Salsas de la casa", price: 100, unit: "por lote" },
  { item: "Tequimiche especial", price: 100, unit: "por lote" },
];

const VIATICOS_OPCIONES = [
  { id: "colotlan", label: "Colotlán y alrededores cercanos", cost: 0 },
  { id: "tlaltenango", label: "Tlaltenango, Jerez, Santa María ($500)", cost: 500 },
  { id: "zacatecas", label: "Zacatecas Capital, Fresnillo ($800)", cost: 800 },
  { id: "guadalajara", label: "Guadalajara, Zapopan o foráneo ($1,200)", cost: 1200 },
  { id: "otro", label: "Otra localidad (por confirmar)", cost: 0 },
];

export default function PricingCalculator() {
  const [modality, setModality] = useState<"libre" | "consumo">("libre");
  const [guests, setGuests] = useState<number>(150);
  const [hours, setHours] = useState<number>(4);
  const [viaticosId, setViaticosId] = useState<string>("colotlan");
  const [clientName, setClientName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventType, setEventType] = useState("");
  const [specificLocation, setSpecificLocation] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [consumptionBudget, setConsumptionBudget] = useState("");
  const today = new Date();
  const earliestDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const needsConfirmation = viaticosId === "otro" || (modality === "libre" && hours > 4);
  const [showPriceList, setShowPriceList] = useState<boolean>(false);

  const selectedViatico = useMemo(
    () => VIATICOS_OPCIONES.find((v) => v.id === viaticosId) ?? VIATICOS_OPCIONES[0],
    [viaticosId]
  );

  // Cálculos para Barra Libre ($90 MXN / persona · 4 horas)
  const barraLibreBase = guests * 90;
  const barraLibreTotal = barraLibreBase + selectedViatico.cost; // Horas adicionales se cotizan por separado
  const anticipo50 = Math.round(barraLibreTotal * 0.5);
  const saldoFinal = barraLibreTotal - anticipo50;

  // Cálculos para Barra a Consumo ($250 MXN / hora + consumo estimado)
  const atencionBarra = hours * 250;
  // Consumo estimado opcional elegido por el cliente; nunca es cobro garantizado.
  const consumoEstimado = Math.max(0, Number(consumptionBudget) || 0);
  const barraConsumoTotalEstimado = atencionBarra + consumoEstimado + selectedViatico.cost;

  // Cotización compartible con todos los datos sin afirmar precios pendientes.
  const whatsappUrl = useMemo(() => {
    const total = modality === "libre" ? barraLibreTotal : barraConsumoTotalEstimado;
    const details = [
      "Hola, quiero cotizar Tequilitros Eventos:",
      `• Nombre: ${clientName.trim() || "Por confirmar"}`,
      `• Teléfono: ${clientPhone.trim() || "Por confirmar"}`,
      `• Evento: ${eventType || "Por confirmar"}`,
      `• Fecha: ${eventDate || "Por confirmar"}`,
      `• Localidad: ${selectedViatico.label}`,
      `• Dirección / salón: ${specificLocation.trim() || "Por confirmar"}`,
      `• Modalidad: ${modality === "libre" ? "Barra libre" : "Barra a consumo"}`,
      `• Invitados: ${guests}`,
      `• Duración solicitada: ${hours} horas`,
      modality === "libre"
        ? `• Precio base (4 horas): $${barraLibreBase.toLocaleString("es-MX")} MXN`
        : `• Servicio de barra: $${atencionBarra.toLocaleString("es-MX")} MXN`,
      modality === "consumo"
        ? `• Consumo previsto por el cliente (no definitivo): $${consumoEstimado.toLocaleString("es-MX")} MXN`
        : null,
      `• Viáticos referenciales: ${viaticosId === "otro" ? "Por confirmar" : "$" + selectedViatico.cost.toLocaleString("es-MX") + " MXN"}`,
      `• Subtotal estimado, sin cargos pendientes: $${total.toLocaleString("es-MX")} MXN`,
      needsConfirmation ? "• IMPORTANTE: hay conceptos pendientes de cotizar (horas extras y/o traslado)." : null,
      modality === "consumo" ? "• El consumo final se paga según los productos realmente consumidos." : null,
      "¿Me confirman disponibilidad y cotización final?"
    ].filter(Boolean).join("\n");
    return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(details)}`;
  }, [modality,clientName,clientPhone,eventType,eventDate,specificLocation,selectedViatico,guests,hours,barraLibreBase,atencionBarra,consumoEstimado,viaticosId,barraLibreTotal,barraConsumoTotalEstimado,needsConfirmation]);

  return (
    <div className="relative w-full overflow-hidden rounded-3xl border border-[#242E37] bg-gradient-to-b from-[#11171E] via-[#0D1217] to-[#080B0E] p-5 sm:p-8 md:p-10 shadow-2xl">
      {/* Kicker badge */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#242E37] pb-5">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#E28735] animate-pulse" />
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#E28735]">
            Simulador de Presupuesto en Tiempo Real
          </span>
        </div>
        <span className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-1 font-mono text-[11px] font-bold text-[#F5F2EB]">
          Atendemos desde 40 personas
        </span>
      </div>

      {/* Selector de Modalidad (Barra Libre vs Barra a Consumo) */}
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setModality("libre")}
          className={`relative flex flex-col items-start rounded-2xl border p-5 text-left transition-all duration-200 ${
            modality === "libre"
              ? "border-[#E28735] bg-[#E28735]/15 shadow-xl shadow-[#E28735]/10"
              : "border-[#242E37] bg-[#141B22]/60 hover:border-[#384654] hover:bg-[#1A232C]"
          }`}
        >
          <div className="flex w-full items-center justify-between">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#E28735]">
              Modalidad 01 · La Más Pedida
            </span>
            {modality === "libre" && (
              <span className="rounded-full bg-[#E28735] px-2 py-0.5 font-mono text-[10px] font-extrabold text-[#080B0E]">
                ACTIVA
              </span>
            )}
          </div>
          <h3 className="mt-2 font-serif text-2xl font-bold text-[#F5F2EB]">Barra Libre</h3>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-serif text-3xl font-extrabold text-[#E28735] sm:text-4xl">$90</span>
            <span className="font-mono text-xs text-[#9AA5AC]">MXN / persona · 4 horas</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#9AA5AC]">
            Tus invitados toman sin límite durante el horario contratado. Costo 100% predecible para bodas y graduaciones.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setModality("consumo")}
          className={`relative flex flex-col items-start rounded-2xl border p-5 text-left transition-all duration-200 ${
            modality === "consumo"
              ? "border-[#D4AF37] bg-[#D4AF37]/15 shadow-xl shadow-[#D4AF37]/10"
              : "border-[#242E37] bg-[#141B22]/60 hover:border-[#384654] hover:bg-[#1A232C]"
          }`}
        >
          <div className="flex w-full items-center justify-between">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#D4AF37]">
              Modalidad 02 · Pago Exacto
            </span>
            {modality === "consumo" && (
              <span className="rounded-full bg-[#D4AF37] px-2 py-0.5 font-mono text-[10px] font-extrabold text-[#080B0E]">
                ACTIVA
              </span>
            )}
          </div>
          <h3 className="mt-2 font-serif text-2xl font-bold text-[#F5F2EB]">Barra a Consumo</h3>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-serif text-3xl font-extrabold text-[#D4AF37] sm:text-4xl">$250</span>
            <span className="font-mono text-xs text-[#9AA5AC]">MXN / hora + producto consumido</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#9AA5AC]">
            Solo se paga lo que realmente se toma. Al final del evento se hace el conteo botella por botella y vaso por vaso.
          </p>
        </button>
      </div>

      {/* Controles Interactivos (Sliders e Inputs) */}
      <div className="grid grid-cols-1 gap-6 rounded-2xl border border-[#242E37] bg-[#0E1318]/80 p-5 sm:p-6 lg:grid-cols-3">
        {/* Número de Invitados */}
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="guestSlider" className="font-mono text-xs font-bold uppercase text-[#F5F2EB]">
              Número de Invitados
            </label>
            <span className="font-mono text-base font-extrabold text-[#E28735]">
              {guests} personas
            </span>
          </div>
          <input
            id="guestSlider"
            type="range"
            min={40}
            max={500}
            step={5}
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
            className="mt-3 w-full accent-[#E28735] cursor-pointer"
          />
          <div className="mt-1 flex justify-between font-mono text-[10px] text-[#717F8A]">
            <span>Min. 40</span>
            <span>150 (Estándar)</span>
            <span>500+</span>
          </div>
        </div>

        {/* Horas de Servicio */}
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="hoursSelect" className="font-mono text-xs font-bold uppercase text-[#F5F2EB]">
              Horas de Barra
            </label>
            <span className="font-mono text-base font-extrabold text-[#D4AF37]">
              {hours} horas
            </span>
          </div>
          <select
            id="hoursSelect"
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="mt-2 w-full rounded-xl border border-[#242E37] bg-[#141B22] p-2.5 font-mono text-xs font-semibold text-[#F5F2EB] focus:border-[#E28735] focus:outline-none"
          >
            <option value={4}>4 horas (Servicio estándar incluido)</option>
            <option value={5}>5 horas (+1 hora adicional)</option>
            <option value={6}>6 horas (+2 horas adicionales)</option>
            <option value={7}>7 horas (+3 horas adicionales)</option>
          </select>
          <p className="mt-1 text-[11px] text-[#717F8A]">
            {hours > 4 ? `${hours - 4} hora(s) adicional(es): precio por confirmar` : "Servicio base de 4 horas"}
          </p>
        </div>

        {/* Ubicación / Viáticos */}
        <div>
          <label htmlFor="viaticosSelect" className="font-mono text-xs font-bold uppercase text-[#F5F2EB]">
            Localidad / Viáticos
          </label>
          <select
            id="viaticosSelect"
            value={viaticosId}
            onChange={(e) => setViaticosId(e.target.value)}
            className="mt-2 w-full rounded-xl border border-[#242E37] bg-[#141B22] p-2.5 font-mono text-xs font-semibold text-[#F5F2EB] focus:border-[#E28735] focus:outline-none"
          >
            {VIATICOS_OPCIONES.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-[#717F8A]">
            {viaticosId === "otro" ? "Traslado por cotizar" : selectedViatico.cost === 0
              ? "Sin costo adicional en zona base"
              : `+${selectedViatico.cost} MXN por traslado`}
          </p>
        </div>
      </div>

      {/* Datos del evento y presupuesto personalizable, en un solo flujo */}
      <div className="mt-6 grid grid-cols-1 gap-4 rounded-2xl border border-[#242E37] bg-[#0E1318]/80 p-5 sm:grid-cols-2 sm:p-6">
        <label className="text-xs font-bold text-[#F5F2EB]">Tu nombre (opcional)
          <input value={clientName} onChange={e=>setClientName(e.target.value)} autoComplete="name" placeholder="Nombre del anfitrión" className="mt-2 w-full rounded-xl border border-[#384654] bg-[#141B22] p-3 text-sm text-white" />
        </label>
        <label className="text-xs font-bold text-[#F5F2EB]">WhatsApp (opcional)
          <input type="tel" value={clientPhone} onChange={e=>setClientPhone(e.target.value)} autoComplete="tel" placeholder="Tu número" className="mt-2 w-full rounded-xl border border-[#384654] bg-[#141B22] p-3 text-sm text-white" />
        </label>
        <label className="text-xs font-bold text-[#F5F2EB]">Fecha del evento
          <input type="date" min={earliestDate} value={eventDate} onChange={e=>setEventDate(e.target.value)} className="mt-2 w-full rounded-xl border border-[#384654] bg-[#141B22] p-3 text-sm text-white" />
        </label>
        <label className="text-xs font-bold text-[#F5F2EB]">Tipo de evento
          <select value={eventType} onChange={e=>setEventType(e.target.value)} className="mt-2 w-full rounded-xl border border-[#384654] bg-[#141B22] p-3 text-sm text-white">
            <option value="">Seleccionar</option>
            {["Boda","XV años","Cumpleaños","Graduación","Fiesta privada","Evento empresarial","Otro"].map(v=><option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-[#F5F2EB] sm:col-span-2">Salón, dirección o municipio específico
          <input value={specificLocation} onChange={e=>setSpecificLocation(e.target.value)} placeholder="Ej. Salón en Colotlán, Jalisco" className="mt-2 w-full rounded-xl border border-[#384654] bg-[#141B22] p-3 text-sm text-white" />
        </label>
        {modality === "consumo" && <label className="text-xs font-bold text-[#F5F2EB] sm:col-span-2">Presupuesto estimado para bebidas e insumos ($ MXN)
          <input type="number" min={0} step={100} value={consumptionBudget} onChange={e=>setConsumptionBudget(e.target.value)} placeholder="Opcional; se cobra el consumo real" className="mt-2 w-full rounded-xl border border-[#384654] bg-[#141B22] p-3 text-sm text-white" />
        </label>}
      </div>

      {/* Tarjeta de Resumen y Desglose Financiero */}
      <div className="mt-8 rounded-2xl border border-[#E28735]/40 bg-[radial-gradient(ellipse_at_top,rgba(226,135,53,0.15),transparent_70%)] p-6 sm:p-8">
        {needsConfirmation && <p className="mb-4 rounded-xl border border-amber-600/50 bg-amber-500/10 p-3 text-xs font-semibold text-amber-200">Presupuesto parcial: {hours > 4 && modality === "libre" ? "las horas extras " : ""}{viaticosId === "otro" ? "y el traslado " : ""}requieren confirmación. No se incluyen importes inventados.</p>}
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#E28735]">
              Presupuesto Estimado · {modality === "libre" ? "Barra Libre" : "Barra a Consumo"}
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-serif text-4xl font-extrabold tracking-tight text-[#F5F2EB] sm:text-5xl">
                ${(modality === "libre" ? barraLibreTotal : barraConsumoTotalEstimado).toLocaleString("es-MX")}
              </span>
              <span className="font-mono text-sm font-semibold text-[#9AA5AC]">MXN</span>
            </div>
            <p className="mt-2 text-xs text-[#9AA5AC] sm:text-sm">
              {modality === "libre" ? (
                <>
                  Para <strong>{guests} personas</strong>. Precio base para 4 horas{hours > 4 ? `; ${hours - 4} hora(s) extra por cotizar` : ""}.
                </>
              ) : (
                <>
                  ${atencionBarra.toLocaleString("es-MX")} de atención + ${consumoEstimado.toLocaleString("es-MX")} de presupuesto opcional de consumo. El consumo real se liquida al final.
                </>
              )}
            </p>
          </div>

          {/* Desglose de Pago (50% Anticipo / 50% Saldo) */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-[#242E37] bg-[#141B22] p-3 text-left">
              <p className="font-mono text-[10px] uppercase text-[#9AA5AC]">Anticipo (sujeto a confirmación)</p>
              <p className="font-mono text-base font-extrabold text-[#30D158]">
                {modality === "libre" && !needsConfirmation ? `${anticipo50.toLocaleString("es-MX")} MXN` : "Por confirmar"}
              </p>
            </div>
            <div className="rounded-xl border border-[#242E37] bg-[#141B22] p-3 text-left">
              <p className="font-mono text-[10px] uppercase text-[#9AA5AC]">Saldo (sujeto a confirmación)</p>
              <p className="font-mono text-base font-extrabold text-[#F5F2EB]">
                {modality === "libre" && !needsConfirmation ? `${saldoFinal.toLocaleString("es-MX")} MXN` : "Por confirmar"}
              </p>
            </div>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E28735] px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-wider text-[#080B0E] transition-all duration-200 hover:bg-[#F59E0B] hover:shadow-lg hover:shadow-[#E28735]/25"
            >
              <span>Solicitar cotización por WhatsApp</span>
              <span className="text-sm">↗</span>
            </a>
          </div>
        </div>

        {/* Desglose de Inclusiones Oficiales */}
        <div className="mt-6 border-t border-[#242E37] pt-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#30D158]">
                ✓ Qué Incluye (En ambas modalidades):
              </p>
              <ul className="mt-2 space-y-1.5 text-xs text-[#D2DAE0]">
                <li className="flex items-center gap-2">
                  <span className="text-[#30D158]">●</span> Personal de preparación (Bartenders)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#30D158]">●</span> Bebidas y tequila artesanal de la casa
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#30D158]">●</span> Mezcladores, hielo ilimitado y vasos 32 oz
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#30D158]">●</span> Insumos completos (fruta del día, sal, salsas y chile)
                </li>
              </ul>
            </div>

            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#FF453A]">
                ✕ Qué No Incluye:
              </p>
              <ul className="mt-2 space-y-1.5 text-xs text-[#9AA5AC]">
                <li className="flex items-center gap-2">
                  <span className="text-[#FF453A]">●</span> Meseros para salón
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#FF453A]">●</span> Servicio en mesas
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#FF453A]">●</span> Distribución de bebidas (los invitados van directo a la barra móvil)
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Botón para Desplegar Lista Oficial de Precios a Consumo */}
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => setShowPriceList(!showPriceList)}
          className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-[#D4AF37] hover:underline"
        >
          <span>{showPriceList ? "Ocultar" : "Ver"} Lista Oficial de Precios por Producto (Barra a Consumo)</span>
          <span>{showPriceList ? "▲" : "▼"}</span>
        </button>

        {showPriceList && (
          <div className="mt-5 rounded-2xl border border-[#242E37] bg-[#0E1318] p-5 text-left animate-in fade-in">
            <div className="mb-4 flex flex-col justify-between gap-2 border-b border-[#242E37] pb-3 sm:flex-row sm:items-center">
              <div>
                <h4 className="font-serif text-lg font-bold text-[#F5F2EB]">
                  Precios Unitarios · Barra a Consumo
                </h4>
                <p className="text-xs text-[#9AA5AC]">
                  Solo se cobra lo que realmente se destapa y se consume. Al terminar tu evento se cuenta frente a ti.
                </p>
              </div>
              <span className="shrink-0 font-mono text-[10px] uppercase text-[#D4AF37]">
                Inventario inicial es solo referencia
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              {CONSUMO_PRICES.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border border-[#242E37] bg-[#141B22]/70 px-3 py-2"
                >
                  <div>
                    <p className="text-xs font-semibold text-[#F5F2EB]">{item.item}</p>
                    <p className="font-mono text-[10px] text-[#717F8A]">{item.unit}</p>
                  </div>
                  <span className="font-mono text-xs font-bold text-[#E28735]">
                    ${item.price} MXN
                  </span>
                </div>
              ))}
            </div>

            {/* Caso de Estudio Real (Páginas 5 y 6 del documento) */}
            <div className="mt-5 rounded-xl border border-[#242E37] bg-[#141B22]/40 p-4">
              <p className="font-mono text-[11px] font-bold uppercase text-[#F5F2EB]">
                Ejemplo Real Comparado (150 personas en Tlaltenango, Zacatecas · 4 horas):
              </p>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                <div className="rounded-lg bg-[#0E1318] p-3 border border-[#E28735]/30">
                  <span className="font-bold text-[#E28735]">Barra Libre (150 pers × $90):</span> $13,500 + $500 viáticos ={" "}
                  <strong className="text-[#F5F2EB]">$14,000 MXN</strong>
                  <p className="mt-1 text-[11px] text-[#9AA5AC]">
                    Costo 100% fijo y predecible. Barra continua sin límite.
                  </p>
                </div>
                <div className="rounded-lg bg-[#0E1318] p-3 border border-[#D4AF37]/30">
                  <span className="font-bold text-[#D4AF37]">Barra a Consumo (conteo final):</span> $11,786 producto + $1,000 atención (4h) + $500 viáticos ={" "}
                  <strong className="text-[#F5F2EB]">$13,286 MXN</strong>
                  <p className="mt-1 text-[11px] text-[#9AA5AC]">
                    Solo se pagó lo que los invitados tomaron en las 4 horas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
