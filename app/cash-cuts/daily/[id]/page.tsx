"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";
import DenominationWizard from "@/components/cash-cuts/DenominationWizard";
import type { CashDenominationCount } from "@/lib/cash-cuts/denominations";
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
  occurredAt?: string;
  notes?: string | null;
}

interface Inflow {
  id: string;
  type: string;
  amount: number;
  occurredAt?: string;
  notes?: string | null;
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
  startingFund: number;
  date: string;
  openedAt: string;
  closedAt: string | null;
  totalSales: number | null;
  totalOutflows: number | null;
  totalInflows: number | null;
  totalCostOfGoods: number | null;
  netProfit: number | null;
  envelopeNotes: string | null;
  notes: string | null;
  responsible: { id: string; name: string };
  createdBy: { id: string; name: string };
  updatedBy: { id: string; name: string } | null;
  posSales: Array<{
    id: string;
    code: string;
    subtotal: number;
    discountAmount: number;
    total: number;
    createdAt: string;
    soldBy: { id: string; name: string };
    items: Array<{
      id: string;
      name: string;
      description: string | null;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }>;
  }>;
}

interface CloseResult {
  assignmentWarning?: string;
  confirmation?: {
    cashCounted: number;
    cashExpected: number;
    difference: number;
    envelopeAmount: number;
    nextFund: number;
    envelopeNumber: string | null;
  };
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
  const candidate = url.startsWith("/api/")
    ? new URL(url, "http://local").searchParams.get("name") ?? url
    : url;
  return /\.(png|jpe?g|gif|webp|avif)$/i.test(candidate);
}

const STEPS: { key: Step; label: string }[] = [
  { key: "ventas", label: "Ventas" },
  { key: "salidas", label: "Salidas" },
  { key: "entradas", label: "Entradas" },
  { key: "evidencias", label: "Evidencias" },
  { key: "cierre", label: "Cierre" },
];

const formatMoney = (value: number | null | undefined) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value ?? 0);

const formatDateTime = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("es-MX", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Mexico_City",
      }).format(new Date(value))
    : "Sin registrar";

function ClosedCutSummary({ cashCut }: { cashCut: CashCut }) {
  const posSales = cashCut.posSales ?? [];
  const products = new Map<string, { name: string; quantity: number; total: number }>();
  for (const sale of posSales) {
    for (const item of sale.items) {
      const name = item.description || item.name;
      const current = products.get(name) ?? { name, quantity: 0, total: 0 };
      current.quantity += item.quantity;
      current.total += item.lineTotal;
      products.set(name, current);
    }
  }
  const productRows = [...products.values()].sort((a, b) => b.total - a.total);
  const posTotal = posSales.reduce((sum, sale) => sum + sale.total, 0);
  const discountTotal = posSales.reduce((sum, sale) => sum + sale.discountAmount, 0);
  const manualSales = Math.max(0, (cashCut.totalSales ?? 0) - posTotal);

  return (
    <div className="space-y-5">
      <Link href="/cash-cuts" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
        <ChevronLeftIcon className="h-4 w-4" /> Volver a cortes
      </Link>

      <Card highlight>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardLabel>{cashCut.branch.name}</CardLabel>
            <CardValue>{cashCut.code}</CardValue>
            <p className="mt-1 text-sm text-on-surface-variant">Radiografía completa del turno</p>
          </div>
          <span className="rounded-full bg-surface-container-highest px-3 py-1 text-xs font-bold text-on-surface-variant">
            {cashCut.status}
          </span>
        </div>
      </Card>

      <section>
        <h2 className="mb-3 text-base font-bold text-on-surface">Turno y responsables</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card><CardLabel>Responsable del turno</CardLabel><CardValue>{cashCut.responsible?.name ?? "Sin registrar"}</CardValue></Card>
          <Card><CardLabel>Abierto por</CardLabel><CardValue>{cashCut.createdBy?.name ?? "Sin registrar"}</CardValue></Card>
          <Card><CardLabel>Apertura</CardLabel><p className="font-bold text-on-surface">{formatDateTime(cashCut.openedAt)}</p></Card>
          <Card><CardLabel>Cierre</CardLabel><p className="font-bold text-on-surface">{formatDateTime(cashCut.closedAt)}</p></Card>
        </div>
        {cashCut.event && (
          <Card className="mt-3">
            <CardLabel>Evento vinculado</CardLabel>
            <p className="font-bold text-on-surface">{cashCut.event.code} · {cashCut.event.clientName}</p>
            <p className="text-sm text-on-surface-variant">{cashCut.event.location}</p>
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-bold text-on-surface">Resultado de caja</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card><CardLabel>Fondo inicial</CardLabel><CardValue>{formatMoney(cashCut.startingFund)}</CardValue></Card>
          <Card><CardLabel>Efectivo esperado</CardLabel><CardValue>{formatMoney(cashCut.cashExpected)}</CardValue></Card>
          <Card><CardLabel>Efectivo contado</CardLabel><CardValue>{formatMoney(cashCut.cashCounted)}</CardValue></Card>
          <Card><CardLabel>Al sobre</CardLabel><CardValue>{formatMoney(cashCut.envelopeAmount)}</CardValue></Card>
          <Card><CardLabel>Fondo restante</CardLabel><CardValue>{formatMoney(cashCut.nextFund)}</CardValue></Card>
          <Card>
            <CardLabel>Diferencia</CardLabel>
            <p className={`text-2xl font-bold ${(cashCut.difference ?? 0) < 0 ? "text-error" : "text-on-surface"}`}>{formatMoney(cashCut.difference)}</p>
          </Card>
        </div>
        {(cashCut.envelopeNumber || cashCut.envelopeNotes) && (
          <Card className="mt-3">
            <CardLabel>Sobre</CardLabel>
            <p className="font-bold text-on-surface">{cashCut.envelopeNumber ? `Número ${cashCut.envelopeNumber}` : "Sin número"}</p>
            {cashCut.envelopeNotes && <p className="text-sm text-on-surface-variant">{cashCut.envelopeNotes}</p>}
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-bold text-on-surface">Ventas</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card highlight><CardLabel>Total vendido</CardLabel><CardValue>{formatMoney(cashCut.totalSales)}</CardValue></Card>
          <Card><CardLabel>Tickets POS</CardLabel><CardValue>{posSales.length}</CardValue></Card>
          <Card><CardLabel>Descuentos POS</CardLabel><CardValue>{formatMoney(discountTotal)}</CardValue></Card>
          <Card><CardLabel>Captura manual</CardLabel><CardValue>{formatMoney(manualSales)}</CardValue></Card>
        </div>
        <div className="mt-3 space-y-2">
          {cashCut.salesByMethod.filter((sale) => sale.amount > 0).map((sale) => (
            <Card key={sale.id}>
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-on-surface">{METODOS.find((method) => method.key === sale.method)?.label ?? sale.method}</span>
                <span className="font-bold text-on-surface">{formatMoney(sale.amount)}</span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-bold text-on-surface">Productos vendidos</h2>
        {productRows.length > 0 ? (
          <Card>
            <div className="divide-y divide-outline-variant">
              {productRows.map((product) => (
                <div key={product.name} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div><p className="font-semibold text-on-surface">{product.name}</p><p className="text-xs text-on-surface-variant">{product.quantity} unidad(es)</p></div>
                  <span className="font-bold text-on-surface">{formatMoney(product.total)}</span>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card><p className="text-sm text-on-surface-variant">Este turno no tiene productos registrados desde el Punto de Venta; las ventas pudieron capturarse manualmente.</p></Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-bold text-on-surface">Movimientos del turno</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card>
            <CardLabel>Entradas · {formatMoney(cashCut.totalInflows)}</CardLabel>
            <div className="mt-2 space-y-2">{cashCut.inflows.length ? cashCut.inflows.map((entry) => <div key={entry.id} className="flex justify-between gap-2 text-sm"><span className="text-on-surface-variant">{entry.type}</span><b className="text-on-surface">{formatMoney(entry.amount)}</b></div>) : <p className="text-sm text-on-surface-variant">Sin entradas</p>}</div>
          </Card>
          <Card>
            <CardLabel>Salidas · {formatMoney(cashCut.totalOutflows)}</CardLabel>
            <div className="mt-2 space-y-2">{cashCut.outflows.length ? cashCut.outflows.map((entry) => <div key={entry.id} className="flex justify-between gap-2 text-sm"><span className="text-on-surface-variant">{entry.concept}</span><b className="text-on-surface">{formatMoney(entry.amount)}</b></div>) : <p className="text-sm text-on-surface-variant">Sin salidas</p>}</div>
          </Card>
        </div>
      </section>

      {(cashCut.notes || cashCut.evidences.length > 0) && (
        <section>
          <h2 className="mb-3 text-base font-bold text-on-surface">Notas y evidencias</h2>
          {cashCut.notes && <Card className="mb-3"><p className="text-sm text-on-surface">{cashCut.notes}</p></Card>}
          <p className="text-sm text-on-surface-variant">{cashCut.evidences.length} evidencia(s) asociada(s) al turno.</p>
        </section>
      )}
    </div>
  );
}

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

  if (isClosed) {
    return <div className="mx-auto max-w-3xl p-6"><ClosedCutSummary cashCut={cashCut} /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-on-surface-variant text-sm">{cashCut.branch.name}</p>
            <h1 className="text-2xl font-bold text-on-surface">{cashCut.code}</h1>
          </div>
          {!isClosed && (
            <Button type="button" variant="secondary" onClick={() => setStep("cierre")}>
              Cerrar caja
            </Button>
          )}
        </div>
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
  const [error, setError] = useState<string | null>(null);

  async function saveMethod(method: string) {
    setSaving(true);
    setError(null);
    const amount = Number(values[method] || 0);

    if (!navigator.onLine) {
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      await enqueueOperation({ id, kind: "cash-cut.venta.set", createdAt, payload: { cashCutId, method, amount } });
      const existing = cashCut.salesByMethod.find((s) => s.method === method);
      const salesByMethod = existing
        ? cashCut.salesByMethod.map((s) => (s.method === method ? { ...s, amount } : s))
        : [...cashCut.salesByMethod, { id, method, amount }];
      saveLocalCut({ ...cashCut, salesByMethod });
      setSaving(false);
      onSaved();
      return;
    }

    try {
      const res = await fetch(`/api/cash-cuts/${cashCutId}/ventas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, amount }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "No se pudo guardar la venta.");
        return;
      }
      onSaved();
    } catch {
      setError("No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  const total = Object.values(values).reduce((sum, v) => sum + (Number(v) || 0), 0);

  return (
    <div className="space-y-3">
      <p className="text-xs text-on-surface-variant">
        Si vendiste con el Punto de Venta, estos montos ya están cargados — no los vuelvas a
        capturar aquí, porque escribir un número nuevo <span className="font-semibold">reemplaza</span>{" "}
        (no suma) lo que ya se cobró en el POS para ese método de pago.
      </p>
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
      {error && <p className="text-error text-sm">{error}</p>}
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

    if (!navigator.onLine) {
      setError("Necesitas conexión a internet para subir evidencias.");
      return;
    }

    setSaving(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    if (notes) formData.append("notes", notes);

    try {
      const res = await fetch(`/api/cash-cuts/${cashCutId}/evidencias`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "No se pudo subir la evidencia");
        return;
      }

      setFile(null);
      setNotes("");
      onSaved();
    } catch {
      setError("No se pudo subir la evidencia. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
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
  const [cashCounted, setCashCounted] = useState<number | null>(null);
  const [cashCountedBreakdown, setCashCountedBreakdown] = useState<CashDenominationCount[]>([]);
  const [envelopeAmount, setEnvelopeAmount] = useState("");
  const [envelopeNumber, setEnvelopeNumber] = useState(cashCut.envelopeNumber ?? "");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CloseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalVentas = cashCut.salesByMethod.reduce(
    (sum, s) => sum + s.amount,
    0
  );
  // También debe poder cerrarse una caja sin ventas (por ejemplo, un turno
  // abierto por error o un día sin operación). El conteo físico sigue siendo obligatorio.
  const canClose = true;
  const cashSales = cashCut.salesByMethod.find((sale) => sale.method === "EFECTIVO")?.amount ?? 0;
  const expectedCash = cashCut.startingFund + cashSales +
    cashCut.inflows.reduce((sum, inflow) => sum + inflow.amount, 0) -
    cashCut.outflows.reduce((sum, outflow) => sum + outflow.amount, 0);

  async function handleClose() {
    setError(null);

    if (cashCounted === null) {
      setError("Primero cuenta todo el efectivo de la caja.");
      return;
    }
    const envelope = Number(envelopeAmount || 0);
    if (!Number.isFinite(envelope) || envelope < 0) {
      setError("Captura un monto de sobre válido.");
      return;
    }
    if (envelope > cashCounted) {
      setError("El sobre no puede ser mayor al efectivo contado.");
      return;
    }
    setSaving(true);
    const closePayload = {
      cashCutId,
      closingMode: "COUNT_THEN_ENVELOPE",
      cashCounted,
      cashCountedDenominations: cashCountedBreakdown,
      envelopeAmount: envelope,
      envelopeNumber: envelopeNumber || undefined,
    };
    if (!navigator.onLine) {
      const createdAt = new Date().toISOString();
      await enqueueOperation({ id: crypto.randomUUID(), kind: "cash-cut.close", createdAt, payload: closePayload });
      saveLocalCut({ ...cashCut, status: "CERRADO", cashCounted, cashExpected: expectedCash, difference: cashCounted - expectedCash, envelopeAmount: envelope, envelopeNumber: envelopeNumber || null, nextFund: cashCounted - envelope });
      localStorage.removeItem(`maestro:open-cash-cut:${cashCut.branch.id}`);
      setResult({
        assignmentWarning: "Cierre guardado en el dispositivo y pendiente de sincronización.",
        confirmation: {
          cashCounted,
          cashExpected: expectedCash,
          difference: cashCounted - expectedCash,
          envelopeAmount: envelope,
          nextFund: cashCounted - envelope,
          envelopeNumber: envelopeNumber || null,
        },
      });
      setSaving(false);
      onSaved();
      return;
    }

    let data;
    try {
      const res = await fetch(`/api/cash-cuts/${cashCutId}/cerrar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(closePayload),
      });

      if (!res.ok) {
        const errData = await res.json();
        setError(errData.error ?? "No se pudo cerrar el corte");
        return;
      }

      data = await res.json();
    } catch {
      setError("No se pudo cerrar el corte. Revisa tu conexión e inténtalo de nuevo.");
      return;
    } finally {
      setSaving(false);
    }

    const updatedCut = { ...cashCut, ...data.cashCut };
    saveLocalCut(updatedCut);
    setResult({
      assignmentWarning: data.assignmentWarning,
      confirmation: {
        cashCounted: data.cashCut.cashCounted,
        cashExpected: data.cashCut.cashExpected,
        difference: data.cashCut.difference,
        envelopeAmount: data.cashCut.envelopeAmount ?? 0,
        nextFund: data.cashCut.nextFund ?? 0,
        envelopeNumber: data.cashCut.envelopeNumber ?? null,
      },
    });
  }

  if (result?.confirmation) {
    const confirmation = result.confirmation;
    return (
      <div className="space-y-4">
        <Card highlight className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim">
            <CheckIcon className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold text-on-surface">Caja cerrada correctamente</h2>
          <p className="mt-2 text-sm text-on-surface-variant">Revisa el resumen final del cierre.</p>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card><CardLabel>Efectivo contado</CardLabel><CardValue>${confirmation.cashCounted.toFixed(2)}</CardValue></Card>
          <Card><CardLabel>Efectivo esperado</CardLabel><CardValue>${confirmation.cashExpected.toFixed(2)}</CardValue></Card>
          <Card><CardLabel>Dinero al sobre</CardLabel><CardValue>${confirmation.envelopeAmount.toFixed(2)}</CardValue></Card>
          <Card><CardLabel>Fondo en caja</CardLabel><CardValue>${confirmation.nextFund.toFixed(2)}</CardValue></Card>
        </div>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardLabel>Diferencia del corte</CardLabel>
              <CardValue>${confirmation.difference.toFixed(2)}</CardValue>
            </div>
            {confirmation.envelopeNumber && (
              <div className="text-right">
                <CardLabel>Número de sobre</CardLabel>
                <p className="font-bold text-on-surface">{confirmation.envelopeNumber}</p>
              </div>
            )}
          </div>
        </Card>

        {result.assignmentWarning && <p className="text-sm text-secondary">{result.assignmentWarning}</p>}

        <Link
          href="/cash-cuts"
          className="inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-3 text-base font-semibold text-on-primary transition duration-150 hover:opacity-90 active:scale-[0.97]"
        >
          Volver a Cortes
        </Link>
      </div>
    );
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
            title="Desglose registrado al cerrar"
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
            label={`Ventas capturadas: $${totalVentas.toFixed(2)}${totalVentas === 0 ? " (sin ventas)" : ""}`}
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

      {error && <p className="text-error text-sm">{error}</p>}
      {result?.assignmentWarning && (
        <p className="text-secondary text-sm">{result.assignmentWarning}</p>
      )}

      {canClose && cashCounted === null && (
        <DenominationWizard
          title="Contar efectivo de cierre"
          description="Cuenta todo el dinero físico que hay en la caja, una denominación a la vez."
          confirmLabel="Confirmar conteo"
          onConfirm={(total, breakdown) => {
            setCashCounted(total);
            setCashCountedBreakdown(breakdown);
            setError(null);
          }}
        />
      )}

      {canClose && cashCounted !== null && (
        <div className="space-y-3">
          <Card highlight>
            <CardLabel>Efectivo contado</CardLabel>
            <CardValue>${cashCounted.toFixed(2)}</CardValue>
            <button type="button" onClick={() => setCashCounted(null)} className="mt-2 text-xs font-semibold text-primary">
              Editar conteo
            </button>
          </Card>
          <Card>
            <CardLabel>Dinero que va al sobre</CardLabel>
            <p className="mb-3 text-xs text-on-surface-variant">Este dinero se enviará a caja fuerte.</p>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={cashCounted}
              step="0.01"
              value={envelopeAmount}
              onChange={(event) => setEnvelopeAmount(event.target.value)}
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-lg font-bold text-on-surface outline-none focus:border-primary"
              placeholder="0.00"
            />
          </Card>
          <Card>
            <CardLabel>Número de sobre (opcional)</CardLabel>
            <input
              value={envelopeNumber}
              onChange={(event) => setEnvelopeNumber(event.target.value)}
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none focus:border-primary"
            />
          </Card>
          <Card highlight>
            <CardLabel>Fondo que queda en caja</CardLabel>
            <CardValue>${Math.max(0, cashCounted - (Number(envelopeAmount) || 0)).toFixed(2)}</CardValue>
          </Card>
          <Button className="w-full" size="lg" disabled={saving} onClick={handleClose}>
            {saving ? "Cerrando..." : "Confirmar y cerrar caja"}
          </Button>
        </div>
      )}
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
