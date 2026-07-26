"use client";

import { useEffect, useState, startTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface Branch {
  id: string;
  name: string;
}

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <h1 className="text-2xl font-bold text-navy-900">Caja fuerte</h1>
        <p className="text-sm text-gray-500">
          Saldo acumulado por sucursal, depósitos automáticos desde sobres, y retiros.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-md p-3 border border-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && <p className="text-gray-400 text-sm">Cargando...</p>}
        {!loading &&
          balances.map((b) => (
            <Card key={b.branchId}>
              <div className="p-4">
                <div className="text-sm text-gray-500">{b.branch}</div>
                <div className="text-2xl font-bold text-navy-900">
                  {formatCurrency(b.balance)}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Depósitos: {formatCurrency(b.totalDeposits)} · Retiros:{" "}
                  {formatCurrency(b.totalWithdrawals)}
                </div>
              </div>
            </Card>
          ))}
      </div>

      <Card>
        <div className="p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-600">Registrar retiro</h2>

          <div className="flex flex-wrap gap-3">
            <select
              className="border rounded-md px-3 py-2 text-sm min-w-[180px]"
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
              className="border rounded-md px-3 py-2 text-sm w-32"
            />

            <input
              placeholder="Nota (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm flex-1 min-w-[160px]"
            />

            <Button onClick={handleRetiro} disabled={submitting}>
              {submitting ? "Guardando..." : "Registrar retiro"}
            </Button>
          </div>

          {formError && <p className="text-red-600 text-sm">{formError}</p>}
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy-900 text-white text-left">
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
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                    Cargando...
                  </td>
                </tr>
              )}
              {!loading && movements.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                    Sin movimientos registrados.
                  </td>
                </tr>
              )}
              {!loading &&
                movements.map((m) => (
                  <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDateTime(m.createdAt)}
                    </td>
                    <td className="px-4 py-3">{m.branch}</td>
                    <td className="px-4 py-3">
                      {m.type === "DEPOSITO_SOBRE" ? "Depósito (sobre)" : "Retiro"}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        m.type === "DEPOSITO_SOBRE" ? "text-green-700" : "text-red-600"
                      }`}
                    >
                      {m.type === "DEPOSITO_SOBRE" ? "+" : "-"}
                      {formatCurrency(m.amount)}
                    </td>
                    <td className="px-4 py-3">{m.user}</td>
                    <td className="px-4 py-3 text-gray-500">{m.notes || "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
