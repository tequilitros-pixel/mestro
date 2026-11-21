"use client";

import { useState, useEffect, useTransition } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  AgaveIcon,
  CoinsIcon,
  CheckIcon,
  FlameIcon,
  PrinterIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { applyAgaveCostToLotAction } from "@/app/costs/actions";

type LotOption = {
  id: string;
  code: string;
  agaveKg: number;
};

type HarvestRecord = {
  id: string;
  savedAt: string;
  ranchoName: string;
  harvestDate: string;
  totalKg: number;
  totalPinadas: number | null;
  gasolineCost: number;
  dieselCost: number;
  foodCost: number;
  oilCost: number;
  payrollCost: number;
  landRentCost: number;
  otherCost: number;
  totalExpenses: number;
  costPerKg: number;
  costPerPina: number | null;
  lotId?: string;
  lotCode?: string;
};

const COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b"];

const tooltipStyle = {
  backgroundColor: "var(--color-surface-container-high, #1e1e1e)",
  border: "1px solid var(--color-outline-variant, #444)",
  borderRadius: "0.75rem",
  color: "var(--color-on-surface, #fff)",
  fontSize: "0.75rem",
};

export default function AgaveCostTabulator({
  lots = [],
}: {
  lots: LotOption[];
}) {
  // Parámetros de cosecha
  const [ranchoName, setRanchoName] = useState("");
  const [harvestDate, setHarvestDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [totalKg, setTotalKg] = useState<number | "">("");
  const [totalPinadas, setTotalPinadas] = useState<number | "">("");
  const [selectedLotId, setSelectedLotId] = useState<string>("");

  // Gastos operativos
  const [gasolineCost, setGasolineCost] = useState<number | "">("");
  const [dieselCost, setDieselCost] = useState<number | "">("");
  const [foodCost, setFoodCost] = useState<number | "">("");
  const [oilCost, setOilCost] = useState<number | "">("");
  const [payrollCost, setPayrollCost] = useState<number | "">("");
  const [landRentCost, setLandRentCost] = useState<number | "">("");
  const [otherCost, setOtherCost] = useState<number | "">("");

  // Ratio de conversión tequila (kg agave / litro)
  const [tequilaYieldKg, setTequilaYieldKg] = useState<number>(7.4);

  // Historial guardado
  const [history, setHistory] = useState<HarvestRecord[]>([]);
  const [isPending, startTransition] = useTransition();
  const [appliedSuccess, setAppliedSuccess] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("maestro_agave_harvest_history");
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch {
      // Ignorar error de acceso a localStorage
    }
  }, []);

  const numKg = Number(totalKg) || 0;
  const numPinadas = Number(totalPinadas) || 0;

  const numGasoline = Number(gasolineCost) || 0;
  const numDiesel = Number(dieselCost) || 0;
  const numFood = Number(foodCost) || 0;
  const numOil = Number(oilCost) || 0;
  const numPayroll = Number(payrollCost) || 0;
  const numLand = Number(landRentCost) || 0;
  const numOther = Number(otherCost) || 0;

  const totalExpenses =
    numGasoline + numDiesel + numFood + numOil + numPayroll + numLand + numOther;

  const costPerKg = numKg > 0 ? totalExpenses / numKg : 0;
  const costPerPina = numPinadas > 0 ? totalExpenses / numPinadas : 0;
  const avgWeightPerPina = numPinadas > 0 && numKg > 0 ? numKg / numPinadas : 0;
  const rawMaterialPerLiterTequila = costPerKg * tequilaYieldKg;

  const chartData = [
    { name: "Gasolina", value: numGasoline },
    { name: "Diesel/Flete", value: numDiesel },
    { name: "Comida/Viáticos", value: numFood },
    { name: "Aceite/Insumos", value: numOil },
    { name: "Nómina Cuadrilla", value: numPayroll },
    { name: "Renta/Planta", value: numLand },
    { name: "Otros", value: numOther },
  ].filter((item) => item.value > 0);

  const handleSaveToHistory = () => {
    if (numKg <= 0 || totalExpenses <= 0) return;

    const record: HarvestRecord = {
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
      ranchoName: ranchoName.trim() || "Predio sin nombre",
      harvestDate,
      totalKg: numKg,
      totalPinadas: numPinadas > 0 ? numPinadas : null,
      gasolineCost: numGasoline,
      dieselCost: numDiesel,
      foodCost: numFood,
      oilCost: numOil,
      payrollCost: numPayroll,
      landRentCost: numLand,
      otherCost: numOther,
      totalExpenses,
      costPerKg,
      costPerPina: costPerPina > 0 ? costPerPina : null,
      lotId: selectedLotId || undefined,
      lotCode: lots.find((l) => l.id === selectedLotId)?.code,
    };

    const updated = [record, ...history.slice(0, 29)];
    setHistory(updated);
    try {
      localStorage.setItem("maestro_agave_harvest_history", JSON.stringify(updated));
    } catch {
      // Ignorar error
    }
  };

  const handleDeleteHistoryItem = (id: string) => {
    const updated = history.filter((h) => h.id !== id);
    setHistory(updated);
    try {
      localStorage.setItem("maestro_agave_harvest_history", JSON.stringify(updated));
    } catch {
      // Ignorar
    }
  };

  const handleApplyToLot = () => {
    if (!selectedLotId || totalExpenses <= 0 || numKg <= 0) return;

    startTransition(async () => {
      const breakdownText = [
        `Nómina jima: $${numPayroll.toLocaleString()}`,
        `Gasolina: $${numGasoline.toLocaleString()}`,
        `Diesel/Flete: $${numDiesel.toLocaleString()}`,
        `Comida: $${numFood.toLocaleString()}`,
        `Aceite/Herramientas: $${numOil.toLocaleString()}`,
        numLand > 0 ? `Renta/Planta: $${numLand.toLocaleString()}` : "",
        numOther > 0 ? `Otros: $${numOther.toLocaleString()}` : "",
      ]
        .filter(Boolean)
        .join(" · ");

      try {
        const result = await applyAgaveCostToLotAction({
          lotId: selectedLotId,
          totalAmount: totalExpenses,
          ranchoName: ranchoName.trim() || undefined,
          totalKg: numKg,
          costPerKg,
          breakdown: breakdownText,
        });

        handleSaveToHistory();
        setAppliedSuccess(`¡Gasto de $${totalExpenses.toLocaleString("es-MX")} aplicado exitosamente al lote ${result.lotCode}!`);
        setTimeout(() => setAppliedSuccess(null), 6000);
      } catch (err: any) {
        alert(err.message || "Error al aplicar gasto al lote.");
      }
    });
  };

  const handleReset = () => {
    setRanchoName("");
    setTotalKg("");
    setTotalPinadas("");
    setSelectedLotId("");
    setGasolineCost("");
    setDieselCost("");
    setFoodCost("");
    setOilCost("");
    setPayrollCost("");
    setLandRentCost("");
    setOtherCost("");
  };

  return (
    <div className="space-y-8">
      {/* Banner Informativo */}
      <section className="rounded-2xl border border-primary/25 bg-primary/[0.05] p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/20 text-primary">
            <AgaveIcon className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-on-surface">Tabulador de Agave Propio Puesto en Fábrica</h2>
            <p className="mt-1 text-xs text-on-surface-variant">
              Registra todos los costos de la quema y jima (combustibles, alimentos, aceite, nómina de cuadrilla y fletes) para obtener el costo real por kilogramo recibido en la destilería.
            </p>
          </div>
        </div>
      </section>

      {appliedSuccess && (
        <div className="flex items-center gap-2 rounded-xl border border-tertiary-fixed-dim/40 bg-tertiary-fixed-dim/10 p-4 text-sm font-semibold text-tertiary-fixed-dim">
          <CheckIcon className="h-5 w-5" />
          <span>{appliedSuccess}</span>
        </div>
      )}

      {/* Grid Principal: Formulario y Resultados */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Columna Izquierda: Formulario de Captura (7 cols) */}
        <section className="space-y-6 lg:col-span-7">
          {/* Bloque 1: Datos de Cosecha */}
          <div className="rounded-2xl border border-outline-variant bg-surface-container p-5 sm:p-6">
            <h3 className="font-bold text-primary">1. Datos de Cosecha y Entrada a Planta</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-semibold text-on-surface-variant">
                Predio / Rancho de procedencia
                <input
                  type="text"
                  placeholder="Ej. Rancho San Antonio"
                  value={ranchoName}
                  onChange={(e) => setRanchoName(e.target.value)}
                  className="rounded-xl border border-outline-variant bg-surface-container-high px-3.5 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
                />
              </label>

              <label className="grid gap-1 text-xs font-semibold text-on-surface-variant">
                Fecha de corte / jima
                <input
                  type="date"
                  value={harvestDate}
                  onChange={(e) => setHarvestDate(e.target.value)}
                  className="rounded-xl border border-outline-variant bg-surface-container-high px-3.5 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
                />
              </label>

              <label className="grid gap-1 text-xs font-semibold text-on-surface-variant">
                Kilogramos de agave en báscula *
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="Ej. 12500"
                  value={totalKg}
                  onChange={(e) => setTotalKg(e.target.value === "" ? "" : Number(e.target.value))}
                  className="rounded-xl border border-outline-variant bg-surface-container-high px-3.5 py-2.5 text-sm font-bold text-on-surface outline-none focus:border-primary"
                />
              </label>

              <label className="grid gap-1 text-xs font-semibold text-on-surface-variant">
                Número de piñas cosechadas (opcional)
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Ej. 350"
                  value={totalPinadas}
                  onChange={(e) => setTotalPinadas(e.target.value === "" ? "" : Number(e.target.value))}
                  className="rounded-xl border border-outline-variant bg-surface-container-high px-3.5 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
                />
              </label>
            </div>

            {/* Asignación a Lote */}
            <div className="mt-4 border-t border-outline-variant/60 pt-4">
              <label className="grid gap-1 text-xs font-semibold text-on-surface-variant">
                Vincular a Lote de Producción (opcional)
                <select
                  value={selectedLotId}
                  onChange={(e) => setSelectedLotId(e.target.value)}
                  className="rounded-xl border border-outline-variant bg-surface-container-high px-3.5 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
                >
                  <option value="">Ninguno (solo tabular costo)</option>
                  {lots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      Lote {lot.code} ({lot.agaveKg.toLocaleString()} kg agave)
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* Bloque 2: Gastos Operativos de Jima */}
          <div className="rounded-2xl border border-outline-variant bg-surface-container p-5 sm:p-6">
            <h3 className="font-bold text-primary">2. Desglose de Gastos de Jima y Flete</h3>
            <p className="mt-1 text-xs text-on-surface-variant">
              Ingresa el costo en pesos ($) de cada insumo o servicio devengado para este corte:
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-semibold text-on-surface-variant">
                👷‍♂️ Nómina de Cuadrilla (Jimadores/Cargadores)
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm text-outline">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={payrollCost}
                    onChange={(e) => setPayrollCost(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-high pl-8 pr-3.5 py-2.5 text-sm font-semibold text-on-surface outline-none focus:border-primary"
                  />
                </div>
              </label>

              <label className="grid gap-1 text-xs font-semibold text-on-surface-variant">
                ⛽ Gasolina (Camionetas / Generador)
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm text-outline">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={gasolineCost}
                    onChange={(e) => setGasolineCost(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-high pl-8 pr-3.5 py-2.5 text-sm font-semibold text-on-surface outline-none focus:border-primary"
                  />
                </div>
              </label>

              <label className="grid gap-1 text-xs font-semibold text-on-surface-variant">
                🚚 Diesel / Flete Camión a Fábrica
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm text-outline">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={dieselCost}
                    onChange={(e) => setDieselCost(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-high pl-8 pr-3.5 py-2.5 text-sm font-semibold text-on-surface outline-none focus:border-primary"
                  />
                </div>
              </label>

              <label className="grid gap-1 text-xs font-semibold text-on-surface-variant">
                🥩 Comida, Aguas y Viáticos
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm text-outline">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={foodCost}
                    onChange={(e) => setFoodCost(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-high pl-8 pr-3.5 py-2.5 text-sm font-semibold text-on-surface outline-none focus:border-primary"
                  />
                </div>
              </label>

              <label className="grid gap-1 text-xs font-semibold text-on-surface-variant">
                ⚙️ Aceite 2T, Coas, Limas y Refacciones
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm text-outline">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={oilCost}
                    onChange={(e) => setOilCost(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-high pl-8 pr-3.5 py-2.5 text-sm font-semibold text-on-surface outline-none focus:border-primary"
                  />
                </div>
              </label>

              <label className="grid gap-1 text-xs font-semibold text-on-surface-variant">
                🌾 Renta de Predio o Planta en Pie (si aplica)
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm text-outline">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={landRentCost}
                    onChange={(e) => setLandRentCost(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-high pl-8 pr-3.5 py-2.5 text-sm font-semibold text-on-surface outline-none focus:border-primary"
                  />
                </div>
              </label>

              <label className="grid gap-1 text-xs font-semibold text-on-surface-variant sm:col-span-2">
                📋 Otros Gastos (Báscula pública, maniobras, etc.)
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm text-outline">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={otherCost}
                    onChange={(e) => setOtherCost(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-high pl-8 pr-3.5 py-2.5 text-sm font-semibold text-on-surface outline-none focus:border-primary"
                  />
                </div>
              </label>
            </div>

            {/* Botones de acción rápida */}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSaveToHistory}
                disabled={numKg <= 0 || totalExpenses <= 0}
                className="rounded-xl border border-outline-variant bg-surface-container-high px-4 py-2.5 text-xs font-bold text-on-surface transition hover:border-primary disabled:opacity-40"
              >
                💾 Guardar en Historial
              </button>

              {selectedLotId && (
                <button
                  type="button"
                  onClick={handleApplyToLot}
                  disabled={isPending || numKg <= 0 || totalExpenses <= 0}
                  className="rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-on-primary transition hover:opacity-90 disabled:opacity-40"
                >
                  {isPending ? "Aplicando al lote..." : "📌 Aplicar Gasto al Lote Seleccionado"}
                </button>
              )}

              <button
                type="button"
                onClick={handleReset}
                className="ml-auto rounded-xl px-3 py-2.5 text-xs text-on-surface-variant transition hover:text-error"
              >
                Limpiar
              </button>
            </div>
          </div>
        </section>

        {/* Columna Derecha: Tarjeta de Resultados y KPIs (5 cols) */}
        <section className="space-y-6 lg:col-span-5">
          {/* Card Principal: Costo por Kg Puesto en Fábrica */}
          <div className="rounded-2xl border-2 border-primary/40 bg-surface-container p-6 shadow-lg">
            <p className="font-mono text-xs uppercase tracking-widest text-primary">
              RESULTADO PUESTO EN DESTILADORA
            </p>

            <div className="mt-3">
              <p className="text-xs text-on-surface-variant">Costo Real por Kilogramo:</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-primary sm:text-5xl">
                  {costPerKg > 0 ? `$${costPerKg.toFixed(2)}` : "$0.00"}
                </span>
                <span className="font-bold text-on-surface-variant">/ kg agave</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 border-t border-outline-variant/60 pt-4">
              <div className="rounded-xl bg-surface-container-high p-3">
                <p className="text-xs text-outline">Gasto Total Cosecha:</p>
                <p className="mt-1 text-lg font-bold text-on-surface">
                  ${totalExpenses.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              <div className="rounded-xl bg-surface-container-high p-3">
                <p className="text-xs text-outline">Kg Totales Recibidos:</p>
                <p className="mt-1 text-lg font-bold text-on-surface">
                  {numKg > 0 ? `${numKg.toLocaleString("es-MX")} kg` : "—"}
                </p>
              </div>

              <div className="rounded-xl bg-surface-container-high p-3">
                <p className="text-xs text-outline">Costo por Piña:</p>
                <p className="mt-1 text-base font-bold text-secondary">
                  {costPerPina > 0 ? `$${costPerPina.toFixed(2)}` : "—"}
                </p>
              </div>

              <div className="rounded-xl bg-surface-container-high p-3">
                <p className="text-xs text-outline">Peso Promedio Piña:</p>
                <p className="mt-1 text-base font-bold text-secondary">
                  {avgWeightPerPina > 0 ? `${avgWeightPerPina.toFixed(1)} kg` : "—"}
                </p>
              </div>
            </div>

            {/* Simulación de Impacto en Tequila */}
            <div className="mt-5 rounded-xl border border-secondary/30 bg-secondary/5 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-secondary">Impacto en Litro de Tequila (40%):</span>
                <span className="font-mono text-xs font-bold text-primary">
                  {tequilaYieldKg.toFixed(1)} kg/L
                </span>
              </div>

              <p className="mt-2 text-2xl font-black text-on-surface">
                {rawMaterialPerLiterTequila > 0 ? `$${rawMaterialPerLiterTequila.toFixed(2)}` : "$0.00"}
                <span className="text-xs font-normal text-on-surface-variant"> / L solo materia prima</span>
              </p>

              <label className="mt-3 block text-[11px] text-on-surface-variant">
                Ajustar rendimiento esperado (kg agave por litro):
                <input
                  type="range"
                  min="6.5"
                  max="10.0"
                  step="0.1"
                  value={tequilaYieldKg}
                  onChange={(e) => setTequilaYieldKg(Number(e.target.value))}
                  className="mt-1 w-full accent-primary"
                />
              </label>
            </div>
          </div>

          {/* Gráfica de Distribución del Gasto */}
          {chartData.length > 0 && (
            <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface">
                Composición del Costo de Jima
              </h4>

              <div className="mt-3 h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {chartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(val: any) => [`$${Number(val).toLocaleString()}`, "Monto"]} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: "10px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Historial de Cortes Guardados */}
      {history.length > 0 && (
        <section className="rounded-2xl border border-outline-variant bg-surface-container p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-on-surface">Historial de Cortes y Jima Registrados</h3>
              <p className="text-xs text-on-surface-variant">
                Comparativa de costos obtenidos en predios propios puestos en fábrica.
              </p>
            </div>
            <span className="text-xs font-semibold text-outline">
              {history.length} cortes guardados
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-outline-variant bg-surface-container-high text-outline">
                <tr>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Predio / Rancho</th>
                  <th className="p-3">Kg en Báscula</th>
                  <th className="p-3">Gasto Total</th>
                  <th className="p-3 font-bold text-primary">Costo / Kg</th>
                  <th className="p-3">Costo / Piña</th>
                  <th className="p-3">Lote</th>
                  <th className="p-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/60">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-container-highest">
                    <td className="p-3 font-mono">{item.harvestDate}</td>
                    <td className="p-3 font-semibold text-on-surface">{item.ranchoName}</td>
                    <td className="p-3">{item.totalKg.toLocaleString()} kg</td>
                    <td className="p-3">${item.totalExpenses.toLocaleString("es-MX", { maximumFractionDigits: 2 })}</td>
                    <td className="p-3 font-bold text-primary">${item.costPerKg.toFixed(2)}/kg</td>
                    <td className="p-3">{item.costPerPina ? `$${item.costPerPina.toFixed(2)}` : "—"}</td>
                    <td className="p-3 font-mono">{item.lotCode ?? "—"}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleDeleteHistoryItem(item.id)}
                        className="rounded p-1 text-on-surface-variant transition hover:bg-error/15 hover:text-error"
                        title="Eliminar de historial"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
