"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  getScheduleGridForWeek,
  publishWeekAction,
  unpublishWeekAction,
} from "@/app/actions/schedule";
import {
  addDaysToDateOnly,
  formatDateOnly,
  mondayOfWeek,
  parseDateOnly,
  todayDateOnly,
} from "@/lib/dateOnly";
import { getInitials } from "@/lib/personnelRoles";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, AlertIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";
import { fallbackBranchColor } from "@/lib/branchColors";
import ShiftModal from "./ShiftModal";

type Employee = { id: string; name: string; hourlyRate: number | null };
type BranchLite = { id: string; name: string; color: string | null };
type Template = { branchId: string; dayOfWeek: number; startTime: string; endTime: string };
type Shift = {
  id: string;
  userId: string;
  branchId: string | null;
  date: string | Date;
  type: "TURNO" | "DESCANSO";
  startTime: string | null;
  endTime: string | null;
  position: string | null;
  notes: string | null;
  user: { id: string; name: string };
  branch: BranchLite | null;
};
type GridData = {
  weekStart: string | Date;
  weekEnd: string | Date;
  status: "DRAFT" | "PUBLISHED";
  weeklyHourThreshold: number;
  employees: Employee[];
  branches: BranchLite[];
  templates: Template[];
  shifts: Shift[];
};

type Alert =
  | { kind: "overlap"; employeeId: string; employeeName: string; dateStr: string }
  | { kind: "multibranch"; employeeId: string; employeeName: string; dateStr: string }
  | { kind: "overtime"; employeeId: string; employeeName: string; hours: number; threshold: number };

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Duración de un turno en horas, tolerante a turnos que cruzan medianoche. */
function shiftHours(startTime: string, endTime: string) {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);

  if (![sh, sm, eh, em].every(Number.isFinite)) return 0;

  const startMinutes = sh * 60 + sm;
  let endMinutes = eh * 60 + em;
  if (endMinutes <= startMinutes) endMinutes += 24 * 60;

  return (endMinutes - startMinutes) / 60;
}

/** Rango en minutos desde medianoche, tolerante a turnos que cruzan la noche. */
function shiftRangeMinutes(startTime: string, endTime: string): [number, number] | null {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);

  if (![sh, sm, eh, em].every(Number.isFinite)) return null;

  const start = sh * 60 + sm;
  let end = eh * 60 + em;
  if (end <= start) end += 24 * 60;

  return [start, end];
}

function rangesOverlap(a: [number, number], b: [number, number]) {
  return a[0] < b[1] && b[0] < a[1];
}

function formatTime12(time: string) {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
  const period = h >= 12 ? "p.m." : "a.m.";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function formatHours(hours: number) {
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
}

function formatWeekRange(weekStart: string) {
  const start = parseDateOnly(weekStart);
  const end = parseDateOnly(addDaysToDateOnly(weekStart, 6));
  const fmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", timeZone: "UTC" });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

function getMostRecentMonday() {
  return mondayOfWeek(todayDateOnly());
}

function ShiftBlock({ shift, onClick }: { shift: Shift; onClick: () => void }) {
  if (shift.type === "DESCANSO") {
    return (
      <button
        onClick={onClick}
        className="w-full rounded-lg border border-dashed border-outline-variant bg-surface-container-highest px-2 py-2 text-center text-[10px] font-black uppercase tracking-widest text-on-surface-variant transition hover:border-outline"
      >
        Descanso
      </button>
    );
  }

  const color = shift.branch?.color || fallbackBranchColor(shift.branchId ?? shift.id);

  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border px-2 py-1.5 text-left transition hover:brightness-95"
      style={{ backgroundColor: `${color}1f`, borderColor: `${color}55` }}
    >
      <p className="text-xs font-bold" style={{ color }}>
        {shift.startTime ? formatTime12(shift.startTime) : "—"}
        {" – "}
        {shift.endTime ? formatTime12(shift.endTime) : "—"}
      </p>
      <p className="truncate text-[11px] font-medium text-on-surface-variant">
        {shift.branch?.name ?? "Sin sucursal"}
      </p>
      {shift.position && (
        <p className="truncate text-[10px] text-on-surface-variant/80">{shift.position}</p>
      )}
    </button>
  );
}

function formatAlertDate(dateStr: string) {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(parseDateOnly(dateStr));
}

function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="overflow-hidden rounded-2xl border border-error/40 bg-error/5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-error">
          <AlertIcon className="h-4 w-4" />
          {alerts.length} alerta{alerts.length === 1 ? "" : "s"} esta semana
        </span>
        <span className="text-xs text-error/70">{open ? "Ocultar" : "Ver detalle"}</span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-error/20 px-5 py-4">
          {alerts.map((a, i) => (
            <p key={i} className="text-sm text-error">
              {a.kind === "overlap" && (
                <>
                  <strong>{a.employeeName}</strong> tiene turnos traslapados el{" "}
                  {formatAlertDate(a.dateStr)}.
                </>
              )}
              {a.kind === "multibranch" && (
                <>
                  <strong>{a.employeeName}</strong> está asignado a dos sucursales a la vez el{" "}
                  {formatAlertDate(a.dateStr)}.
                </>
              )}
              {a.kind === "overtime" && (
                <>
                  <strong>{a.employeeName}</strong> tiene {formatHours(a.hours)} programadas esta
                  semana (arriba de las {a.threshold}h).
                </>
              )}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Vista para pantallas chicas: en vez de comprimir los 7 días en el
 * ancho de un celular, se navega un día a la vez con chips arriba
 * (mismo patrón que el calendario del empleado) y se listan todos
 * los empleados con su turno de ese día.
 */
function MobileDayView({
  days,
  dayIndex,
  onSelectDay,
  todayStr,
  employees,
  employeeTotals,
  overtimeEmployeeIds,
  shiftsByCell,
  alertCellKeys,
  onShiftClick,
  onAddClick,
}: {
  days: Date[];
  dayIndex: number;
  onSelectDay: (i: number) => void;
  todayStr: string;
  employees: Employee[];
  employeeTotals: Map<string, { hours: number; turnos: number }>;
  overtimeEmployeeIds: Set<string>;
  shiftsByCell: Map<string, Shift[]>;
  alertCellKeys: Set<string>;
  onShiftClick: (shift: Shift) => void;
  onAddClick: (userId: string, date: string) => void;
}) {
  const selectedDay = days[dayIndex] ?? days[0];
  const dateStr = formatDateOnly(selectedDay);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {days.map((day, i) => {
          const dStr = formatDateOnly(day);
          const isSelected = i === dayIndex;
          const isToday = dStr === todayStr;
          const dayHasAlert = employees.some((e) => alertCellKeys.has(`${e.id}|${dStr}`));

          return (
            <button
              key={i}
              onClick={() => onSelectDay(i)}
              className={`relative flex shrink-0 flex-col items-center gap-1 rounded-xl px-3.5 py-3 transition ${
                isSelected
                  ? "bg-primary text-on-primary"
                  : isToday
                    ? "border border-primary/40 bg-surface-container-high text-on-surface"
                    : "border border-outline-variant bg-surface-container text-on-surface-variant"
              }`}
            >
              <span className="font-mono text-[10px] font-bold tracking-wider">{DAY_LABELS[i]}</span>
              <span className="font-mono text-base font-bold">{day.getUTCDate()}</span>
              {dayHasAlert && (
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-error" />
              )}
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        {employees.length === 0 && (
          <p className="p-6 text-center text-sm text-on-surface-variant">
            No hay personal activo para programar.
          </p>
        )}

        {employees.map((employee) => {
          const key = `${employee.id}|${dateStr}`;
          const cellShifts = shiftsByCell.get(key) ?? [];
          const hasAlert = alertCellKeys.has(key);
          const totals = employeeTotals.get(employee.id) ?? { hours: 0, turnos: 0 };

          return (
            <div
              key={employee.id}
              className={`rounded-2xl border bg-surface-container p-4 ${
                hasAlert ? "border-error/40 bg-error/5" : "border-outline-variant"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-black text-primary ring-1 ring-primary/30">
                  {getInitials(employee.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-on-surface">{employee.name}</p>
                  <p
                    className={`flex items-center gap-1 text-xs ${
                      overtimeEmployeeIds.has(employee.id) ? "font-semibold text-secondary" : "text-on-surface-variant"
                    }`}
                  >
                    {overtimeEmployeeIds.has(employee.id) && <AlertIcon className="h-3 w-3" />}
                    {formatHours(totals.hours)} esta semana
                  </p>
                </div>
              </div>

              {hasAlert && (
                <p className="mt-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-error">
                  <AlertIcon className="h-3 w-3" />
                  Traslape ese día
                </p>
              )}

              <div className="mt-3 space-y-1.5">
                {cellShifts.map((s) => (
                  <ShiftBlock key={s.id} shift={s} onClick={() => onShiftClick(s)} />
                ))}

                <button
                  onClick={() => onAddClick(employee.id, dateStr)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-outline-variant py-2 text-xs font-semibold text-on-surface-variant transition hover:border-primary/40 hover:text-primary"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  {cellShifts.length === 0 ? "Agregar turno" : "Agregar otro"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type ModalState =
  | { mode: "create"; userId: string; date: string }
  | { mode: "edit"; shift: Shift };

export default function ScheduleGrid() {
  const { showToast } = useToast();
  const [weekStart, setWeekStart] = useState(getMostRecentMonday());
  const [data, setData] = useState<GridData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [mobileDayIndex, setMobileDayIndex] = useState(0);

  async function load() {
    setLoading(true);
    setError(null);

    const result = await getScheduleGridForWeek(weekStart);

    if ("error" in result) {
      setError(result.error ?? "Error");
      setData(null);
    } else {
      setData(result as unknown as GridData);
    }

    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  // En móvil, al cambiar de semana selecciona hoy si cae dentro de ella;
  // si no, el lunes.
  useEffect(() => {
    const idx = Array.from({ length: 7 }, (_, i) => addDaysToDateOnly(weekStart, i)).indexOf(
      todayDateOnly(),
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileDayIndex(idx >= 0 ? idx : 0);
  }, [weekStart]);

  async function handlePublishToggle() {
    if (!data) return;

    setPublishing(true);
    const result =
      data.status === "PUBLISHED"
        ? await unpublishWeekAction(weekStart)
        : await publishWeekAction(weekStart);
    setPublishing(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    showToast(
      data.status === "PUBLISHED"
        ? "Horario regresado a borrador."
        : "Horario publicado. El equipo ya puede verlo.",
    );
    load();
  }

  const days = useMemo(() => {
    const list: Date[] = [];
    for (let i = 0; i < 7; i++) list.push(parseDateOnly(addDaysToDateOnly(weekStart, i)));
    return list;
  }, [weekStart]);

  const todayStr = todayDateOnly();

  const shiftsByCell = useMemo(() => {
    const map = new Map<string, Shift[]>();
    if (!data) return map;

    for (const s of data.shifts) {
      const key = `${s.userId}|${formatDateOnly(new Date(s.date))}`;
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }

    return map;
  }, [data]);

  const employeeTotals = useMemo(() => {
    const map = new Map<string, { hours: number; turnos: number }>();
    if (!data) return map;

    for (const s of data.shifts) {
      if (s.type !== "TURNO" || !s.startTime || !s.endTime) continue;
      const current = map.get(s.userId) ?? { hours: 0, turnos: 0 };
      current.hours += shiftHours(s.startTime, s.endTime);
      current.turnos += 1;
      map.set(s.userId, current);
    }

    return map;
  }, [data]);

  const summary = useMemo(() => {
    if (!data) return null;

    const rateByUser = new Map(data.employees.map((e) => [e.id, e.hourlyRate]));
    const peopleSet = new Set<string>();
    let totalHours = 0;
    let totalShifts = 0;
    let totalCost = 0;

    for (const s of data.shifts) {
      if (s.type !== "TURNO" || !s.startTime || !s.endTime) continue;

      const hours = shiftHours(s.startTime, s.endTime);
      totalHours += hours;
      totalShifts += 1;
      peopleSet.add(s.userId);

      const rate = rateByUser.get(s.userId) ?? null;
      if (rate !== null) totalCost += hours * rate;
    }

    return { totalHours, totalShifts, peopleCount: peopleSet.size, totalCost };
  }, [data]);

  /**
   * Traslapes y "dos sucursales a la vez" se revisan por empleado y por
   * día calendario (los turnos que cruzan medianoche se comparan dentro
   * de ese mismo día; no se checa contra el día siguiente). Exceso de
   * horas se checa contra el umbral semanal configurado en Nómina.
   */
  const alerts = useMemo(() => {
    const list: Alert[] = [];
    if (!data) return list;

    const employeeNames = new Map(data.employees.map((e) => [e.id, e.name]));

    const byEmployeeDay = new Map<string, Shift[]>();
    for (const s of data.shifts) {
      if (s.type !== "TURNO" || !s.startTime || !s.endTime) continue;
      const key = `${s.userId}|${formatDateOnly(new Date(s.date))}`;
      const list2 = byEmployeeDay.get(key) ?? [];
      list2.push(s);
      byEmployeeDay.set(key, list2);
    }

    for (const [key, dayShifts] of byEmployeeDay) {
      if (dayShifts.length < 2) continue;
      const [userId, dateStr] = key.split("|");
      const employeeName = employeeNames.get(userId) ?? "Empleado";

      for (let i = 0; i < dayShifts.length; i++) {
        for (let j = i + 1; j < dayShifts.length; j++) {
          const a = shiftRangeMinutes(dayShifts[i].startTime!, dayShifts[i].endTime!);
          const b = shiftRangeMinutes(dayShifts[j].startTime!, dayShifts[j].endTime!);
          if (!a || !b || !rangesOverlap(a, b)) continue;

          const sameBranch = dayShifts[i].branchId === dayShifts[j].branchId;
          list.push(
            sameBranch
              ? { kind: "overlap", employeeId: userId, employeeName, dateStr }
              : { kind: "multibranch", employeeId: userId, employeeName, dateStr },
          );
        }
      }
    }

    for (const employee of data.employees) {
      const totals = employeeTotals.get(employee.id);
      if (totals && totals.hours > data.weeklyHourThreshold) {
        list.push({
          kind: "overtime",
          employeeId: employee.id,
          employeeName: employee.name,
          hours: totals.hours,
          threshold: data.weeklyHourThreshold,
        });
      }
    }

    return list;
  }, [data, employeeTotals]);

  const alertCellKeys = useMemo(() => {
    const set = new Set<string>();
    for (const a of alerts) {
      if (a.kind === "overlap" || a.kind === "multibranch") {
        set.add(`${a.employeeId}|${a.dateStr}`);
      }
    }
    return set;
  }, [alerts]);

  const overtimeEmployeeIds = useMemo(() => {
    const set = new Set<string>();
    for (const a of alerts) {
      if (a.kind === "overtime") set.add(a.employeeId);
    }
    return set;
  }, [alerts]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-2xl border border-outline-variant bg-surface-container p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart((prev) => addDaysToDateOnly(prev, -7))}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-outline-variant text-on-surface-variant transition duration-150 ease-out hover:scale-[1.04] active:scale-[0.97] hover:border-primary/40 hover:text-primary"
            aria-label="Semana anterior"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>

          <div className="min-w-[220px] text-center">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.25em] text-on-surface-variant">
              Semana
            </p>
            <p className="font-semibold text-on-surface">{formatWeekRange(weekStart)}</p>
          </div>

          <button
            onClick={() => setWeekStart((prev) => addDaysToDateOnly(prev, 7))}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-outline-variant text-on-surface-variant transition duration-150 ease-out hover:scale-[1.04] active:scale-[0.97] hover:border-primary/40 hover:text-primary"
            aria-label="Semana siguiente"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>

          {weekStart !== getMostRecentMonday() && (
            <button
              onClick={() => setWeekStart(getMostRecentMonday())}
              className="ml-1 rounded-xl border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant transition hover:border-primary/40 hover:text-on-surface"
            >
              Hoy
            </button>
          )}
        </div>

        {data && (
          <div className="flex items-center gap-3">
            <span
              className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                data.status === "PUBLISHED"
                  ? "bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim"
                  : "bg-secondary/15 text-secondary"
              }`}
            >
              {data.status === "PUBLISHED" ? "Publicado" : "Borrador"}
            </span>

            <button
              onClick={handlePublishToggle}
              disabled={publishing}
              className={`rounded-xl px-4 py-2.5 text-sm font-bold transition duration-150 ease-out hover:scale-[1.04] active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100 ${
                data.status === "PUBLISHED"
                  ? "border border-outline-variant text-on-surface-variant hover:border-secondary/40 hover:text-secondary"
                  : "bg-primary text-on-primary hover:opacity-90"
              }`}
            >
              {publishing
                ? "Guardando..."
                : data.status === "PUBLISHED"
                  ? "Despublicar"
                  : "Publicar horario"}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-error/40 bg-error/10 p-4 text-sm text-error">
          {error}
        </div>
      )}

      {alerts.length > 0 && <AlertsPanel alerts={alerts} />}

      {loading ? (
        <p className="text-center text-on-surface-variant">Cargando...</p>
      ) : data ? (
        <>
          <div className="md:hidden">
            <MobileDayView
              days={days}
              dayIndex={mobileDayIndex}
              onSelectDay={setMobileDayIndex}
              todayStr={todayStr}
              employees={data.employees}
              employeeTotals={employeeTotals}
              overtimeEmployeeIds={overtimeEmployeeIds}
              shiftsByCell={shiftsByCell}
              alertCellKeys={alertCellKeys}
              onShiftClick={(shift) => setModal({ mode: "edit", shift })}
              onAddClick={(userId, date) => setModal({ mode: "create", userId, date })}
            />
          </div>

          <div className="hidden overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container md:block">
            <div
              className="grid min-w-[1080px]"
              style={{ gridTemplateColumns: "220px repeat(7, minmax(148px, 1fr))" }}
            >
              <div className="sticky left-0 z-20 border-b border-r border-outline-variant bg-surface-container-high px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                  Empleado
                </p>
              </div>

              {days.map((day, i) => {
                const isToday = formatDateOnly(day) === todayStr;
                return (
                  <div
                    key={i}
                    className={`border-b border-outline-variant px-3 py-3 text-center ${
                      isToday ? "bg-primary/[0.06]" : "bg-surface-container-high"
                    }`}
                  >
                    <p
                      className={`text-[10px] font-black uppercase tracking-widest ${
                        isToday ? "text-primary" : "text-on-surface-variant"
                      }`}
                    >
                      {DAY_LABELS[i]}
                    </p>
                    <p className="text-sm font-bold text-on-surface">{day.getUTCDate()}</p>
                  </div>
                );
              })}

              {data.employees.length === 0 && (
                <div className="col-span-8 p-8 text-center text-sm text-on-surface-variant">
                  No hay personal activo para programar.
                </div>
              )}

              {data.employees.map((employee) => {
                const totals = employeeTotals.get(employee.id) ?? { hours: 0, turnos: 0 };

                return (
                  <Fragment key={employee.id}>
                    <div className="sticky left-0 z-10 flex items-center gap-3 border-b border-r border-outline-variant bg-surface-container px-4 py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-black text-primary ring-1 ring-primary/30">
                        {getInitials(employee.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-on-surface">
                          {employee.name}
                        </p>
                        <p
                          className={`flex items-center gap-1 text-xs ${
                            overtimeEmployeeIds.has(employee.id)
                              ? "font-semibold text-secondary"
                              : "text-on-surface-variant"
                          }`}
                        >
                          {overtimeEmployeeIds.has(employee.id) && <AlertIcon className="h-3 w-3" />}
                          {formatHours(totals.hours)} · {totals.turnos} turno{totals.turnos === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>

                    {days.map((day, i) => {
                      const dateStr = formatDateOnly(day);
                      const key = `${employee.id}|${dateStr}`;
                      const cellShifts = shiftsByCell.get(key) ?? [];
                      const hasAlert = alertCellKeys.has(key);

                      return (
                        <div
                          key={i}
                          className={`group min-h-[64px] space-y-1.5 border-b px-2 py-2 ${
                            hasAlert
                              ? "border-outline-variant bg-error/[0.06] ring-1 ring-inset ring-error/40"
                              : "border-outline-variant"
                          }`}
                        >
                          {hasAlert && (
                            <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-error">
                              <AlertIcon className="h-3 w-3" />
                              Traslape
                            </p>
                          )}
                          {cellShifts.map((s) => (
                            <ShiftBlock
                              key={s.id}
                              shift={s}
                              onClick={() => setModal({ mode: "edit", shift: s })}
                            />
                          ))}

                          <button
                            onClick={() => setModal({ mode: "create", userId: employee.id, date: dateStr })}
                            className="flex w-full items-center justify-center rounded-lg border border-dashed border-outline-variant/60 py-1.5 text-outline opacity-0 transition hover:border-primary/40 hover:text-primary group-hover:opacity-100"
                            aria-label="Agregar turno"
                          >
                            <PlusIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </Fragment>
                );
              })}
            </div>
          </div>

          {summary && (
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-outline-variant bg-surface-container p-5 sm:grid-cols-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                  Horas totales
                </p>
                <p className="mt-1 text-xl font-bold text-on-surface">{formatHours(summary.totalHours)}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                  Turnos
                </p>
                <p className="mt-1 text-xl font-bold text-on-surface">{summary.totalShifts}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                  Empleados programados
                </p>
                <p className="mt-1 text-xl font-bold text-on-surface">{summary.peopleCount}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                  Costo estimado
                </p>
                <p className="mt-1 text-xl font-bold text-on-surface">{formatCurrency(summary.totalCost)}</p>
              </div>
            </div>
          )}
        </>
      ) : null}

      {modal && data && (
        <ShiftModal
          employees={data.employees}
          branches={data.branches}
          templates={data.templates}
          weekDates={days.map((d) => formatDateOnly(d))}
          initial={
            modal.mode === "create"
              ? {
                  userId: modal.userId,
                  date: modal.date,
                  type: "TURNO",
                  branchId: "",
                  startTime: "",
                  endTime: "",
                  position: "",
                  notes: "",
                }
              : {
                  id: modal.shift.id,
                  userId: modal.shift.userId,
                  date: formatDateOnly(new Date(modal.shift.date)),
                  type: modal.shift.type,
                  branchId: modal.shift.branchId ?? "",
                  startTime: modal.shift.startTime ?? "",
                  endTime: modal.shift.endTime ?? "",
                  position: modal.shift.position ?? "",
                  notes: modal.shift.notes ?? "",
                }
          }
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}
