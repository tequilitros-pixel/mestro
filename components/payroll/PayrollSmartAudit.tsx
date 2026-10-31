"use client";

import { useMemo, useState } from "react";
import type { PayrollWeekTable, PayrollWeekEmployee } from "@/app/actions/payroll";

function money(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
}

function hours(value: number) {
  const totalMinutes = Math.max(0, Math.round(value * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export type PayrollAlert = {
  id: string;
  type: "danger" | "warning" | "info" | "success";
  title: string;
  description: string;
  count: number;
  employees: { id: string; name: string; detail: string }[];
};

export function PayrollSmartAudit({
  table,
  onFilterEmployee,
}: {
  table: PayrollWeekTable;
  onFilterEmployee?: (name: string) => void;
}) {
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);

  const alerts = useMemo<PayrollAlert[]>(() => {
    const list: PayrollAlert[] = [];
    const activeWithHours = table.employees.filter((e) => e.totalHours > 0);

    // 1. Alerta: Sin tarifa o tarifa en $0
    const missingRateEmps = activeWithHours.filter((e) => e.missingRate || (e.hourlyRate !== null && e.hourlyRate <= 0));
    if (missingRateEmps.length > 0) {
      list.push({
        id: "missing-rate",
        type: "danger",
        title: "Tarifa por hora no configurada",
        description: "Colaboradores con turnos laborados pero sin salario base asignado.",
        count: missingRateEmps.length,
        employees: missingRateEmps.map((e) => ({
          id: e.id,
          name: e.name,
          detail: `${hours(e.totalHours)} registradas sin cuota horaria`,
        })),
      });
    }

    // 2. Alerta: Jornadas menores a 40 horas ordinarias
    const shortHoursEmps = activeWithHours.filter((e) => e.totalHours < 40);
    if (shortHoursEmps.length > 0) {
      list.push({
        id: "short-hours",
        type: "warning",
        title: "Jornada semanal menor a 40 horas",
        description: "Trabajadores con menos del tiempo convenido de 40 hrs semanales.",
        count: shortHoursEmps.length,
        employees: shortHoursEmps.map((e) => ({
          id: e.id,
          name: e.name,
          detail: `${hours(e.totalHours)} trabajadas (faltan ${hours(Math.max(0, 40 - e.totalHours))})`,
        })),
      });
    }

    // 3. Alerta: Jornadas mayores a 48 horas (tiempo extra considerable)
    const overtimeEmps = activeWithHours.filter((e) => e.totalHours > 48);
    if (overtimeEmps.length > 0) {
      list.push({
        id: "overtime",
        type: "info",
        title: "Horas extendidas (> 48 horas)",
        description: "Colaboradores con tiempo adicional por encima de la jornada máxima legal.",
        count: overtimeEmps.length,
        employees: overtimeEmps.map((e) => ({
          id: e.id,
          name: e.name,
          detail: `${hours(e.totalHours)} totales (${hours(e.totalHours - 48)} extras)`,
        })),
      });
    }

    // 4. Alerta: Recibos pendientes de firma digital en semanas aprobadas o pagadas
    if (table.period.status === "APROBADA" || table.period.status === "PAGADA") {
      const unsignedEmps = activeWithHours.filter((e) => !e.signature?.signedAt);
      if (unsignedEmps.length > 0) {
        list.push({
          id: "unsigned",
          type: "warning",
          title: "Recibos sin firma de conformidad",
          description: "Colaboradores que aún no han estampado su firma digital en el recibo.",
          count: unsignedEmps.length,
          employees: unsignedEmps.map((e) => ({
            id: e.id,
            name: e.name,
            detail: "Pendiente de firma en su portal móvil",
          })),
        });
      } else if (activeWithHours.length > 0) {
        list.push({
          id: "all-signed",
          type: "success",
          title: "100% de recibos firmados",
          description: "Todos los colaboradores han firmado su recibo digital de conformidad.",
          count: activeWithHours.length,
          employees: [],
        });
      }
    }

    return list;
  }, [table]);

  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-50/50 p-3.5 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
        <span className="text-lg">✨</span>
        <div className="text-xs">
          <p className="font-bold">Auditoría inteligente en orden</p>
          <p className="text-emerald-700 dark:text-emerald-400">Todos los colaboradores cumplen con la jornada de 40 hrs y tarifas verificadas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-2xl border border-outline-variant bg-surface-container p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">⚡</span>
          <h3 className="text-xs font-black uppercase tracking-wider text-on-surface">
            Auditoría Inteligente de Nómina
          </h3>
        </div>
        <span className="text-[11px] font-semibold text-outline">
          {alerts.length} {alerts.length === 1 ? "observación detectada" : "observaciones detectadas"}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {alerts.map((alert) => {
          const isExpanded = expandedAlertId === alert.id;
          const toneStyles =
            alert.type === "danger"
              ? "border-error/40 bg-error/10 text-error"
              : alert.type === "warning"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
              : alert.type === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
              : "border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-300";

          return (
            <div
              key={alert.id}
              className={`flex flex-col justify-between rounded-xl border p-2.5 transition-all ${toneStyles}`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold leading-tight">{alert.title}</span>
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-surface px-1.5 text-[10px] font-black shadow-xs">
                    {alert.count}
                  </span>
                </div>
                <p className="mt-1 text-[11px] opacity-85 leading-tight">{alert.description}</p>
              </div>

              {alert.employees.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-current/15">
                  <button
                    type="button"
                    onClick={() => setExpandedAlertId(isExpanded ? null : alert.id)}
                    className="flex w-full items-center justify-between text-[10px] font-bold uppercase tracking-wider underline hover:opacity-80"
                  >
                    <span>{isExpanded ? "Ocultar colaboradores" : "Ver colaboradores"}</span>
                    <span>{isExpanded ? "▲" : "▼"}</span>
                  </button>

                  {isExpanded && (
                    <ul className="mt-2 space-y-1.5 max-h-40 overflow-y-auto pr-1 text-xs">
                      {alert.employees.map((emp) => (
                        <li
                          key={emp.id}
                          className="flex items-center justify-between gap-2 rounded-lg bg-surface/80 p-1.5 shadow-xs"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-on-surface">{emp.name}</p>
                            <p className="text-[10px] text-on-surface-variant">{emp.detail}</p>
                          </div>
                          {onFilterEmployee && (
                            <button
                              type="button"
                              onClick={() => onFilterEmployee(emp.name)}
                              className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary hover:bg-primary/20"
                            >
                              Revisar
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
