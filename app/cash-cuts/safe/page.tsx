"use client";

import { useEffect, useState, useCallback, useRef, startTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DateRangeCalendar } from "@/components/ui/DateRangeCalendar";
import { BranchSafeSummaryCard } from "@/components/cash-cuts/safe/BranchSafeSummaryCard";
import { EnvelopeRow } from "@/components/cash-cuts/safe/EnvelopeRow";
import { PendingEnvelopeRow } from "@/components/cash-cuts/safe/PendingEnvelopeRow";
import type { BranchSafeSummary } from "@/lib/cash-cuts/safeEnvelopes";

interface EnvelopeItem {
  id: string;
  code: string;
  cutDate: string;
  originalAmount: number;
  currentBalance: number;
  status: "PENDIENTE" | "EN_CAJA_FUERTE" | "PARCIAL" | "VACIO";
  cashCut: { id: string; code: string } | null;
  createdBy: { id: string; name: string } | null;
  receivedBy: { id: string; name: string } | null;
}

interface LegacyMovement {
  id: string;
  branch: string;
  type: "DEPOSITO_SOBRE" | "RETIRO";
  amount: number;
  notes: string | null;
  user: string;
  createdAt: string;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

/*
 * El permiso real se valida en el servidor (canWithdraw/canReceive
 * en lib/cash-cuts/safeEnvelopes.ts) -- igual que el resto de este
 * modulo, que nunca ha filtrado botones por rol en el cliente. Si
 * el usuario no tiene permiso, el POST responde 403 y el
 * componente muestra ese error tal cual, en vez de duplicar la
 * lista de roles aqui y arriesgar que se desincronice.
 */

export default function SafePage() {
  const [summaries, setSummaries] = useState<BranchSafeSummary[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [envelopes, setEnvelopes] = useState<EnvelopeItem[]>([]);
  const envelopeRequestRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [legacyMovements, setLegacyMovements] = useState<LegacyMovement[]>([]);
  const [movementDateFrom, setMovementDateFrom] = useState("");
  const [movementDateTo, setMovementDateTo] = useState("");

  const loadSummaries = useCallback(async () => {
    try {
      const res = await fetch("/api/cash-cuts/safe/envelopes");
      if (!res.ok) throw new Error("No se pudo cargar la caja fuerte");
      const data: BranchSafeSummary[] = await res.json();
      startTransition(() => {
        setSummaries(data);
        if (!selectedBranchId && data.length > 0) setSelectedBranchId(data[0].branchId);
        setLoading(false);
      });
    } catch (err) {
      startTransition(() => {
        setError(err instanceof Error ? err.message : "Error desconocido");
        setLoading(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadEnvelopes = useCallback(async (branchId: string) => {
    const requestId = ++envelopeRequestRef.current;
    const res = await fetch(`/api/cash-cuts/safe/envelopes?branchId=${branchId}`);
    if (!res.ok) return;

    const data: EnvelopeItem[] = await res.json();
    // Al cambiar de sucursal puede terminar después una consulta anterior.
    // Solo la respuesta más reciente puede reemplazar la lista visible.
    if (requestId === envelopeRequestRef.current) setEnvelopes(data);
  }, []);

  const loadLegacyMovements = useCallback(async (dateFrom = movementDateFrom, dateTo = movementDateTo) => {
    const params = new URLSearchParams({ ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) });
    const res = await fetch(`/api/cash-cuts/safe/movements?${params}`);
    if (res.ok) setLegacyMovements(await res.json());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadSummaries();
    void loadLegacyMovements("", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedBranchId) void loadEnvelopes(selectedBranchId);
  }, [selectedBranchId, loadEnvelopes]);

  function refreshAll() {
    void loadSummaries();
    if (selectedBranchId) void loadEnvelopes(selectedBranchId);
  }

  const selectedSummary = summaries.find((s) => s.branchId === selectedBranchId);
  const validEnvelopes = envelopes.filter((e) => e.status !== "PENDIENTE");
  const pendingEnvelopes = envelopes.filter((e) => e.status === "PENDIENTE");
  const totalLegacy = summaries.reduce((sum, s) => sum + s.legacyBalance, 0);

  return (
    <div className="p-6 space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">Caja fuerte</h1>
        <p className="text-sm text-on-surface-variant">
          Cada peso respaldado por un sobre identificable, desde el corte que lo originó hasta su retiro.
        </p>
      </div>

      {error && (
        <div className="bg-error/10 text-error text-sm rounded-md p-3 border border-error/30">
          {error}
        </div>
      )}

      {/* Resumen por sucursal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && <p className="text-outline text-sm">Cargando...</p>}
        {!loading &&
          summaries.map((s) => (
            <BranchSafeSummaryCard
              key={s.branchId}
              summary={s}
              selected={s.branchId === selectedBranchId}
              onSelect={() => setSelectedBranchId(s.branchId)}
            />
          ))}
      </div>

      {/* Sobres en caja fuerte de la sucursal seleccionada */}
      {selectedSummary && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-on-surface">
              Sobres en caja fuerte · {selectedSummary.branch}
            </h2>
            <span className="text-sm font-semibold text-on-surface-variant">
              Total: {formatCurrency(selectedSummary.balance)}
            </span>
          </div>

          {validEnvelopes.length === 0 ? (
            <Card><p className="text-sm text-on-surface-variant">Sin sobres con saldo en esta sucursal.</p></Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {validEnvelopes.map((env) => (
                <EnvelopeRow key={env.id} envelope={env} canWithdraw onChanged={refreshAll} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Sobres pendientes de recibir */}
      {pendingEnvelopes.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-bold text-on-surface">Sobres pendientes de recibir</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pendingEnvelopes.map((env) => (
              <PendingEnvelopeRow key={env.id} envelope={env} canReceive onChanged={refreshAll} />
            ))}
          </div>
        </section>
      )}

      {/* Retiro de saldo histórico -- se oculta sola cuando ya no queda nada */}
      {totalLegacy > 0.01 && (
        <LegacyWithdrawCard summaries={summaries} onDone={refreshAll} />
      )}

      {/* Historial / movimientos legado */}
      <section>
        <Card>
          <div className="flex flex-wrap items-end justify-between gap-3 p-4">
            <div>
              <h2 className="text-sm font-semibold text-on-surface-variant">Historial de movimientos</h2>
              <p className="mt-1 text-xs text-outline">Depósitos y retiros previos al sistema de sobres.</p>
            </div>
            <DateRangeCalendar
              from={movementDateFrom}
              to={movementDateTo}
              onFromChange={setMovementDateFrom}
              onToChange={setMovementDateTo}
            />
            <Button onClick={() => loadLegacyMovements()}>Filtrar</Button>
          </div>
        </Card>

        <Card className="mt-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-container-high text-on-surface-variant text-left">
                  <th className="px-4 py-3">Fecha/Hora</th>
                  <th className="px-4 py-3">Sucursal</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Nota</th>
                </tr>
              </thead>
              <tbody>
                {legacyMovements.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-outline">
                      Sin movimientos registrados.
                    </td>
                  </tr>
                )}
                {legacyMovements.map((m) => (
                  <tr key={m.id} className="border-outline-variant last:border-0 hover:bg-surface-container">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(m.createdAt)}</td>
                    <td className="px-4 py-3">{m.branch}</td>
                    <td className="px-4 py-3">{m.type === "DEPOSITO_SOBRE" ? "Depósito (sobre)" : "Retiro"}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${m.type === "DEPOSITO_SOBRE" ? "text-tertiary-fixed-dim" : "text-error"}`}>
                      {m.type === "DEPOSITO_SOBRE" ? "+" : "-"}{formatCurrency(m.amount)}
                    </td>
                    <td className="px-4 py-3">{m.user}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{m.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}

/**
 * El flujo legado (sucursal + monto, sin sobre) se conserva
 * intacto -- llama al mismo POST /api/cash-cuts/safe de siempre,
 * sin tocar ese archivo. Solo se le pone techo visual al saldo
 * legado real de cada sucursal, y desaparece solo cuando ya no
 * queda saldo legado en ninguna.
 */
function LegacyWithdrawCard({
  summaries,
  onDone,
}: {
  summaries: BranchSafeSummary[];
  onDone: () => void;
}) {
  const withLegacy = summaries.filter((s) => s.legacyBalance > 0.01);
  const [branchId, setBranchId] = useState(withLegacy[0]?.branchId ?? "");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selected = withLegacy.find((s) => s.branchId === branchId);

  async function handleRetiro() {
    setFormError(null);
    if (!branchId || !amount) {
      setFormError("Selecciona la sucursal y captura el monto.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/cash-cuts/safe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId, amount: Number(amount), notes: notes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo registrar el retiro");
      setAmount("");
      setNotes("");
      onDone();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <div className="p-1 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-on-surface-variant">Retiro de saldo histórico</h2>
          <p className="text-xs text-outline">
            Dinero acumulado antes del sistema de sobres, no ligado a ningún sobre individual. Se oculta solo cuando llegue a $0.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            className="min-w-[180px] rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none focus:border-primary"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            {withLegacy.map((s) => (
              <option key={s.branchId} value={s.branchId}>
                {s.branch} — {formatCurrency(s.legacyBalance)}
              </option>
            ))}
          </select>
          <input
            type="number"
            inputMode="decimal"
            placeholder="Monto"
            max={selected?.legacyBalance}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-32 rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none focus:border-primary"
          />
          <input
            placeholder="Nota (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-w-[160px] flex-1 rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none focus:border-primary"
          />
          <Button onClick={handleRetiro} disabled={submitting}>
            {submitting ? "Guardando..." : "Registrar retiro"}
          </Button>
        </div>

        {formError && <p className="text-error text-sm">{formError}</p>}
      </div>
    </Card>
  );
}
