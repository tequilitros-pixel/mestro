"use client";

import { useEffect, useState, startTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface SafeBalance {
  branchId: string;
  branch: string;
  balance: number;
  totalDeposits: number;
  totalWithdrawals: number;
}

interface SafeMovement {
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

export default function SafePage() {
  const [balances, setBalances] = useState<SafeBalance[]>([]);
  const [movements, setMovements] = useState<SafeMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [branchId, setBranchId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [balancesRes, movementsRes] = await Promise.all([
        fetch("/api/cash-cuts/safe"),
        fetch("/api/cash-cuts/safe/movements"),
      ]);
      if (!balancesRes.ok || !movementsRes.ok) {
        throw new Error("No se pudo cargar la caja fuerte");
      }
      const balancesData: SafeBalance[] = await balancesRes.json();
      const movementsData: SafeMovement[] = await movementsRes.json();

      startTransition(() => {
        setBalances(balancesData);
        setMovements(movementsData);
        setLoading(false);
      });
    } catch (err) {
      startTransition(() => {
        setError(err instanceof Error ? err.message : "Error desconocido");
        setLoading(false);
      });
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

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
        body: JSON.stringify({
          branchId,
          amount: Number(amount),
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo registrar el retiro");

      setAmount("");
      setNotes("");
      await loadAll();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">Caja fuerte</h1>
        <p className="text-sm text-on-surface-variant">
          Saldo acumulado por sucursal, depósitos automáticos desde sobres, y retiros.
        </p>
      </div>

      {error && (
        <div className="bg-error/10 text-error text-sm rounded-md p-3 border border-error/30">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && <p className="text-outline text-sm">Cargando...</p>}
        {!loading &&
          balances.map((b) => (
            <Card key={b.branchId}>
              <div className="p-4">
                <div className="text-sm text-on-surface-variant">{b.branch}</div>
                <div className="text-2xl font-bold text-on-surface">
                  {formatCurrency(b.balance)}
                </div>
                <div className="text-xs text-outline mt-1">
                  Depósitos: {formatCurrency(b.totalDeposits)} · Retiros:{" "}
                  {formatCurrency(b.totalWithdrawals)}
                </div>
              </div>
            </Card>
          ))}
      </div>

      <Card>
        <div className="p-4 space-y-3">
          <h2 className="text-sm font-semibold text-on-surface-variant">Registrar retiro</h2>

          <div className="flex flex-wrap gap-3">
            <select
              className="min-w-[180px] rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              <option value="">Selecciona sucursal</option>
              {balances.map((b) => (
                <option key={b.branchId} value={b.branchId}>
                  {b.branch}
                </option>
              ))}
            </select>

            <input
              type="number"
              inputMode="decimal"
              placeholder="Monto"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-32 rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
            />

            <input
              placeholder="Nota (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-w-[160px] flex-1 rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
            />

            <Button onClick={handleRetiro} disabled={submitting}>
              {submitting ? "Guardando..." : "Registrar retiro"}
            </Button>
          </div>

          {formError && <p className="text-error text-sm">{formError}</p>}
        </div>
      </Card>

      <Card>
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
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-outline">
                    Cargando...
                  </td>
                </tr>
              )}
              {!loading && movements.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-outline">
                    Sin movimientos registrados.
                  </td>
                </tr>
              )}
              {!loading &&
                movements.map((m) => (
                  <tr key={m.id} className="border-outline-variant last:border-0 hover:bg-surface-container">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDateTime(m.createdAt)}
                    </td>
                    <td className="px-4 py-3">{m.branch}</td>
                    <td className="px-4 py-3">
                      {m.type === "DEPOSITO_SOBRE" ? "Depósito (sobre)" : "Retiro"}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        m.type === "DEPOSITO_SOBRE" ? "text-tertiary-fixed-dim" : "text-error"
                      }`}
                    >
                      {m.type === "DEPOSITO_SOBRE" ? "+" : "-"}
                      {formatCurrency(m.amount)}
                    </td>
                    <td className="px-4 py-3">{m.user}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{m.notes || "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
