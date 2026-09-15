"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardLabel } from "@/components/ui/Card";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  AlertIcon,
  PlusIcon,
  TrashIcon,
  LockIcon,
  CheckIcon,
  RefreshIcon,
  SearchIcon,
} from "@/components/ui/icons";
import {
  getPayrollWeekTable,
  getPayrollWeekHistoryAction,
  getEmployeePayrollDetail,
  createPayrollAdjustmentAction,
  deletePayrollAdjustmentAction,
  submitPayrollPeriodAction,
  approvePayrollPeriodAction,
  markPayrollPeriodPaidAction,
  reopenPayrollPeriodAction,
  justifyIncidentAction,
  unjustifyIncidentAction,
  type PayrollWeekTable,
  type PayrollEmployeeDetail,
  type PayrollPeriodInfo,
  type PayrollWeekHistoryItem,
} from "@/app/actions/payroll";
import {
  createManualTimeClockEntryAction,
  updateManualTimeClockEntryAction,
  deleteManualTimeClockEntryAction,
} from "@/app/actions/timeclock";
import {
  addDaysToDateOnly,
  mondayOfWeek,
  parseDateOnly,
  todayDateOnly,
} from "@/lib/dateOnly";
import { useToast } from "@/components/ui/Toast";

const STATUS_LABELS: Record<PayrollPeriodInfo["status"], string> = {
  BORRADOR: "Borrador",
  REVISION: "En revisión",
  APROBADA: "Aprobada",
  PAGADA: "Pagada",
};

const STATUS_TONE: Record<PayrollPeriodInfo["status"], string> = {
  BORRADOR: "bg-surface-container-high text-on-surface-variant",
  REVISION: "bg-secondary/15 text-secondary",
  APROBADA: "bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim",
  PAGADA: "bg-primary/15 text-primary",
};

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const INCIDENT_LABELS: Record<NonNullable<PayrollEmployeeDetail["days"][number]["incident"]>, string> = {
  SIN_SALIDA: "Sin salida registrada",
  SIN_TURNO: "Trabajó sin turno programado",
  TURNO_NO_TRABAJADO: "Turno programado, no se presentó",
  LLEGADA_TARDE: "Llegada tarde",
  SALIDA_ANTICIPADA: "Salida anticipada",
};

const INCIDENT_TONE: Record<
  NonNullable<PayrollEmployeeDetail["days"][number]["incident"]>,
  "danger" | "warning"
> = {
  SIN_SALIDA: "danger",
  SIN_TURNO: "warning",
  TURNO_NO_TRABAJADO: "danger",
  LLEGADA_TARDE: "warning",
  SALIDA_ANTICIPADA: "warning",
};

function money(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
}

function hours(value: number) {
  const totalMinutes = Math.max(0, Math.round(value * 60));
  return `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

function formatWeekRange(weekStart: string) {
  const start = parseDateOnly(weekStart);
  const end = parseDateOnly(addDaysToDateOnly(weekStart, 6));
  const fmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", timeZone: "UTC" });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

function formatPaymentDate(weekStart: string) {
  const paymentDate = parseDateOnly(addDaysToDateOnly(weekStart, 7));
  return new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(paymentDate);
}

function initialPayrollWeek() {
  const today = todayDateOnly();
  const currentMonday = mondayOfWeek(today);
  return today === currentMonday ? addDaysToDateOnly(currentMonday, -7) : currentMonday;
}

function formatDayLabel(dateStr: string) {
  const fmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });
  return fmt.format(parseDateOnly(dateStr));
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Mexico_City",
  }).format(new Date(iso));
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Mexico_City",
  }).format(new Date(iso));
}

function toDateTimeLocalInput(dateTime: string) {
  const date = new Date(dateTime);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildDateTimeFromDay(date: string, hour: string) {
  const [hh, mm] = hour.split(":");
  const parsedDate = new Date(`${date}T${hh}:${mm}`);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString();
}

type EditableEntryDraft = {
  entryId: string;
  date: string;
  branchId: string;
  clockIn: string;
  clockOut: string;
};

export default function PayrollWeekView() {
  const { showToast } = useToast();
  const [weekStart, setWeekStart] = useState(() => initialPayrollWeek());
  const [table, setTable] = useState<PayrollWeekTable | null>(null);
  const [history, setHistory] = useState<PayrollWeekHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionBusy, setActionBusy] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    getPayrollWeekTable(weekStart).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setError(result.error);
        setTable(null);
      } else {
        setError(null);
        setTable(result.data);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [weekStart, refreshKey]);

  useEffect(() => {
    getPayrollWeekHistoryAction().then((result) => {
      if ("success" in result) setHistory(result.data);
    });
  }, [refreshKey]);

  async function handlePeriodAction(
    action: (weekStart: string) => Promise<{ error?: string; success?: boolean }>,
    successMessage: string,
  ) {
    setActionBusy(true);
    try {
      const result = await action(weekStart);
      if (result?.error) {
        showToast(result.error, "error");
      } else {
        showToast(successMessage, "success");
        setRefreshKey((k) => k + 1);
      }
    } catch (actionError) {
      showToast(actionError instanceof Error ? actionError.message : "No se pudo completar la acción", "error");
    } finally {
      setActionBusy(false);
    }
  }

  async function approveWeek() {
    if (!table) return;
    const accepted = confirm(
      `Estás a punto de aprobar la nómina del ${formatWeekRange(table.weekStart)}.\n\nUna vez aprobada, los registros de esta semana quedarán bloqueados.`,
    );
    if (!accepted) return;
    await handlePeriodAction(approvePayrollPeriodAction, "Nómina semanal aprobada");
  }

  async function reopenWeek() {
    const reason = prompt("Motivo obligatorio para reabrir este periodo:");
    if (!reason?.trim()) {
      showToast("Debes escribir el motivo de reapertura", "error");
      return;
    }
    setActionBusy(true);
    try {
      const result = await reopenPayrollPeriodAction(weekStart, reason.trim());
      if (result?.error) showToast(result.error, "error");
      else {
        showToast("Semana reabierta", "success");
        setRefreshKey((key) => key + 1);
      }
    } catch (actionError) {
      showToast(actionError instanceof Error ? actionError.message : "No se pudo reabrir la semana", "error");
    } finally {
      setActionBusy(false);
    }
  }

  const visibleEmployees = useMemo(() => {
    if (!table) return [];
    const query = search.trim().toLocaleLowerCase("es-MX");
    return query
      ? table.employees.filter((employee) => employee.name.toLocaleLowerCase("es-MX").includes(query))
      : table.employees;
  }, [search, table]);

  const historyOptions = useMemo(() => {
    const options = new Map<string, PayrollWeekHistoryItem>();
    options.set(weekStart, {
      weekStart,
      paymentDate: addDaysToDateOnly(weekStart, 7),
      status: table?.period.status ?? "BORRADOR",
    });
    for (const item of history) options.set(item.weekStart, item);
    return Array.from(options.values()).sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  }, [history, table, weekStart]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface-container p-1.5">
          <button
            type="button"
            title="Semana anterior"
            onClick={() => setWeekStart((w) => addDaysToDateOnly(w, -7))}
            className="rounded-xl p-2 text-on-surface-variant hover:bg-surface-container-high"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <span className="min-w-[180px] text-center text-sm font-bold text-on-surface">
            {formatWeekRange(weekStart)}
          </span>
          <button
            type="button"
            title="Semana siguiente"
            onClick={() => setWeekStart((w) => addDaysToDateOnly(w, 7))}
            className="rounded-xl p-2 text-on-surface-variant hover:bg-surface-container-high"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setWeekStart(initialPayrollWeek())}
          className="rounded-xl border border-outline-variant px-3 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-container-high"
        >
          Semana actual
        </button>
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-[11px] font-bold uppercase tracking-wide text-outline sm:flex-none">
          Lunes de pago
          <select
            value={weekStart}
            onChange={(event) => setWeekStart(event.target.value)}
            className="rounded-xl border border-outline-variant bg-surface px-3 py-2 text-xs font-semibold normal-case tracking-normal text-on-surface"
          >
            {historyOptions.map((item) => (
              <option key={item.weekStart} value={item.weekStart}>
                {formatDayLabel(item.paymentDate)} · {STATUS_LABELS[item.status]}
              </option>
            ))}
          </select>
        </label>
        {loading && <span className="text-xs text-on-surface-variant">Cargando...</span>}
      </div>

      {error && (
        <div className="rounded-xl border border-error/40 bg-error/10 p-4 text-sm text-error">
          {error}
        </div>
      )}

      {table && (
        <>
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_TONE[table.period.status]}`}
              >
                {STATUS_LABELS[table.period.status]}
              </span>
              <p className="text-xs text-on-surface-variant">
                {table.period.status === "BORRADOR" &&
                  "Se calcula en vivo con el checador. Envíala a revisión para congelar los números."}
                {table.period.status === "REVISION" &&
                  `Enviada por ${table.period.submittedByName ?? "—"} · ${
                    table.period.submittedAt ? formatDateTime(table.period.submittedAt) : ""
                  }`}
                {table.period.status === "APROBADA" &&
                  `Aprobada por ${table.period.approvedByName ?? "—"} · ${
                    table.period.approvedAt ? formatDateTime(table.period.approvedAt) : ""
                  }`}
                {table.period.status === "PAGADA" &&
                  `Pagada por ${table.period.paidByName ?? "—"} · ${
                    table.period.paidAt ? formatDateTime(table.period.paidAt) : ""
                  }`}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {table.period.status === "BORRADOR" && (
                <button
                  disabled={actionBusy || table.employees.length === 0}
                  onClick={() =>
                    handlePeriodAction(submitPayrollPeriodAction, "Semana enviada a revisión")
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-on-primary disabled:opacity-50"
                >
                  <CheckIcon className="h-3.5 w-3.5" />
                  Enviar a revisión
                </button>
              )}

              {table.period.status === "REVISION" && (
                <>
                  <button
                    disabled={actionBusy}
                    onClick={() =>
                      approveWeek()
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-on-primary disabled:opacity-50"
                  >
                    <CheckIcon className="h-3.5 w-3.5" />
                    Aprobar
                  </button>
                  <button
                    disabled={actionBusy}
                    onClick={() =>
                      reopenWeek()
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-3 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50"
                  >
                    <RefreshIcon className="h-3.5 w-3.5" />
                    Reabrir
                  </button>
                </>
              )}

              {table.period.status === "APROBADA" && (
                <>
                  <button
                    disabled={actionBusy}
                    onClick={() =>
                      handlePeriodAction(markPayrollPeriodPaidAction, "Semana marcada como pagada")
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-on-primary disabled:opacity-50"
                  >
                    <CheckIcon className="h-3.5 w-3.5" />
                    Marcar pagada
                  </button>
                  <button
                    disabled={actionBusy}
                    onClick={() =>
                      reopenWeek()
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-3 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50"
                  >
                    <RefreshIcon className="h-3.5 w-3.5" />
                    Reabrir
                  </button>
                </>
              )}

              {table.period.status === "PAGADA" && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-outline">
                  <LockIcon className="h-3.5 w-3.5" />
                  Cerrada
                </span>
              )}
            </div>
          </Card>

          <section className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container" aria-label="Resumen semanal">
            <div className="grid grid-cols-2 divide-x divide-y divide-outline-variant sm:grid-cols-5 sm:divide-y-0">
              {[
                ["Empleados", String(table.totals.employeesWorked)],
                ["Horas totales", hours(table.totals.totalHours)],
                ["Horas extra", hours(table.totals.overtimeHours)],
                ["Total nómina", money(table.totals.finalPay)],
                ["Pago", formatPaymentDate(table.weekStart)],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-outline">{label}</p>
                  <p className="mt-1 truncate text-base font-black tabular-nums text-on-surface" title={value}>{value}</p>
                </div>
              ))}
            </div>
          </section>

          <Card className="border-primary/30 bg-primary/[0.04]">
            <CardLabel>Total a pagar este lunes</CardLabel>
            <p className="mt-1 text-3xl font-black tabular-nums text-on-surface">{money(table.totals.finalPay)}</p>
            <p className="mt-1 text-xs text-on-surface-variant">
              Semana trabajada: {formatWeekRange(table.weekStart)} · pago: {formatPaymentDate(table.weekStart)}
            </p>
          </Card>

          <section className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-outline-variant bg-surface-container px-4 py-3">
              <div>
                <h2 className="font-bold text-on-surface">Planilla semanal</h2>
                <p className="text-xs text-on-surface-variant">Horas reales del checador · lunes a domingo</p>
              </div>
              <label className="relative block w-full sm:w-64">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar empleado" className="w-full rounded-xl border border-outline-variant bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary" />
              </label>
            </div>

            {table.employees.length === 0 ? (
              <p className="p-8 text-center text-sm text-on-surface-variant">
                Nadie registró horas en esta semana.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1120px] border-separate border-spacing-0 text-sm">
                  <thead className="bg-surface-container-high">
                    <tr className="text-left text-[11px] uppercase tracking-wide text-outline">
                      <th className="sticky left-0 z-20 w-56 border-b border-r border-outline-variant bg-surface-container-high px-4 py-3 font-bold">Empleado</th>
                      {DAY_LABELS.map((label, i) => (
                        <th key={label} className="w-20 border-b border-r border-outline-variant px-2 py-3 text-center font-bold">
                          <span className="block">{label}</span><span className="font-normal normal-case">{formatDayLabel(addDaysToDateOnly(table.weekStart, i))}</span>
                        </th>
                      ))}
                      <th className="border-b border-r border-outline-variant px-3 py-3 text-right font-bold">Total horas</th>
                      <th className="border-b border-r border-outline-variant px-3 py-3 text-right font-bold">Pago total</th>
                      <th className="border-b border-outline-variant px-3 py-3 text-center font-bold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEmployees.map((employee) => (
                      <tr key={employee.id} className="group hover:bg-primary/[0.025]">
                        <td className="sticky left-0 z-10 border-b border-r border-outline-variant bg-surface-container-lowest px-4 py-2.5 group-hover:bg-surface-container font-semibold text-on-surface">
                          <div className="flex flex-col items-start gap-1">
                            <button type="button" onClick={() => setSelectedUserId(employee.id)} className="text-left hover:text-primary hover:underline">{employee.name}</button>
                            <button type="button" onClick={() => setSelectedUserId(employee.id)} className="text-[10px] font-bold text-primary hover:underline">Editar horas y turnos</button>
                          </div>
                          {employee.missingRate && (
                            <span className="ml-2 rounded-full bg-error/15 px-2 py-0.5 text-[9px] font-bold text-error">Sin tarifa</span>
                          )}
                        </td>
                        {employee.hoursByDay.map((h, i) => (
                          <td key={i} className="border-b border-r border-outline-variant p-1.5 text-center">
                            <button onClick={() => setSelectedUserId(employee.id)} className={`w-full rounded-md px-2 py-2 font-mono text-xs font-bold tabular-nums ${h > 0 ? "bg-tertiary-fixed-dim/12 text-tertiary-fixed-dim hover:bg-tertiary-fixed-dim/20" : "bg-surface-container text-outline"}`}>
                              {h > 0 ? hours(h) : "—"}
                            </button>
                          </td>
                        ))}
                        <td className="border-b border-r border-outline-variant px-3 py-2.5 text-right font-mono font-black tabular-nums text-on-surface">
                          {hours(employee.totalHours)}
                        </td>
                        <td className="border-b border-r border-outline-variant px-3 py-2.5 text-right font-black tabular-nums text-on-surface">
                          {employee.missingRate && employee.adjustmentsTotal === 0
                            ? "—"
                            : money(employee.finalPay)}
                        </td>
                        <td className="border-b border-outline-variant px-3 py-2.5 text-center">
                          <button onClick={() => setSelectedUserId(employee.id)} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${table.period.status === "APROBADA" || table.period.status === "PAGADA" ? "bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim" : "bg-secondary/15 text-secondary"}`}>
                            {table.period.status === "APROBADA" || table.period.status === "PAGADA" ? "Aprobado" : "Pendiente"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {visibleEmployees.length === 0 && <p className="p-8 text-center text-sm text-on-surface-variant">No encontramos empleados con ese nombre.</p>}
              </div>
            )}
          </section>
        </>
      )}

      {selectedUserId && (
        <EmployeeDetailModal
          userId={selectedUserId}
          weekStart={weekStart}
          onClose={() => setSelectedUserId(null)}
          onDataChanged={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}

function EmployeeDetailModal({
  userId,
  weekStart,
  onClose,
  onDataChanged,
}: {
  userId: string;
  weekStart: string;
  onClose: () => void;
  onDataChanged: () => void;
}) {
  const { showToast } = useToast();
  const [detail, setDetail] = useState<PayrollEmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [justifyingDate, setJustifyingDate] = useState<string | null>(null);
  const [draftEntryDate, setDraftEntryDate] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<EditableEntryDraft | null>(null);
  const [entryBranchId, setEntryBranchId] = useState("");
  const [entryClockIn, setEntryClockIn] = useState("");
  const [entryClockOut, setEntryClockOut] = useState("");
  const [savingEntry, setSavingEntry] = useState(false);
  const locked = detail ? detail.period.status !== "BORRADOR" : false;
  const branchOptions = detail?.branches ?? [];

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    getEmployeePayrollDetail(userId, weekStart).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setError(result.error);
        setDetail(null);
      } else {
        setError(null);
        setDetail(result.data);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [userId, weekStart, refreshKey]);

  async function handleDeleteAdjustment(id: string) {
    if (!confirm("¿Eliminar este ajuste?")) return;
    const result = await deletePayrollAdjustmentAction(id);
    if (result?.error) {
      showToast(result.error, "error");
    } else {
      showToast("Ajuste eliminado", "success");
      setRefreshKey((k) => k + 1);
      onDataChanged();
    }
  }

  async function handleUnjustify(date: string) {
    if (!detail) return;
    if (!confirm("¿Quitar la justificación de este día?")) return;
    const result = await unjustifyIncidentAction(detail.employee.id, date);
    if (result?.error) {
      showToast(result.error, "error");
    } else {
      showToast("Justificación eliminada", "success");
      setRefreshKey((k) => k + 1);
    }
  }

  async function handleDeleteEntry(entryId: string) {
    if (!confirm("¿Eliminar este turno?")) return;
    const result = await deleteManualTimeClockEntryAction(entryId);
    if (result?.error) {
      showToast(result.error, "error");
    } else {
      showToast("Turno eliminado", "success");
      setRefreshKey((k) => k + 1);
      onDataChanged();
      setEditingEntry(null);
      setDraftEntryDate(null);
    }
  }

  function openAddEntry(date: string) {
    if (!detail) return;
    const defaultBranch = branchOptions[0]?.id ?? "";
    const start = buildDateTimeFromDay(date, "09:00") ?? new Date().toISOString();
    const end = buildDateTimeFromDay(date, "18:00") ?? new Date().toISOString();
    setDraftEntryDate(date);
    setEntryBranchId(defaultBranch);
    setEntryClockIn(toDateTimeLocalInput(start));
    setEntryClockOut(toDateTimeLocalInput(end));
    setEditingEntry({
      entryId: "new",
      date,
      branchId: defaultBranch,
      clockIn: toDateTimeLocalInput(start),
      clockOut: toDateTimeLocalInput(end),
    });
    setJustifyingDate(null);
  }

  function startEditingEntry(entry: {
    id: string;
    branchId: string;
    branchName: string;
    clockIn: string;
    clockOut: string | null;
    source: "CHECADOR" | "MANUAL";
  }) {
    setDraftEntryDate(null);
    setEditingEntry({
      entryId: entry.id,
      date: detail ? detail.weekStart : "",
      branchId: entry.branchId,
      clockIn: toDateTimeLocalInput(entry.clockIn),
      clockOut: entry.clockOut ? toDateTimeLocalInput(entry.clockOut) : "",
    });
    setEntryBranchId(entry.branchId);
    setEntryClockIn(toDateTimeLocalInput(entry.clockIn));
    setEntryClockOut(entry.clockOut ? toDateTimeLocalInput(entry.clockOut) : "");
  }

  async function handleSaveEntry() {
    if (locked || !detail) return;
    if (!entryBranchId) {
      showToast("Selecciona una sucursal", "error");
      return;
    }
    const dateFromForm = new Date(entryClockIn);
    const outDate = new Date(entryClockOut);
    if (Number.isNaN(dateFromForm.getTime()) || Number.isNaN(outDate.getTime())) {
      showToast("Formato de hora inválido", "error");
      return;
    }
    if (outDate <= dateFromForm) {
      showToast("La salida debe ser después de la entrada", "error");
      return;
    }

    setSavingEntry(true);
    try {
      const result = editingEntry?.entryId === "new"
        ? await createManualTimeClockEntryAction({
            userId: detail.employee.id,
            branchId: entryBranchId,
            clockIn: new Date(entryClockIn).toISOString(),
            clockOut: new Date(entryClockOut).toISOString(),
          })
        : await updateManualTimeClockEntryAction({
            entryId: editingEntry?.entryId ?? "",
            branchId: entryBranchId,
            clockIn: new Date(entryClockIn).toISOString(),
            clockOut: new Date(entryClockOut).toISOString(),
          });

      if (result?.error) {
        showToast(result.error, "error");
        return;
      }

      showToast(editingEntry?.entryId === "new" ? "Turno creado" : "Turno actualizado", "success");
      setEditingEntry(null);
      setDraftEntryDate(null);
      setRefreshKey((k) => k + 1);
      onDataChanged();
    } catch (actionError) {
      showToast(actionError instanceof Error ? actionError.message : "No se pudo guardar el turno", "error");
    } finally {
      setSavingEntry(false);
    }
  }

  function cancelEntryEdit() {
    setEditingEntry(null);
    setDraftEntryDate(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-surface-container-lowest p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {loading && <p className="text-sm text-on-surface-variant">Cargando...</p>}
        {error && <p className="text-sm text-error">{error}</p>}

        {detail && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-on-surface">{detail.employee.name}</h3>
                <p className="text-sm text-on-surface-variant">
                  {formatWeekRange(detail.weekStart)}
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-bold text-on-surface-variant hover:bg-surface-container-high"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card className="p-3">
                <CardLabel>Horas</CardLabel>
                <p className="text-lg font-bold text-on-surface">{hours(detail.totalHours)}</p>
              </Card>
              <Card className="p-3">
                <CardLabel>Extra</CardLabel>
                <p className="text-lg font-bold text-on-surface">{hours(detail.overtimeHours)}</p>
              </Card>
              <Card className="p-3">
                <CardLabel>Base</CardLabel>
                <p className="text-lg font-bold text-on-surface">{money(detail.basePay)}</p>
              </Card>
              <Card className="p-3">
                <CardLabel>Total</CardLabel>
                <p className="text-lg font-bold text-on-surface">{money(detail.finalPay)}</p>
                {detail.adjustmentsTotal !== 0 && (
                  <p className="text-[10px] text-on-surface-variant">
                    {money(detail.totalPay)} horas{" "}
                    {detail.adjustmentsTotal > 0 ? "+" : "−"}{" "}
                    {money(Math.abs(detail.adjustmentsTotal))} ajustes
                  </p>
                )}
              </Card>
            </div>

            <div className="mt-4 space-y-2">
              {detail.days.map((day) => (
                <div
                  key={day.date}
                  className="rounded-xl border border-outline-variant p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-on-surface">
                      {formatDayLabel(day.date)}
                    </span>
                    <span className="text-sm font-semibold text-on-surface-variant">
                      {day.hoursWorked > 0 ? hours(day.hoursWorked) : "—"}
                    </span>
                  </div>

                  <div className="mt-2 space-y-3 text-xs">
                    <div>
                      <p className="font-semibold text-outline">Programado</p>
                      {day.scheduled ? (
                        <p className="text-on-surface-variant">
                          {day.scheduled.branchName} · {day.scheduled.startTime}–
                          {day.scheduled.endTime}
                        </p>
                      ) : (
                        <p className="text-outline">Sin turno</p>
                      )}
                    </div>
                    <div className="rounded-lg bg-surface-container px-2 py-2">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-outline">Horas y turnos registrados</p>
                        {!locked && (
                          <button
                            type="button"
                            onClick={() => openAddEntry(day.date)}
                            className="rounded-lg border border-outline-variant px-2 py-0.5 text-[10px] font-bold text-on-surface-variant hover:bg-surface-container-high"
                          >
                            <PlusIcon className="inline h-3.5 w-3.5" /> Agregar
                          </button>
                        )}
                      </div>
                      {day.entries.length === 0 ? (
                        <p className="mt-1.5 text-outline">Sin turnos</p>
                      ) : (
                        <div className="mt-1.5 space-y-1.5">
                          {day.entries.map((entry) => (
                            <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-container-lowest px-2 py-1.5">
                              <span className="text-on-surface">
                                {entry.branchName} · {formatTime(entry.clockIn)}–
                                {entry.clockOut ? formatTime(entry.clockOut) : "abierto"}
                                <span className="ml-1 text-[10px] text-outline">
                                  {entry.source === "MANUAL" ? "(manual)" : "(checador)"}
                                </span>
                              </span>
                              {!locked && (
                                <span className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      startEditingEntry({
                                        id: entry.id,
                                        branchId: entry.branchId,
                                        branchName: entry.branchName,
                                        clockIn: entry.clockIn,
                                        clockOut: entry.clockOut,
                                        source: entry.source,
                                      })
                                    }
                                    title="Editar turno"
                                    className="rounded-md border border-outline-variant px-2 py-1 text-[10px] font-bold hover:bg-surface-container-high"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteEntry(entry.id)}
                                    aria-label="Eliminar turno"
                                    title="Eliminar turno"
                                    className="rounded-md p-1.5 text-outline hover:bg-error/10 hover:text-error"
                                  >
                                    <TrashIcon className="h-3.5 w-3.5" />
                                  </button>
                                  {!entry.clockOut && (
                                    <span className="rounded-md bg-error/10 px-2 py-1 text-[10px] text-error">Abierto</span>
                                  )}
                                </span>
                              )}
                              {locked && (
                                <span className="rounded-md bg-surface-container px-2 py-1 text-[10px] text-outline">
                                  {entry.clockOut ? "Cerrado" : "Abierto"}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {editingEntry && editingEntry.entryId === "new" && draftEntryDate === day.date && (
                    <div className="mt-2 rounded-lg border border-outline-variant bg-surface p-2.5">
                      <p className="mb-2 text-xs font-bold text-on-surface">Agregar turno ({day.date})</p>
                      <label className="mb-2 block">
                        <span className="mb-1 block text-[11px] font-semibold text-outline">
                          Sucursal
                        </span>
                        <select
                          value={entryBranchId}
                          onChange={(event) => setEntryBranchId(event.target.value)}
                          className="w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-xs"
                        >
                          {branchOptions.length === 0 && (
                            <option value="">Sin sucursales para este empleado</option>
                          )}
                          {branchOptions.map((branch) => (
                            <option key={branch.id} value={branch.id}>
                              {branch.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="mb-2 block">
                        <span className="mb-1 block text-[11px] font-semibold text-outline">
                          Entrada
                        </span>
                        <input
                          type="datetime-local"
                          value={entryClockIn}
                          onChange={(event) => setEntryClockIn(event.target.value)}
                          className="w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-xs"
                        />
                      </label>
                      <label className="mb-2 block">
                        <span className="mb-1 block text-[11px] font-semibold text-outline">
                          Salida
                        </span>
                        <input
                          type="datetime-local"
                          value={entryClockOut}
                          onChange={(event) => setEntryClockOut(event.target.value)}
                          className="w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-xs"
                        />
                      </label>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={cancelEntryEdit}
                          className="rounded-lg border border-outline-variant px-2.5 py-1 text-[11px] font-bold text-on-surface-variant hover:bg-surface-container-high"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveEntry}
                          disabled={savingEntry}
                          className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-on-primary disabled:opacity-50"
                        >
                          {savingEntry ? "Guardando..." : "Guardar turno"}
                        </button>
                      </div>
                    </div>
                  )}

                  {editingEntry &&
                    editingEntry.entryId !== "new" &&
                    editingEntry.entryId &&
                    (() => {
                      const entry = day.entries.find((item) => item.id === editingEntry.entryId);
                      if (!entry) return null;
                      return (
                        <div className="mt-2 rounded-lg border border-outline-variant bg-surface p-2.5">
                          <p className="mb-2 text-xs font-bold text-on-surface">Editar turno</p>
                          <label className="mb-2 block">
                            <span className="mb-1 block text-[11px] font-semibold text-outline">Sucursal</span>
                            <select
                              value={entryBranchId}
                              onChange={(event) => setEntryBranchId(event.target.value)}
                              className="w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-xs"
                            >
                              {branchOptions.map((branch) => (
                                <option key={branch.id} value={branch.id}>
                                  {branch.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="mb-2 block">
                            <span className="mb-1 block text-[11px] font-semibold text-outline">Entrada</span>
                            <input
                              type="datetime-local"
                              value={entryClockIn}
                              onChange={(event) => setEntryClockIn(event.target.value)}
                              className="w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-xs"
                            />
                          </label>
                          <label className="mb-2 block">
                            <span className="mb-1 block text-[11px] font-semibold text-outline">Salida</span>
                            <input
                              type="datetime-local"
                              value={entryClockOut}
                              onChange={(event) => setEntryClockOut(event.target.value)}
                              className="w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-xs"
                            />
                          </label>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={cancelEntryEdit}
                              className="rounded-lg border border-outline-variant px-2.5 py-1 text-[11px] font-bold text-on-surface-variant hover:bg-surface-container-high"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveEntry}
                              disabled={savingEntry}
                              className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-on-primary disabled:opacity-50"
                            >
                              {savingEntry ? "Guardando..." : "Actualizar"}
                            </button>
                          </div>
                        </div>
                      );
                    })()
                  }

                  {day.incident && (
                    <div className="mt-2 space-y-1.5">
                      <div
                        className={`flex items-center justify-between gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold ${
                          day.justified
                            ? "bg-surface-container text-on-surface-variant"
                            : INCIDENT_TONE[day.incident] === "danger"
                              ? "bg-error/10 text-error"
                              : "bg-secondary/10 text-secondary"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <AlertIcon className="h-3.5 w-3.5" />
                          {INCIDENT_LABELS[day.incident]}
                          {day.justified && (
                            <span className="text-tertiary-fixed-dim">· justificada</span>
                          )}
                        </span>
                        <button
                          onClick={() =>
                            day.justified
                              ? handleUnjustify(day.date)
                              : setJustifyingDate(justifyingDate === day.date ? null : day.date)
                          }
                          className="shrink-0 rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-0.5 text-[10px] font-bold text-on-surface-variant hover:bg-surface-container-high"
                        >
                          {day.justified ? "Quitar" : "Justificar"}
                        </button>
                      </div>

                      {day.justified && day.justifiedNotes && (
                        <p className="px-2 text-[11px] text-on-surface-variant">
                          &ldquo;{day.justifiedNotes}&rdquo; — {day.justifiedByName}
                        </p>
                      )}

                      {justifyingDate === day.date && !day.justified && (
                        <JustifyForm
                          userId={detail.employee.id}
                          date={day.date}
                          onSaved={() => {
                            setJustifyingDate(null);
                            setRefreshKey((k) => k + 1);
                          }}
                          onCancel={() => setJustifyingDate(null)}
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-outline-variant p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-on-surface">Bonos y deducciones</p>
                {!locked && (
                  <button
                    onClick={() => setShowAdjustForm((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-lg border border-outline-variant px-2 py-1 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    Agregar
                  </button>
                )}
              </div>

              {locked && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-outline">
                  <LockIcon className="h-3.5 w-3.5" />
                  Semana {STATUS_LABELS[detail.period.status].toLowerCase()} — reábrela para modificar ajustes.
                </p>
              )}

              {showAdjustForm && !locked && (
                <AdjustmentForm
                  userId={detail.employee.id}
                  weekStart={detail.weekStart}
                  onCreated={() => {
                    setShowAdjustForm(false);
                    setRefreshKey((k) => k + 1);
                    onDataChanged();
                  }}
                  onCancel={() => setShowAdjustForm(false)}
                />
              )}

              {detail.adjustments.length === 0 ? (
                <p className="mt-2 text-xs text-on-surface-variant">
                  Sin bonos ni deducciones esta semana.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {detail.adjustments.map((adj) => (
                    <div
                      key={adj.id}
                      className="flex items-start justify-between gap-2 rounded-lg bg-surface-container p-2.5 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-on-surface">
                          {adj.concept}{" "}
                          <span
                            className={
                              adj.type === "BONO" ? "text-tertiary-fixed-dim" : "text-error"
                            }
                          >
                            {adj.type === "BONO" ? "+" : "−"}
                            {money(adj.amount)}
                          </span>
                        </p>
                        {adj.notes && (
                          <p className="mt-0.5 text-on-surface-variant">{adj.notes}</p>
                        )}
                        <p className="mt-0.5 text-outline">Por {adj.createdByName}</p>
                      </div>
                      {!locked && (
                        <button
                          onClick={() => handleDeleteAdjustment(adj.id)}
                          className="shrink-0 rounded-lg p-1.5 text-outline hover:bg-error/10 hover:text-error"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AdjustmentForm({
  userId,
  weekStart,
  onCreated,
  onCancel,
}: {
  userId: string;
  weekStart: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const { showToast } = useToast();
  const [type, setType] = useState<"BONO" | "DEDUCCION">("BONO");
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = Number(amount);
    if (!concept.trim() || !(amountNum > 0)) {
      showToast("Escribe un concepto y un monto válido", "error");
      return;
    }

    setSaving(true);
    const result = await createPayrollAdjustmentAction({
      userId,
      weekStart,
      type,
      concept,
      amount: amountNum,
      notes: notes || undefined,
    });
    setSaving(false);

    if (result?.error) {
      showToast(result.error, "error");
    } else {
      showToast(type === "BONO" ? "Bono agregado" : "Deducción agregada", "success");
      onCreated();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2 rounded-lg bg-surface-container p-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setType("BONO")}
          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold ${
            type === "BONO"
              ? "bg-tertiary-fixed-dim text-on-primary"
              : "border border-outline-variant text-on-surface-variant"
          }`}
        >
          Bono
        </button>
        <button
          type="button"
          onClick={() => setType("DEDUCCION")}
          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold ${
            type === "DEDUCCION"
              ? "bg-error text-on-error"
              : "border border-outline-variant text-on-surface-variant"
          }`}
        >
          Deducción
        </button>
      </div>

      <input
        value={concept}
        onChange={(e) => setConcept(e.target.value)}
        placeholder="Concepto (ej. propina, préstamo, faltante de caja)"
        className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs"
      />

      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        type="number"
        min="0"
        step="0.01"
        placeholder="Monto"
        className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs"
      />

      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas (opcional)"
        className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs"
      />

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-bold text-on-surface-variant hover:bg-surface-container-high"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </form>
  );
}

function JustifyForm({
  userId,
  date,
  onSaved,
  onCancel,
}: {
  userId: string;
  date: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { showToast } = useToast();
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const result = await justifyIncidentAction({ userId, date, notes: notes || undefined });
    setSaving(false);

    if (result?.error) {
      showToast(result.error, "error");
    } else {
      showToast("Incidencia justificada", "success");
      onSaved();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-lg bg-surface-container p-2.5">
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Motivo (ej. permiso médico, cita autorizada)"
        className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs"
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-outline-variant px-2.5 py-1 text-[11px] font-bold text-on-surface-variant hover:bg-surface-container-high"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-on-primary disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </form>
  );
}
