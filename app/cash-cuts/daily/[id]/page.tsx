"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";

type Step = "ventas" | "salidas" | "entradas" | "cierre";
type CashCutStatus = "ABIERTO" | "CERRADO" | "AUDITADO";

interface Branch {
  id: string;
  name: string;
}

interface SalePayment {
  id: string;
  method: string;
  amount: number;
}

interface Outflow {
  id: string;
  concept: string;
  category: string;
  amount: number;
}

interface Inflow {
  id: string;
  type: string;
  amount: number;
}

interface CashCut {
  id: string;
  code: string;
  status: CashCutStatus;
  branch: Branch;
  salesByMethod: SalePayment[];
  outflows: Outflow[];
  inflows: Inflow[];
  cashCounted: number | null;
  cashExpected: number | null;
  difference: number | null;
  envelopeAmount: number | null;
  envelopeNumber: string | null;
  nextFund: number | null;
}

interface CloseResult {
  assignmentWarning?: string;
}

const METODOS = [
  { key: "EFECTIVO", label: "Efectivo" },
  { key: "TARJETA", label: "Tarjeta" },
  { key: "TRANSFERENCIA", label: "Transferencia" },
  { key: "DIDI", label: "DiDi" },
  { key: "UBER", label: "Uber" },
  { key: "RAPPI", label: "Rappi" },
  { key: "VALES", label: "Vales" },
  { key: "OTRO", label: "Otro" },
];

const CATEGORIAS_SALIDA = [
  "Insumos de barra",
  "Hielo",
  "Limpieza",
  "Mantenimiento",
  "Transporte",
  "Cambio",
  "Otro",
];

interface StepProps {
  cashCutId: string;
  cashCut: CashCut;
  onSaved: () => void;
  disabled: boolean;
}

export default function CashCutDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [cashCut, setCashCut] = useState<CashCut | null>(null);
  const [step, setStep] = useState<Step>("ventas");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/cash-cuts/${id}`);
    if (res.ok) setCashCut(await res.json());
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="p-6 text-slate-400">Cargando corte...</div>;
  if (!cashCut) return <div className="p-6 text-red-400">Corte no encontrado.</div>;

  const isClosed = cashCut.status !== "ABIERTO";

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-4">
        <p className="text-slate-400 text-sm">{cashCut.branch.name}</p>
        <h1 className="text-2xl font-bold text-white">{cashCut.code}</h1>
        <span
          className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-bold ${
            isClosed ? "bg-slate-700 text-slate-300" : "bg-green-500/20 text-green-300"
          }`}
        >
          {cashCut.status}
        </span>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {(["ventas", "salidas", "entradas", "cierre"] as Step[]).map((s) => (
          <button
            key={s}
            onClick={() => setStep(s)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap ${
              step === s ? "bg-yellow-400 text-slate-900" : "bg-slate-800 text-slate-300"
            }`}
          >
            {s === "ventas" && "1. Ventas"}
            {s === "salidas" && "2. Salidas"}
            {s === "entradas" && "3. Entradas"}
            {s === "cierre" && "4. Cierre"}
          </button>
        ))}
      </div>

      {step === "ventas" && (
        <VentasStep cashCutId={id} cashCut={cashCut} onSaved={load} disabled={isClosed} />
      )}
      {step === "salidas" && (
        <SalidasStep cashCutId={id} cashCut={cashCut} onSaved={load} disabled={isClosed} />
      )}
      {step === "entradas" && (
        <EntradasStep cashCutId={id} cashCut={cashCut} onSaved={load} disabled={isClosed} />
      )}
      {step === "cierre" && (
        <CierreStep cashCutId={id} cashCut={cashCut} onSaved={load} disabled={isClosed} />
      )}
    </div>
  );
}

function VentasStep({ cashCutId, cashCut, onSaved, disabled }: StepProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const m of METODOS) {
      const existing = cashCut.salesByMethod.find((s) => s.method === m.key);
      initial[m.key] = existing ? String(existing.amount) : "";
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);

  async function saveMethod(method: string) {
    setSaving(true);
    await fetch(`/api/cash-cuts/${cashCutId}/ventas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, amount: Number(values[method] || 0) }),
    });
    setSaving(false);
    onSaved();
  }

  const total = Object.values(values).reduce((sum, v) => sum + (Number(v) || 0), 0);

  return (
    <div className="space-y-3">
      {METODOS.map((m) => (
        <Card key={m.key}>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <CardLabel>{m.label}</CardLabel>
              <input
                type="number"
                inputMode="decimal"
                disabled={disabled}
                value={values[m.key]}
                onChange={(e) => setValues({ ...values, [m.key]: e.target.value })}
                onBlur={() => saveMethod(m.key)}
                className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-600 disabled:opacity-50"
                placeholder="0"
              />
            </div>
          </div>
        </Card>
      ))}
      <Card highlight>
        <CardLabel>Total ventas</CardLabel>
        <CardValue>${total.toFixed(2)}</CardValue>
      </Card>
      {saving && <p className="text-slate-400 text-sm">Guardando...</p>}
    </div>
  );
}

function SalidasStep({ cashCutId, cashCut, onSaved, disabled }: StepProps) {
  const [concept, setConcept] = useState("");
  const [category, setCategory] = useState(CATEGORIAS_SALIDA[0]);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  async function addSalida(e: React.FormEvent) {
    e.preventDefault();
    if (!concept || !category || !amount) return;
    setSaving(true);
    await fetch(`/api/cash-cuts/${cashCutId}/salidas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concept, category, amount: Number(amount) }),
    });
    setConcept("");
    setAmount("");
    setSaving(false);
    onSaved();
  }

  const total = cashCut.outflows.reduce((sum, o) => sum + o.amount, 0);

  return (
    <div className="space-y-4">
      {!disabled && (
        <form onSubmit={addSalida} className="space-y-3">
          <Card>
            <CardLabel>Concepto</CardLabel>
            <input
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Ej. Compra de hielo"
              className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-600"
            />
          </Card>
          <Card>
            <CardLabel>Categoría</CardLabel>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-600"
            >
              {CATEGORIAS_SALIDA.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </Card>
          <Card>
            <CardLabel>Monto</CardLabel>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-600"
            />
          </Card>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Guardando..." : "Agregar salida"}
          </Button>
        </form>
      )}

      <div className="space-y-2">
        {cashCut.outflows.map((o) => (
          <Card key={o.id}>
            <div className="flex justify-between">
              <div>
                <p className="text-white font-semibold">{o.concept}</p>
                <p className="text-slate-400 text-xs">{o.category}</p>
              </div>
              <p className="text-white font-bold">${o.amount.toFixed(2)}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card highlight>
        <CardLabel>Total salidas</CardLabel>
        <CardValue>${total.toFixed(2)}</CardValue>
      </Card>
    </div>
  );
}

function EntradasStep({ cashCutId, cashCut, onSaved, disabled }: StepProps) {
  const [type, setType] = useState("CAMBIO_RECIBIDO");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const TIPOS = [
    { key: "CAMBIO_RECIBIDO", label: "Cambio recibido" },
    { key: "REEMBOLSO", label: "Reembolso" },
    { key: "AJUSTE", label: "Ajuste" },
    { key: "PRESTAMO", label: "Préstamo" },
    { key: "OTRO", label: "Otro" },
  ];

  async function addEntrada(e: React.FormEvent) {
    e.preventDefault();
    if (!amount) return;
    setSaving(true);
    await fetch(`/api/cash-cuts/${cashCutId}/entradas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, amount: Number(amount) }),
    });
    setAmount("");
    setSaving(false);
    onSaved();
  }

  const total = cashCut.inflows.reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="space-y-4">
      {!disabled && (
        <form onSubmit={addEntrada} className="space-y-3">
          <Card>
            <CardLabel>Tipo</CardLabel>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-600"
            >
              {TIPOS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </Card>
          <Card>
            <CardLabel>Monto</CardLabel>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-600"
            />
          </Card>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Guardando..." : "Agregar entrada"}
          </Button>
        </form>
      )}

      <div className="space-y-2">
        {cashCut.inflows.map((i) => (
          <Card key={i.id}>
            <div className="flex justify-between">
              <p className="text-white font-semibold">{i.type}</p>
              <p className="text-white font-bold">${i.amount.toFixed(2)}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card highlight>
        <CardLabel>Total entradas</CardLabel>
        <CardValue>${total.toFixed(2)}</CardValue>
      </Card>
    </div>
  );
}

function CierreStep({ cashCutId, cashCut, onSaved, disabled }: StepProps) {
  const [cashCounted, setCashCounted] = useState(cashCut.cashCounted?.toString() ?? "");
  const [envelopeAmount, setEnvelopeAmount] = useState(cashCut.envelopeAmount?.toString() ?? "");
  const [envelopeNumber, setEnvelopeNumber] = useState(cashCut.envelopeNumber ?? "");
  const [nextFund, setNextFund] = useState(cashCut.nextFund?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CloseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClose() {
    setError(null);
    if (cashCounted === "" || nextFund === "") {
      setError("Captura el efectivo contado y el fondo para el siguiente turno.");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/cash-cuts/${cashCutId}/cerrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cashCounted: Number(cashCounted),
        envelopeAmount: envelopeAmount ? Number(envelopeAmount) : undefined,
        envelopeNumber: envelopeNumber || undefined,
        nextFund: Number(nextFund),
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "No se pudo cerrar el corte");
      return;
    }

    const data: CloseResult = await res.json();
    setResult(data);
    onSaved();
  }

  if (cashCut.status !== "ABIERTO") {
    return (
      <div className="space-y-3">
        <Card highlight>
          <CardLabel>Diferencia</CardLabel>
          <CardValue>${cashCut.difference?.toFixed(2)}</CardValue>
        </Card>
        <Card>
          <CardLabel>Efectivo esperado</CardLabel>
          <CardValue>${cashCut.cashExpected?.toFixed(2)}</CardValue>
        </Card>
        <Card>
          <CardLabel>Efectivo contado</CardLabel>
          <CardValue>${cashCut.cashCounted?.toFixed(2)}</CardValue>
        </Card>
        <p className="text-slate-400 text-sm">Este corte ya está cerrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardLabel>Efectivo contado físicamente</CardLabel>
        <input
          type="number"
          inputMode="decimal"
          value={cashCounted}
          onChange={(e) => setCashCounted(e.target.value)}
          className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-600"
        />
      </Card>
      <Card>
        <CardLabel>Monto enviado al sobre</CardLabel>
        <input
          type="number"
          inputMode="decimal"
          value={envelopeAmount}
          onChange={(e) => setEnvelopeAmount(e.target.value)}
          className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-600"
        />
      </Card>
      <Card>
        <CardLabel>Número de sobre (opcional)</CardLabel>
        <input
          value={envelopeNumber}
          onChange={(e) => setEnvelopeNumber(e.target.value)}
          className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-600"
        />
      </Card>
      <Card>
        <CardLabel>Fondo para el siguiente turno</CardLabel>
        <input
          type="number"
          inputMode="decimal"
          value={nextFund}
          onChange={(e) => setNextFund(e.target.value)}
          className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-600"
        />
      </Card>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {result?.assignmentWarning && (
        <p className="text-yellow-300 text-sm">{result.assignmentWarning}</p>
      )}

      <Button className="w-full" size="lg" disabled={saving} onClick={handleClose}>
        {saving ? "Cerrando..." : "Cerrar corte"}
      </Button>
    </div>
  );
}
