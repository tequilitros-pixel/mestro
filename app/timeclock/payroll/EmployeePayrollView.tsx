"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
} from "@/components/ui/icons";
import type { ApprovedPayrollHistoryItem } from "@/app/actions/employeePayrollHistory";
import { getEmployeeSelfWeekDetail } from "@/app/actions/employeeSelfPayroll";
import type { EmployeeSelfWeekDetail } from "@/app/actions/employeeSelfPayroll";
import type { PayrollDayDetail } from "@/app/actions/payroll";

export type EmployeePayrollSummary = {
  hourlyRate: number | null;
  hasOpenShift: boolean;
  todayHours: number;
  weekHours: number;
  todayPay: number | null;
  weekPay: number | null;
};

function formatHours(hours: number) {
  const minutes = Math.max(0, Math.round(hours * 60));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);
}

function formatWeek(weekStart: string, weekEnd: string) {
  const formatter = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${formatter.format(new Date(`${weekStart}T12:00:00.000Z`))} – ${formatter.format(
    new Date(`${weekEnd}T12:00:00.000Z`),
  )}`;
}

function formatApprovalDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Mexico_City",
  }).format(new Date(value));
}

/** Devuelve el lunes de la semana que contiene `dateStr` (YYYY-MM-DD). */
function mondayOfWeekLocal(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Devuelve la fecha de hoy en YYYY-MM-DD (UTC). */
function todayLocal(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Añade `days` días a una fecha YYYY-MM-DD. */
function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── Incident label helpers ───────────────────────────────────────────────────

const INCIDENT_LABELS: Record<NonNullable<PayrollDayDetail["incident"]>, string> = {
  SIN_SALIDA: "Sin salida",
  SIN_TURNO: "Sin turno",
  TURNO_NO_TRABAJADO: "No trabajado",
  LLEGADA_TARDE: "Llegada tarde",
  SALIDA_ANTICIPADA: "Salida anticipada",
};

/** Clases de color por tipo de incidencia. */
function incidentClass(incident: PayrollDayDetail["incident"]): string {
  if (!incident) return "";
  if (incident === "SIN_SALIDA" || incident === "TURNO_NO_TRABAJADO") {
    return "text-error";
  }
  return "text-secondary"; // SIN_TURNO, LLEGADA_TARDE, SALIDA_ANTICIPADA
}

/** Formatea un ISO timestamp como "HH:MM" en hora de México. */
function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Mexico_City",
  }).format(new Date(iso));
}

/** Formatea una fecha YYYY-MM-DD como "Lun 21 oct". */
function fmtDayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(d);
}

// ─── Weekly detail tab ────────────────────────────────────────────────────────

function WeeklyDetailTab() {
  const [weekStart, setWeekStart] = useState<string>(() =>
    mondayOfWeekLocal(todayLocal()),
  );
  const [detail, setDetail] = useState<EmployeeSelfWeekDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (monday: string) => {
    try {
      const result = await getEmployeeSelfWeekDetail(monday);
      if (result.success) {
        setDetail(result.data);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Error al cargar los datos. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(weekStart);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [weekStart, load]);

  const currentWeekMonday = mondayOfWeekLocal(todayLocal());
  const isCurrentWeek = weekStart === currentWeekMonday;

  function goBack() {
    setError(null);
    setWeekStart((prev) => addDays(prev, -7));
  }

  function goForward() {
    if (!isCurrentWeek) {
      setError(null);
      setWeekStart((prev) => addDays(prev, 7));
    }
  }

  return (
    <div className="space-y-4">
      {/* Week navigator */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={loading}
          aria-label="Ver semana anterior"
          className="rounded-xl border border-outline-variant p-2 text-on-surface transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <p className="text-center text-sm font-bold text-on-surface">
          {detail
            ? formatWeek(detail.weekStart, detail.weekEnd)
            : loading
              ? "Cargando…"
              : "—"}
        </p>
        <button
          type="button"
          onClick={goForward}
          disabled={isCurrentWeek || loading}
          aria-label="Ver semana siguiente"
          className="rounded-xl border border-outline-variant p-2 text-on-surface transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Error state */}
      {error && (
        <p className="rounded-xl border border-error/40 bg-error/10 p-4 text-sm text-error">
          {error}
        </p>
      )}

      {/* Loading skeleton */}
      {loading && !detail && (
        <div className="space-y-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl bg-surface-container"
            />
          ))}
        </div>
      )}

      {/* Day list */}
      {detail && (
        <>
          <div className="space-y-2">
            {detail.days.map((day) => (
              <DayRow key={day.date} day={day} />
            ))}
          </div>

          {/* Week total */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container px-4 py-3">
            <div>
              <p className="text-xs text-on-surface-variant">Horas trabajadas</p>
              <p className="text-sm font-bold text-on-surface">{formatHours(detail.totalHours)}</p>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5">
                <p className="text-xs text-on-surface-variant">Pago de la semana</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    detail.status === "PAGADA"
                      ? "bg-primary/15 text-primary"
                      : detail.status === "APROBADA"
                        ? "bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim"
                        : "bg-secondary/15 text-secondary"
                  }`}
                >
                  {detail.status === "PAGADA"
                    ? "Pagada"
                    : detail.status === "APROBADA"
                      ? "Aprobada"
                      : "Calculado"}
                </span>
              </div>
              <p className="text-base font-bold text-primary">
                {detail.totalPay === null ? "Sin tarifa" : formatCurrency(detail.totalPay)}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Fila individual de un día en la vista de semana. */
function DayRow({ day }: { day: PayrollDayDetail }) {
  const isRestDay = !day.scheduled && !day.actual;

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        isRestDay
          ? "border-outline-variant/50 bg-surface-container/50"
          : "border-outline-variant bg-surface-container"
      }`}
    >
      {/* Header row: date + incident badge */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold capitalize text-on-surface">
          {fmtDayLabel(day.date)}
        </p>
        {day.incident && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
              day.justified
                ? "bg-on-surface-variant/10 text-on-surface-variant line-through"
                : day.incident === "SIN_SALIDA" || day.incident === "TURNO_NO_TRABAJADO"
                  ? "bg-error/10 text-error"
                  : "bg-secondary/10 text-secondary"
            }`}
          >
            {INCIDENT_LABELS[day.incident]}
            {day.justified && " ✓"}
          </span>
        )}
      </div>

      {/* Detail grid */}
      {!isRestDay && (
        <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
          {/* Scheduled shift */}
          <div>
            <p className="font-semibold text-on-surface-variant">Turno</p>
            {day.scheduled ? (
              <>
                <p className="text-on-surface">{day.scheduled.branchName}</p>
                <p className="text-on-surface-variant">
                  {day.scheduled.startTime} – {day.scheduled.endTime}
                </p>
              </>
            ) : (
              <p className="text-on-surface-variant">Sin turno</p>
            )}
          </div>

          {/* Actual clock-in/out */}
          <div>
            <p className="font-semibold text-on-surface-variant">Entrada / Salida</p>
            <p className="text-on-surface">
              {fmtTime(day.actual?.clockIn)} / {fmtTime(day.actual?.clockOut)}
            </p>
            {day.actual && (
              <p className="text-on-surface-variant">{day.actual.branchName}</p>
            )}
          </div>

          {/* Hours worked */}
          <div className="text-right">
            <p className="font-semibold text-on-surface-variant">Horas</p>
            <p className={`text-on-surface ${day.hoursWorked === 0 && day.scheduled ? incidentClass(day.incident) : ""}`}>
              {day.hoursWorked > 0 ? formatHours(day.hoursWorked) : "—"}
            </p>
          </div>
        </div>
      )}

      {/* Rest day label */}
      {isRestDay && (
        <p className="mt-0.5 text-xs text-on-surface-variant">Día de descanso</p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EmployeePayrollView({
  userName,
  summary,
  history,
  initialTab = "RESUMEN",
}: {
  userName: string;
  summary: EmployeePayrollSummary | { error: string };
  history: ApprovedPayrollHistoryItem[] | { error: string };
  initialTab?: "RESUMEN" | "PAGOS" | "SEMANA";
}) {
  const approvedHistory = "error" in history ? [] : history;
  const [activeTab, setActiveTab] = useState<"RESUMEN" | "PAGOS" | "SEMANA">(initialTab);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string | null>(() => approvedHistory[0]?.weekStart ?? null);
  const selectedPayment = approvedHistory.find((p) => p.weekStart === selectedWeekStart) ?? approvedHistory[0] ?? null;

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          href="/timeclock"
          className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-on-surface"
        >
          <ChevronLeftIcon className="h-4 w-4" /> Volver al checador
        </Link>

        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Trabajador</p>
          <h1 className="mt-1 text-3xl font-bold">Mi nómina</h1>
          <p className="mt-1 text-sm text-on-surface-variant">{userName} · horas y pago de la semana</p>
        </div>

        <div className="inline-flex w-full rounded-2xl border border-outline-variant bg-surface-container p-1 sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab("RESUMEN")}
            aria-pressed={activeTab === "RESUMEN"}
            className={`min-w-28 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              activeTab === "RESUMEN"
                ? "bg-primary text-on-primary shadow"
                : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            }`}
          >
            Resumen
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("SEMANA")}
            aria-pressed={activeTab === "SEMANA"}
            className={`min-w-28 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              activeTab === "SEMANA"
                ? "bg-primary text-on-primary shadow"
                : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            }`}
          >
            Semana
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("PAGOS")}
            aria-pressed={activeTab === "PAGOS"}
            className={`min-w-28 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              activeTab === "PAGOS"
                ? "bg-primary text-on-primary shadow"
                : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            }`}
          >
            Pagos
          </button>
        </div>

        {activeTab === "RESUMEN" && (
          <>
            {"error" in summary ? (
              <p className="rounded-xl border border-error/40 bg-error/10 p-4 text-sm text-error">{summary.error}</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Card highlight>
                    <CardLabel>Hoy</CardLabel>
                    <CardValue>{formatHours(summary.todayHours)}</CardValue>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {summary.todayPay === null ? "Sin tarifa" : formatCurrency(summary.todayPay)}
                    </p>
                  </Card>
                  <Card>
                    <CardLabel>Esta semana</CardLabel>
                    <CardValue>{formatHours(summary.weekHours)}</CardValue>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {summary.weekPay === null ? "Sin tarifa" : formatCurrency(summary.weekPay)}
                    </p>
                  </Card>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/timeclock/calendar"
                    className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-sm font-semibold hover:border-primary/40"
                  >
                    <CalendarIcon className="h-4 w-4" /> Mi horario
                  </Link>
                  <Link
                    href="/timeclock/hours"
                    className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-sm font-semibold hover:border-primary/40"
                  >
                    <ClockIcon className="h-4 w-4" /> Horas trabajadas
                  </Link>
                </div>

                <p className="text-xs text-on-surface-variant">
                  {summary.hasOpenShift
                    ? "Tienes un turno abierto; el tiempo actual ya está incluido en el estimado."
                    : "La semana se calcula con tus entradas y salidas registradas."}
                  {summary.hourlyRate === null && " Falta configurar tu tarifa para calcular el pago."}
                </p>
              </>
            )}
          </>
        )}

        {activeTab === "SEMANA" && <WeeklyDetailTab />}

        {activeTab === "PAGOS" && (
          <Card>
            <CardLabel>Historial de nómina y pagos</CardLabel>
            <p className="mt-1 text-sm text-on-surface-variant">
              Consulta cuánto se te pagó la semana pasada, antepasada y en semanas anteriores.
            </p>

            {"error" in history ? (
              <p className="mt-4 rounded-xl border border-error/40 bg-error/10 p-3 text-sm text-error">{history.error}</p>
            ) : approvedHistory.length === 0 ? (
              <div className="mt-4 rounded-xl bg-surface-container p-6 text-center">
                <p className="text-sm font-semibold text-on-surface">No se encontraron semanas en el historial</p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Puedes consultar tus horas registradas en la pestaña &ldquo;Semana&rdquo;.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("SEMANA")}
                  className="mt-3 inline-flex items-center rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary shadow"
                >
                  Ver mis horas por semana →
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {approvedHistory.map((item) => {
                  const isSelected = selectedPayment?.weekStart === item.weekStart;
                  return (
                    <div
                      key={item.weekStart}
                      onClick={() => setSelectedWeekStart(item.weekStart)}
                      className={`cursor-pointer rounded-2xl border p-4 transition ${
                        isSelected
                          ? "border-primary/50 bg-primary/5 shadow-sm"
                          : "border-outline-variant bg-surface-container hover:border-primary/30"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-on-surface">
                            {formatWeek(item.weekStart, item.weekEnd)}
                          </p>
                          <p className="mt-0.5 text-xs text-on-surface-variant">
                            {formatHours(item.totalHours)}
                            {item.regularHours > 0 && ` (${item.regularHours.toFixed(1)}h reg.`}
                            {item.overtimeHours > 0 && ` · ${item.overtimeHours.toFixed(1)}h extra`}
                            {item.regularHours > 0 && ")"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-primary">
                            {formatCurrency(item.totalPay)}
                          </p>
                          <span
                            className={`inline-block mt-0.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                              item.status === "PAGADA"
                                ? "bg-primary/15 text-primary"
                                : item.status === "APROBADA"
                                  ? "bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim"
                                  : "bg-secondary/15 text-secondary"
                            }`}
                          >
                            {item.status === "PAGADA"
                              ? "Pagada"
                              : item.status === "APROBADA"
                                ? "Aprobada"
                                : "Pendiente de corte"}
                          </span>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="mt-3 border-t border-outline-variant/60 pt-3 text-xs text-on-surface-variant">
                          <p>
                            {item.status === "PAGADA" && item.paidAt
                              ? `Pagada el ${formatApprovalDate(item.paidAt)}`
                              : item.status === "APROBADA" && item.approvedAt
                                ? `Aprobada el ${formatApprovalDate(item.approvedAt)}`
                                : item.status === "PENDIENTE"
                                  ? "Horas calculadas según checador; el monto final se confirmará al aprobar la nómina."
                                  : "Aprobada"}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}
      </div>
    </main>
  );
}
