"use client";

import { useMemo, useState, useTransition } from "react";
import {
  savePayrollSupplementRateAction,
  type PayrollWeekEmployee,
} from "@/app/actions/payroll";

type Props = {
  employees: PayrollWeekEmployee[];
  effectiveFrom: string;
};

const money = (value: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

export function PayrollSupplementTabulator({ employees, effectiveFrom }: Props) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const employee = employees.find((item) => item.id === employeeId) ?? employees[0];
  const [hourlyRate, setHourlyRate] = useState(String(employee?.hourlyRate ?? 40));
  const [percent, setPercent] = useState("12");
  const [weeklyHours, setWeeklyHours] = useState("40");
  const [message, setMessage] = useState("");
  const [saving, startTransition] = useTransition();

  const values = useMemo(() => {
    const base = Number(hourlyRate) || 0;
    const pct = Number(percent) || 0;
    const hours = Number(weeklyHours) || 0;
    const extra = base * (pct / 100);
    return {
      base,
      hours,
      aguinaldo: extra * 0.5,
      vacations: extra * 0.4,
      premium: extra * 0.1,
      extra,
      total: base + extra,
      weeklyTotal: (base + extra) * hours,
    };
  }, [hourlyRate, percent, weeklyHours]);

  function selectEmployee(value: string) {
    setEmployeeId(value);
    const next = employees.find((item) => item.id === value);
    if (next?.hourlyRate != null) setHourlyRate(String(next.hourlyRate));
  }

  function save() {
    if (!employee) return;
    setMessage("");
    startTransition(async () => {
      const result = await savePayrollSupplementRateAction({
        userId: employee.id,
        percent: Number(percent),
        effectiveFrom,
      });
      setMessage("success" in result ? "Tabulador guardado. La próxima nómina usará este porcentaje." : result.error);
    });
  }

  return (
    <Card className="border-primary/30 bg-primary/[0.04]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-on-surface">Tabulador de prestaciones</h2>
          <p className="mt-1 max-w-2xl text-xs text-on-surface-variant">
            Captura la tarifa base y el adicional contractual. El 12% de la propuesta se distribuye
            50% aguinaldo, 40% vacaciones y 10% prima vacacional.
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">
          Vigente desde {effectiveFrom}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <label className="text-xs font-semibold text-on-surface-variant">
          Empleado
          <select value={employeeId} onChange={(event) => selectEmployee(event.target.value)} className="mt-1 w-full rounded-lg border border-outline-variant bg-background px-2.5 py-2 text-sm text-on-surface">
            {employees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-on-surface-variant">
          Tarifa base por hora
          <input type="number" min="0" step="0.01" value={hourlyRate} onChange={(event) => setHourlyRate(event.target.value)} className="mt-1 w-full rounded-lg border border-outline-variant bg-background px-2.5 py-2 text-sm text-on-surface" />
        </label>
        <label className="text-xs font-semibold text-on-surface-variant">
          Adicional (%)
          <input type="number" min="0" max="100" step="0.01" value={percent} onChange={(event) => setPercent(event.target.value)} className="mt-1 w-full rounded-lg border border-outline-variant bg-background px-2.5 py-2 text-sm text-on-surface" />
        </label>
        <label className="text-xs font-semibold text-on-surface-variant">
          Horas semanales
          <input type="number" min="0" step="0.5" value={weeklyHours} onChange={(event) => setWeeklyHours(event.target.value)} className="mt-1 w-full rounded-lg border border-outline-variant bg-background px-2.5 py-2 text-sm text-on-surface" />
        </label>
      </div>

      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
        <div><span className="text-on-surface-variant">Aguinaldo / h</span><strong className="ml-2">{money(values.aguinaldo)}</strong></div>
        <div><span className="text-on-surface-variant">Vacaciones / h</span><strong className="ml-2">{money(values.vacations)}</strong></div>
        <div><span className="text-on-surface-variant">Prima / h</span><strong className="ml-2">{money(values.premium)}</strong></div>
        <div><span className="text-on-surface-variant">Adicional / h</span><strong className="ml-2">{money(values.extra)}</strong></div>
        <div><span className="text-on-surface-variant">Total / h</span><strong className="ml-2 text-primary">{money(values.total)}</strong></div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-on-surface-variant">
          Base semanal {money(values.base * values.hours)} · total semanal {money(values.weeklyTotal)}
        </p>
        <button type="button" onClick={save} disabled={saving || !employee} className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-on-primary disabled:opacity-50">
          {saving ? "Guardando..." : "Guardar tabulador"}
        </button>
      </div>
      {message && <p className="mt-2 text-xs font-semibold text-on-surface-variant">{message}</p>}
      <p className="mt-3 text-[11px] text-on-surface-variant">
        Referencia presupuestal contractual; no sustituye la conciliación legal de prestaciones.
      </p>
    </Card>
  );
}
