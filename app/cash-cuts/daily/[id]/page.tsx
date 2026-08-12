"use client";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";
import DenominationCounter, {
  type DenominationCount,
} from "@/components/cash-cuts/DenominationCounter";
import {
  ReceiptIcon,
  CheckIcon,
  AlertIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@/components/ui/icons";
 import { useEffect, useState, useCallback, startTransition } from "react";
import { enqueueOperation } from "@/lib/offline/queue";

function localCutKey(id: string) { return `maestro:cash-cut:${id}`; }
function saveLocalCut(cut: CashCut) { localStorage.setItem(localCutKey(cut.id), JSON.stringify(cut)); }

type Step = "ventas" | "salidas" | "entradas" | "evidencias" | "cierre";
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

interface Evidence {
  id: string;
  type: string;
  url: string;
  notes: string | null;
  createdAt: string;
}

interface DenominationRecord {
  id: string;
  context: "APERTURA" | "CIERRE" | "SIGUIENTE_TURNO";
  value: number;
  quantity: number;
}

interface CashCut {
  id: string;
  code: string;
  status: CashCutStatus;
  branch: Branch;
  salesByMethod: SalePayment[];
  outflows: Outflow[];
  inflows: Inflow[];
  evidences: Evidence[];
  cashCounted: number | null;
  cashExpected: number | null;
  difference: number | null;
  envelopeAmount: number | null;
  envelopeNumber: string | null;
  nextFund: number | null;
  denominations: DenominationRecord[];
  event: {
    id: string;
    code: string;
    clientName: string;
    location: string;
    eventDate: string;
  } | null;
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

const TIPOS_EVIDENCIA = [
  { key: "DINERO_CONTADO", label: "Dinero contado" },
  { key: "SOBRE", label: "Sobre" },
  { key: "TICKET", label: "Ticket" },
  { key: "NOTA", label: "Nota" },
  { key: "FACTURA", label: "Factura" },
  { key: "OTRO", label: "Otro" },
];

function isImageUrl(url: string) {
  return /\.(png|jpe?g|gif|webp|avif)$/i.test(url);
}

const STEPS: { key: Step; label: string }[] = [
  { key: "ventas", label: "Ventas" },
  { key: "salidas", label: "Salidas" },
  { key: "entradas", label: "Entradas" },
  { key: "evidencias", label: "Evidencias" },
  { key: "cierre", label: "Cierre" },
];

/**
 * El avance de cada paso se calcula a partir de los datos reales del
 * corte (no de un estado local que se perdería al recargar la
 * página), así el usuario siempre ve en qué va aunque cierre y
 * vuelva a abrir el corte después.
 */
function getStepStatus(
  key: Step,
  cashCut: CashCut
): "complete" | "empty" | "optional" {
  if (key === "ventas") {
    const total = cashCut.salesByMethod.reduce((s, p) => s + p.amount, 0);
    return total > 0 ? "complete" : "empty";
  }

  if (key === "cierre") {
    return cashCut.status !== "ABIERTO" ? "complete" : "empty";
  }

  if (key === "salidas") {
    return cashCut.outflows.length > 0 ? "complete" : "optional";
  }

  if (key === "entradas") {
    return cashCut.inflows.length > 0 ? "complete" : "optional";
  }

  return cashCut.evidences.length > 0 ? "complete" : "optional";
}

function Stepper({
  current,
  cashCut,
  onSelect,
}: {
  current: Step;
  cashCut: CashCut;
  onSelect: (step: Step) => void;
}) {
  return (
    <div className="mb-6 flex items-center gap-1.5 overflow-x-auto pb-1">
      {STEPS.map((s, index) => {
        const status = getStepStatus(s.key, cashCut);
        const isCurrent = s.key === current;

        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onSelect(s.key)}
            className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold transition duration-150 ease-out hover:scale-[1.03] active:scale-[0.97] ${
              isCurrent
                ? "bg-primary text-on-primary"
                : status === "complete"
                  ? "bg-tertiary-fixed-dim/10 text-tertiary-fixed-dim ring-1 ring-tertiary-fixed-dim/25"
                  : status === "empty"
                    ? "bg-secondary/10 text-secondary ring-1 ring-secondary/20"
                    : "bg-surface-container-high text-on-surface-variant"
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                isCurrent
                  ? "bg-on-primary/15"
                  : status === "complete"
                    ? "bg-tertiary-fixed-dim/15"
                    : "bg-surface-container-highest"
              }`}
            >
              {status === "complete" && !isCurrent ? (
                <CheckIcon className="h-3 w-3" />
              ) : (
                index + 1
              )}
            </span>
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

function StepFooterNav({
  current,
  onSelect,
}: {
  current: Step;
  onSelect: (step: Step) => void;
}) {
  const index = STEPS.findIndex((s) => s.key === current);
  const prev = STEPS[index - 1];
  const next = STEPS[index + 1];

  if (!prev && !next) return null;

  return (
    <div className="mt-6 flex items-center justify-between gap-3">
      {prev ? (
        <button
          type="button"
          onClick={() => onSelect(prev.key)}
          className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant transition hover:text-on-surface"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          {prev.label}
        </button>
      ) : (
        <span />
      )}

      {next && (
        <button
          type="button"
          onClick={() => onSelect(next.key)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition duration-150 ease-out hover:scale-[1.03] active:scale-[0.97]"
        >
          Siguiente: {next.label}
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

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
  const [loadError, setLoadError] = useState<string | null>(null);

const load = useCallback(async () => {
  try {
    const res = await fetch(`/api/cash-cuts/${id}`);

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      const cached = localStorage.getItem(localCutKey(id));
      startTransition(() => {
        setCashCut(cached ? JSON.parse(cached) as CashCut : null);
        setLoadError(cached ? null : (errData?.error ?? `No se pudo cargar el corte (código ${res.status}).`));
        setLoading(false);
      });
      return;
    }

    const data = await res.json();
    saveLocalCut(data);
    startTransition(() => {
      setCashCut(data);
      setLoadError(null);
      setLoading(false);
    });
  } catch {
    const cached = localStorage.getItem(localCutKey(id));
    startTransition(() => {
      setCashCut(cached ? JSON.parse(cached) as CashCut : null);
      setLoadError(cached ? null : "No se pudo conectar con el servidor.");
      setLoading(false);
    });
  }
}, [id]);


  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="p-6 text-on-surface-variant">Cargando corte...</div>;
  if (!cashCut) return <div className="p-6 text-error">{loadError ?? "Corte no encontrado."}</div>;

  const isClosed = cashCut.status !== "ABIERTO";

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-4">
        <p className="text-on-surface-variant text-sm">{cashCut.branch.name}</p>
        <h1 className="text-2xl font-bold text-on-surface">{cashCut.code}</h1>
        <span
          className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-bold ${
            isClosed ? "bg-surface-container-highest text-on-surface-variant" : "bg-tertiary-fixed-dim/20 text-tertiary-fixed-dim"
          }`}
        >
          {cashCut.status}
        </span>
        {cashCut.event && (
          <span className="ml-2 inline-block mt-1 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary">
            Evento: {cashCut.event.clientName}
          </span>
        )}
      </div>

      <Stepper current={step} cashCut={cashCut} onSelect={setStep} />

      {step === "ventas" && (
        <VentasStep cashCutId={id} cashCut={cashCut} onSaved={load} disabled={isClosed} />
      )}
      {step === "salidas" && (
        <SalidasStep cashCutId={id} cashCut={cashCut} onSaved={load} disabled={isClosed} />
      )}
      {step === "entradas" && (
        <EntradasStep cashCutId={id} cashCut={cashCut} onSaved={load} disabled={isClosed} />
      )}
      {step === "evidencias" && (
        <EvidenciasStep cashCutId={id} cashCut={cashCut} onSaved={load} disabled={isClosed} />
      )}
      {step === "cierre" && (
        <CierreStep cashCutId={id} cashCut={cashCut} onSaved={load} disabled={isClosed} />
      )}

      <StepFooterNav current={step} onSelect={setStep} />
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
                className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary disabled:opacity-50"
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
      {saving && <p className="text-on-surface-variant text-sm">Guardando...</p>}
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
    if (!navigator.onLine) {
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      await enqueueOperation({ id, kind: "cash-cut.outflow.create", createdAt, payload: { cashCutId, concept, category, amount: Number(amount) } });
      saveLocalCut({ ...cashCut, outflows: [...cashCut.outflows, { id, concept, category, amount: Number(amount) }] });
      setConcept(""); setAmount(""); setSaving(false); onSaved(); return;
    }
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
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
            />
          </Card>
          <Card>
            <CardLabel>Categoría</CardLabel>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
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
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
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
                <p className="text-on-surface font-semibold">{o.concept}</p>
                <p className="text-on-surface-variant text-xs">{o.category}</p>
              </div>
              <p className="text-on-surface font-bold">${o.amount.toFixed(2)}</p>
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
    if (!navigator.onLine) {
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      await enqueueOperation({ id, kind: "cash-cut.inflow.create", createdAt, payload: { cashCutId, type, amount: Number(amount) } });
      saveLocalCut({ ...cashCut, inflows: [...cashCut.inflows, { id, type, amount: Number(amount) }] });
      setAmount(""); setSaving(false); onSaved(); return;
    }
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
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
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
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
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
              <p className="text-on-surface font-semibold">{i.type}</p>
              <p className="text-on-surface font-bold">${i.amount.toFixed(2)}</p>
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

function EvidenciasStep({ cashCutId, cashCut, onSaved, disabled }: StepProps) {
  const [type, setType] = useState(TIPOS_EVIDENCIA[0].key);
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addEvidencia(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Selecciona una foto o archivo.");
      return;
    }

    setSaving(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    if (notes) formData.append("notes", notes);

    const res = await fetch(`/api/cash-cuts/${cashCutId}/evidencias`, {
      method: "POST",
      body: formData,
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "No se pudo subir la evidencia");
      return;
    }

    setFile(null);
    setNotes("");
    onSaved();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={addEvidencia} className="space-y-3">
        <Card>
          <CardLabel>Tipo</CardLabel>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          >
            {TIPOS_EVIDENCIA.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </Card>
        <Card>
          <CardLabel>Foto o archivo</CardLabel>
          <input
            type="file"
            accept="image/*,.pdf"
            capture="environment"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-on-surface-variant file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:font-semibold file:text-on-primary"
          />
        </Card>
        <Card>
          <CardLabel>Notas (opcional)</CardLabel>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej. Sobre #12 sellado"
            className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
          />
        </Card>

        {error && <p className="text-error text-sm">{error}</p>}

        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? "Subiendo..." : "Agregar evidencia"}
        </Button>
      </form>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cashCut.evidences.map((ev) => {
          const label =
            TIPOS_EVIDENCIA.find((t) => t.key === ev.type)?.label ?? ev.type;

          return (
            <a
              key={ev.id}
              href={ev.url}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-lg border border-outline-variant bg-surface-container-high hover:border-primary/25 transition"
            >
              {isImageUrl(ev.url) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ev.url}
                  alt={label}
                  className="h-24 w-full object-cover"
                />
              ) : (
                <div className="flex h-24 w-full items-center justify-center">
                  <ReceiptIcon className="h-8 w-8 text-on-surface-variant" />
                </div>
              )}
              <div className="p-2">
                <p className="text-xs font-semibold text-on-surface truncate">{label}</p>
                {ev.notes && (
                  <p className="text-xs text-on-surface-variant truncate">{ev.notes}</p>
                )}
              </div>
            </a>
          );
        })}
      </div>

      {cashCut.evidences.length === 0 && (
        <p className="text-on-surface-variant text-sm">Aún no hay evidencias registradas.</p>
      )}

      {disabled && (
        <p className="text-outline text-xs">
          Este corte ya está cerrado, pero puedes seguir agregando evidencias si
          hace falta.
        </p>
      )}
    </div>
  );
}

function CierreStep({ cashCutId, cashCut, onSaved }: StepProps) {
  const [cashCounted, setCashCounted] = useState(cashCut.cashCounted?.toString() ?? "");
  const [cashCountedBreakdown, setCashCountedBreakdown] = useState<
    DenominationCount[]
  >([]);
  const [envelopeAmount, setEnvelopeAmount] = useState(cashCut.envelopeAmount?.toString() ?? "");
  const [envelopeNumber, setEnvelopeNumber] = useState(cashCut.envelopeNumber ?? "");
  const [nextFund, setNextFund] = useState(cashCut.nextFund?.toString() ?? "");
  const [nextFundBreakdown, setNextFundBreakdown] = useState<
    DenominationCount[]
  >([]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CloseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalVentas = cashCut.salesByMethod.reduce(
    (sum, s) => sum + s.amount,
    0
  );
  const canClose = totalVentas > 0 || (typeof navigator !== "undefined" && !navigator.onLine);

  async function handleClose() {
    setError(null);

    if (!canClose) {
      setError("Captura al menos una venta antes de cerrar el corte.");
      return;
    }

    if (cashCounted === "" || nextFund === "") {
      setError("Captura el efectivo contado y el fondo para el siguiente turno.");
      return;
    }
    setSaving(true);
    const closePayload = {
      cashCutId,
      cashCounted: Number(cashCounted),
      envelopeAmount: envelopeAmount ? Number(envelopeAmount) : undefined,
      envelopeNumber: envelopeNumber || undefined,
      nextFund: Number(nextFund),
      cashCountedDenominations: cashCountedBreakdown,
      nextFundDenominations: nextFundBreakdown,
    };
    if (!navigator.onLine) {
      const createdAt = new Date().toISOString();
      await enqueueOperation({ id: crypto.randomUUID(), kind: "cash-cut.close", createdAt, payload: closePayload });
      saveLocalCut({ ...cashCut, status: "CERRADO", cashCounted: Number(cashCounted), envelopeAmount: envelopeAmount ? Number(envelopeAmount) : null, envelopeNumber: envelopeNumber || null, nextFund: Number(nextFund) });
      localStorage.removeItem(`maestro:open-cash-cut:${cashCut.branch.id}`);
      setResult({ assignmentWarning: "Cierre guardado en el dispositivo y pendiente de sincronización." });
      setSaving(false); onSaved(); return;
    }
    const res = await fetch(`/api/cash-cuts/${cashCutId}/cerrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(closePayload),
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
    const aperturaBreakdown = cashCut.denominations.filter(
      (d) => d.context === "APERTURA"
    );
    const cierreBreakdown = cashCut.denominations.filter(
      (d) => d.context === "CIERRE"
    );
    const siguienteTurnoBreakdown = cashCut.denominations.filter(
      (d) => d.context === "SIGUIENTE_TURNO"
    );

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

        {aperturaBreakdown.length > 0 && (
          <DenominationBreakdownView
            title="Desglose del fondo de apertura"
            rows={aperturaBreakdown}
          />
        )}
        {cierreBreakdown.length > 0 && (
          <DenominationBreakdownView
            title="Desglose del efectivo contado al cerrar"
            rows={cierreBreakdown}
          />
        )}
        {siguienteTurnoBreakdown.length > 0 && (
          <DenominationBreakdownView
            title="Desglose del fondo para el siguiente turno"
            rows={siguienteTurnoBreakdown}
          />
        )}

        <p className="text-on-surface-variant text-sm">Este corte ya está cerrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <p className="mb-3 text-sm font-semibold text-on-surface-variant">
          Resumen antes de cerrar
        </p>
        <div className="space-y-1.5">
          <ChecklistRow
            ok={totalVentas > 0}
            required
            label={`Ventas capturadas: $${totalVentas.toFixed(2)}`}
          />
          <ChecklistRow
            ok={cashCut.outflows.length > 0}
            label={`${cashCut.outflows.length} salida(s) registrada(s)`}
          />
          <ChecklistRow
            ok={cashCut.inflows.length > 0}
            label={`${cashCut.inflows.length} entrada(s) registrada(s)`}
          />
          <ChecklistRow
            ok={cashCut.evidences.length > 0}
            label={`${cashCut.evidences.length} evidencia(s) subida(s)`}
          />
        </div>
      </Card>

      <Card>
        <CardLabel>Efectivo contado físicamente</CardLabel>
        <DenominationCounter
          onTotalChange={(total, breakdown) => {
            setCashCounted(total > 0 ? String(total) : "");
            setCashCountedBreakdown(breakdown);
          }}
        />
      </Card>
      <Card>
        <CardLabel>Monto enviado al sobre</CardLabel>
        <input
          type="number"
          inputMode="decimal"
          value={envelopeAmount}
          onChange={(e) => setEnvelopeAmount(e.target.value)}
          className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
        />
      </Card>
      <Card>
        <CardLabel>Número de sobre (opcional)</CardLabel>
        <input
          value={envelopeNumber}
          onChange={(e) => setEnvelopeNumber(e.target.value)}
          className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
        />
      </Card>
      <Card>
        <CardLabel>Fondo para el siguiente turno</CardLabel>
        <DenominationCounter
          onTotalChange={(total, breakdown) => {
            setNextFund(total > 0 ? String(total) : "");
            setNextFundBreakdown(breakdown);
          }}
        />
      </Card>

      {error && <p className="text-error text-sm">{error}</p>}
      {result?.assignmentWarning && (
        <p className="text-secondary text-sm">{result.assignmentWarning}</p>
      )}

      <Button
        className="w-full"
        size="lg"
        disabled={saving || !canClose}
        onClick={handleClose}
      >
        {saving ? "Cerrando..." : "Cerrar corte"}
      </Button>
    </div>
  );
}

function ChecklistRow({
  ok,
  label,
  required = false,
}: {
  ok: boolean;
  label: string;
  required?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckIcon className="h-4 w-4 shrink-0 text-tertiary-fixed-dim" />
      ) : required ? (
        <AlertIcon className="h-4 w-4 shrink-0 text-secondary" />
      ) : (
        <span className="h-4 w-4 shrink-0 rounded-full border border-outline-variant" />
      )}
      <span
        className={
          ok
            ? "text-on-surface"
            : required
              ? "text-secondary"
              : "text-on-surface-variant"
        }
      >
        {label}
      </span>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);
}

function DenominationBreakdownView({
  title,
  rows,
}: {
  title: string;
  rows: DenominationRecord[];
}) {
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, r) => sum + r.value * r.quantity, 0);

  return (
    <Card>
      <CardLabel>{title}</CardLabel>
      <div className="mt-2 space-y-1.5">
        {sorted.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-on-surface-variant">
              {r.quantity} × {formatCurrency(r.value)}
            </span>
            <span className="font-semibold text-on-surface">
              {formatCurrency(r.value * r.quantity)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-outline-variant pt-2 text-sm">
        <span className="font-semibold text-on-surface-variant">Total</span>
        <span className="font-bold text-primary">
          {formatCurrency(total)}
        </span>
      </div>
    </Card>
  );
}
