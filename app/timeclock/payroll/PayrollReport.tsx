"use client";

import { useEffect, useState } from "react";
import {
  getWeeklyPayrollReport,
  getMyAccessibleBranchesForPayroll,
} from "@/app/actions/timeclock";
import { mondayOfWeek, todayDateOnly } from "@/lib/dateOnly";

type Branch = { id: string; name: string };
type SummaryRow = {
  userId: string;
  name: string;
  hourlyRate: number | null;
  branchName: string;
  totalHours: number;
  totalPay: number | null;
  shifts: number;
};

function getMostRecentMonday() {
  return mondayOfWeek(todayDateOnly());
}

export default function PayrollReport() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [weekStart, setWeekStart] = useState(getMostRecentMonday());
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    const [branchList, report] = await Promise.all([
      getMyAccessibleBranchesForPayroll(),
      getWeeklyPayrollReport(weekStart, branchId || undefined),
    ]);

    setBranches(branchList);

    if ("error" in report) {
      setError(report.error ?? "Error desconocido");
      setSummary([]);
      setGrandTotal(0);
    } else {
      setSummary(report.summary);
      setGrandTotal(report.grandTotal);
    }

    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, branchId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-outline-variant bg-surface-container p-6">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">Semana (lunes)</span>
          <input
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            className="rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          />
        </label>

        {branches.length > 1 && (
          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface-variant">Sucursal</span>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            >
              <option value="">Todas mis sucursales</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-error/40 bg-error/10 p-4 text-sm text-error">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-center text-on-surface-variant">Cargando...</p>
      ) : (
        <>
          <div className="rounded-2xl border border-outline-variant bg-surface-container">
            <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 border-b border-outline-variant px-4 py-3 text-xs font-medium text-outline md:grid">
              <span>Trabajador</span>
              <span>Sucursal</span>
              <span>Turnos</span>
              <span>Horas</span>
              <span>Pago</span>
            </div>

            {summary.length === 0 && (
              <p className="p-6 text-sm text-on-surface-variant">
                Sin turnos confirmados en esta semana.
              </p>
            )}

            {summary.map((row) => (
              <div
                key={`${row.userId}-${row.branchName}`}
                className="grid gap-2 border-b border-outline-variant px-4 py-3 last:border-b-0 md:grid-cols-[2fr_1fr_1fr_1fr_1fr] md:items-center"
              >
                <span className="font-medium text-on-surface">{row.name}</span>
                <span className="text-sm text-on-surface-variant">{row.branchName}</span>
                <span className="text-sm text-on-surface-variant">{row.shifts}</span>
                <span className="text-sm text-on-surface-variant">
                  {row.totalHours.toFixed(1)} h
                </span>
                <span className="text-sm font-semibold text-tertiary-fixed-dim">
                  {row.totalPay !== null
                    ? `$${row.totalPay.toFixed(2)}`
                    : "Falta tarifa"}
                </span>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-outline-variant bg-surface-container p-6">
            <p className="text-sm text-on-surface-variant">Total de la semana</p>
            <p className="mt-1 text-3xl font-bold text-tertiary-fixed-dim">
              ${grandTotal.toFixed(2)}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
