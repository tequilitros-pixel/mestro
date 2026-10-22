"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  getScheduleGridForWeek,
  publishEmployeeScheduleAction,
  publishWeekAction,
  unpublishWeekAction,
  copyPreviousWeekAction,
  moveScheduledShiftAction,
  copyShiftToCellAction,
} from "@/app/actions/schedule";
import {
  addDaysToDateOnly,
  formatDateOnly,
  mondayOfWeek,
  parseDateOnly,
  todayDateOnly,
} from "@/lib/dateOnly";
import { getInitials } from "@/lib/personnelRoles";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  AlertIcon,
  ClipboardIcon,
  BookIcon,
  PartyIcon,
  SearchIcon,
  MaximizeIcon,
  MinimizeIcon,
  CheckIcon,
} from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";
import { fallbackBranchColor } from "@/lib/branchColors";
import { getPositionColor } from "@/lib/positionColors";
import ShiftModal from "./ShiftModal";
import SaveAsTemplateModal from "./SaveAsTemplateModal";
import UseTemplateModal, { type TemplateSummary } from "./UseTemplateModal";
import ApplyTemplateModal from "./ApplyTemplateModal";
import EventModal from "./EventModal";

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
  publicationStatus: "DRAFT" | "PUBLISHED";
  user: { id: string; name: string };
  branch: BranchLite | null;
  event: { id: string; name: string; location: string | null } | null;
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
  availability: Record<
    string,
    {
      type: "AVAILABLE_ALL_DAY" | "AVAILABLE_PARTIAL" | "UNAVAILABLE" | "PREFER_OFF";
      startTime: string | null;
      endTime: string | null;
      source: "EXCEPTION" | "RECURRING";
    }
  >;
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

/** Formato compacto estilo Connecteam: 9:00a, 1:30p */
function formatTime12Compact(time: string) {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
  const period = h >= 12 ? "p" : "a";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")}${period}`;
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
  const startFmt = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const endFmt = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${startFmt.format(start)} – ${endFmt.format(end)}`;
}

function getMostRecentMonday() {
  return mondayOfWeek(todayDateOnly());
}

/** Tarjeta compacta de turno / descanso estilo Connecteam con Drag & Drop */
function ShiftBlock({
  shift,
  colorBy = "branch",
  isDragging = false,
  onClick,
  onDragStart,
  onDragEnd,
}: {
  shift: Shift;
  colorBy?: "branch" | "position";
  isDragging?: boolean;
  onClick: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}) {
  const published = shift.publicationStatus === "PUBLISHED";

  if (shift.type === "DESCANSO") {
    return (
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        aria-label="Descanso programado"
        className={`group/shift flex w-full cursor-grab items-center justify-between rounded-md border px-2 py-1 text-left transition active:cursor-grabbing hover:border-outline ${
          isDragging ? "opacity-35 scale-[0.98] ring-2 ring-primary" : ""
        } ${
          published
            ? "border-outline-variant/80 bg-surface-container-high/60"
            : "border-dashed border-outline-variant bg-surface-container-high/40"
        }`}
      >
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
          <span>☕</span>
          <span>Descanso</span>
        </span>
        <span className="text-[10px] text-on-surface-variant opacity-0 transition group-hover/shift:opacity-100">
          •••
        </span>
      </div>
    );
  }

  const color =
    colorBy === "position"
      ? getPositionColor(shift.position)
      : shift.branch?.color || fallbackBranchColor(shift.event?.id ?? shift.branchId ?? shift.id);

  const branchTint = `color-mix(in srgb, ${color} ${published ? "15%" : "8%"}, var(--surface-container-high, #202020))`;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`${shift.event?.name ?? shift.branch?.name ?? "Turno"} · ${
        published ? "Publicado" : "Borrador"
      }`}
      className={`group/shift relative flex w-full cursor-grab flex-col rounded-md border px-2 py-1 text-left transition-all active:cursor-grabbing hover:shadow-sm ${
        isDragging ? "opacity-35 scale-[0.98] ring-2 ring-primary shadow-lg" : ""
      } ${
        published
          ? "border-outline-variant/70 hover:border-outline"
          : "border-dashed border-secondary/50 bg-secondary/[0.04] hover:border-secondary"
      }`}
      style={{
        backgroundColor: branchTint,
        borderLeftColor: color,
        borderLeftWidth: 3.5,
      }}
      title={`${shift.event?.name ?? shift.branch?.name ?? "Sin sucursal"}\n${
        shift.startTime ? formatTime12(shift.startTime) : ""
      } – ${shift.endTime ? formatTime12(shift.endTime) : ""}${
        shift.position ? `\nPuesto: ${shift.position}` : ""
      }${shift.notes ? `\nNota: ${shift.notes}` : ""}\n\n💡 Arrastra para mover · Mantén Alt/Option al arrastrar para duplicar`}
    >
      <div className="flex w-full items-center justify-between gap-1 leading-tight">
        <span className="font-mono text-[11px] font-bold tracking-tight text-on-surface">
          {shift.startTime ? formatTime12Compact(shift.startTime) : "—"}
          {" – "}
          {shift.endTime ? formatTime12Compact(shift.endTime) : "—"}
        </span>
        {shift.startTime && shift.endTime && (
          <span className="shrink-0 rounded bg-surface-container-highest/80 px-1 py-0.2 text-[9px] font-bold text-on-surface-variant">
            {formatHours(shiftHours(shift.startTime, shift.endTime))}
          </span>
        )}
      </div>

      <div className="mt-0.5 flex w-full items-center gap-1 truncate text-[10px] leading-tight">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <span className="truncate font-semibold text-on-surface">
          {shift.event?.name ?? shift.branch?.name ?? "Sin sucursal"}
        </span>
        {shift.position && (
          <span
            className={`truncate font-normal ${
              colorBy === "position"
                ? "font-semibold text-on-surface"
                : "text-on-surface-variant opacity-85"
            }`}
          >
            · {shift.position}
          </span>
        )}
        {shift.notes && (
          <span className="shrink-0 text-[10px] opacity-70" title={shift.notes}>
            📝
          </span>
        )}
        {!published && (
          <span className="ml-auto shrink-0 h-1.5 w-1.5 rounded-full bg-secondary" title="Borrador" />
        )}
      </div>
    </div>
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
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-error/40 bg-error/5 text-xs">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 font-bold text-error">
          <AlertIcon className="h-4 w-4" />
          {alerts.length} alerta{alerts.length === 1 ? "" : "s"} detectada{alerts.length === 1 ? "" : "s"} en esta semana
        </span>
        <span className="text-xs font-semibold text-error/80 hover:underline">
          {open ? "Ocultar" : "Ver detalle"}
        </span>
      </button>

      {open && (
        <div className="space-y-1.5 border-t border-error/20 px-4 py-2.5">
          {alerts.map((a, i) => (
            <p key={i} className="text-xs text-error">
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
                  semana (supera el umbral de {a.threshold}h).
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
 * Vista para pantallas chicas: navegación un día a la vez.
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
  employeePublication,
  publishingEmployeeId,
  onPublishEmployee,
  onShiftClick,
  onAddClick,
  availability,
  showAvailability,
  colorBy = "branch",
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
  employeePublication: Map<string, { published: boolean; hasShifts: boolean }>;
  publishingEmployeeId: string | null;
  onPublishEmployee: (userId: string) => void;
  onShiftClick: (shift: Shift) => void;
  onAddClick: (userId: string, date: string) => void;
  availability: GridData["availability"];
  showAvailability: boolean;
  colorBy?: "branch" | "position";
}) {
  const selectedDay = days[dayIndex] ?? days[0];
  const dateStr = formatDateOnly(selectedDay);

  return (
    <div className="space-y-3">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {days.map((day, i) => {
          const dStr = formatDateOnly(day);
          const isSelected = i === dayIndex;
          const isToday = dStr === todayStr;
          const dayHasAlert = employees.some((e) => alertCellKeys.has(`${e.id}|${dStr}`));

          return (
            <button
              key={i}
              onClick={() => onSelectDay(i)}
              className={`relative flex shrink-0 flex-col items-center gap-1 rounded-xl px-3.5 py-2.5 transition ${
                isSelected
                  ? "bg-primary text-on-primary shadow-sm"
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
          const employeeAvailability = availability[key];

          return (
            <div
              key={employee.id}
              className={`rounded-xl border bg-surface-container p-3 ${
                hasAlert ? "border-error/40 bg-error/5" : "border-outline-variant"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-black text-primary ring-1 ring-primary/30">
                  {getInitials(employee.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-on-surface">{employee.name}</p>
                  <p
                    className={`flex items-center gap-1 text-[11px] ${
                      overtimeEmployeeIds.has(employee.id)
                        ? "font-semibold text-secondary"
                        : "text-on-surface-variant"
                    }`}
                  >
                    {overtimeEmployeeIds.has(employee.id) && <AlertIcon className="h-3 w-3" />}
                    {formatHours(totals.hours)} esta semana · {totals.turnos} turnos
                  </p>
                </div>
                {(() => {
                  const publication = employeePublication.get(employee.id) ?? {
                    published: false,
                    hasShifts: false,
                  };
                  if (!publication.hasShifts) return null;
                  return (
                    <button
                      type="button"
                      onClick={() => onPublishEmployee(employee.id)}
                      disabled={publication.published || publishingEmployeeId === employee.id}
                      className={`rounded px-2 py-1 text-[9px] font-bold uppercase tracking-wide transition disabled:cursor-default ${
                        publication.published
                          ? "bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim"
                          : "bg-primary/15 text-primary hover:bg-primary/25"
                      }`}
                    >
                      {publishingEmployeeId === employee.id
                        ? "..."
                        : publication.published
                          ? "Publicado"
                          : "Publicar"}
                    </button>
                  );
                })()}
              </div>

              {hasAlert && (
                <p className="mt-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-error">
                  <AlertIcon className="h-3 w-3" />
                  Traslape ese día
                </p>
              )}
              {showAvailability && employeeAvailability && employeeAvailability.type !== "AVAILABLE_ALL_DAY" && (
                <p
                  className={`mt-1.5 text-[10px] font-semibold ${
                    employeeAvailability.type === "UNAVAILABLE"
                      ? "text-error"
                      : employeeAvailability.type === "PREFER_OFF"
                        ? "text-secondary"
                        : "text-on-surface-variant"
                  }`}
                >
                  {employeeAvailability.type === "UNAVAILABLE"
                    ? "● No disponible"
                    : employeeAvailability.type === "PREFER_OFF"
                      ? "○ Prefiere descanso"
                      : `● Disp. ${employeeAvailability.startTime}–${employeeAvailability.endTime}`}
                </p>
              )}

              <div className="mt-2 space-y-1.5">
                {cellShifts.map((s) => (
                  <ShiftBlock key={s.id} shift={s} colorBy={colorBy} onClick={() => onShiftClick(s)} />
                ))}

                <button
                  onClick={() => onAddClick(employee.id, dateStr)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-outline-variant py-1.5 text-xs font-semibold text-on-surface-variant transition hover:border-primary/40 hover:text-primary"
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
  const [publishingEmployeeId, setPublishingEmployeeId] = useState<string | null>(null);
  const [showAvailability, setShowAvailability] = useState(true);
  const [mobileDayIndex, setMobileDayIndex] = useState(0);
  const [copying, setCopying] = useState(false);
  const [branchFilter, setBranchFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredEmployeeId, setHoveredEmployeeId] = useState<string | null>(null);

  const [colorBy, setColorBy] = useState<"branch" | "position">("branch");
  const [draggingShift, setDraggingShift] = useState<Shift | null>(null);
  const [dragOverCellKey, setDragOverCellKey] = useState<string | null>(null);
  const [isAltPressed, setIsAltPressed] = useState(false);

  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showUseTemplate, setShowUseTemplate] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState<{
    template: TemplateSummary;
    employees: { id: string; name: string }[];
  } | null>(null);
  const [eventModal, setEventModal] = useState<
    { mode: "create"; date: string } | { mode: "edit"; eventId: string } | null
  >(null);

  // Listener para detectar tecla Alt/Option y actualizar el cursor de duplicación
  useEffect(() => {
    const handleKeyChange = (e: KeyboardEvent) => {
      setIsAltPressed(e.altKey);
    };
    window.addEventListener("keydown", handleKeyChange);
    window.addEventListener("keyup", handleKeyChange);
    return () => {
      window.removeEventListener("keydown", handleKeyChange);
      window.removeEventListener("keyup", handleKeyChange);
    };
  }, []);

  function checkDragConflict(targetUserId: string, targetDateStr: string): string | null {
    if (!draggingShift || !data) return null;

    const cellKey = `${targetUserId}|${targetDateStr}`;
    const availability = data.availability[cellKey];

    if (availability && availability.type === "UNAVAILABLE") {
      return "Colaborador no disponible este día";
    }

    if (availability && availability.type === "PREFER_OFF") {
      return "Colaborador prefiere descanso este día";
    }

    // Revisar traslape con otros turnos del mismo trabajador en ese día
    const targetCellShifts = data.shifts.filter(
      (s) =>
        s.userId === targetUserId &&
        formatDateOnly(new Date(s.date)) === targetDateStr &&
        s.id !== draggingShift.id &&
        s.type === "TURNO",
    );

    if (draggingShift.startTime && draggingShift.endTime) {
      const dragRange = shiftRangeMinutes(draggingShift.startTime, draggingShift.endTime);
      if (dragRange) {
        for (const existing of targetCellShifts) {
          if (existing.startTime && existing.endTime) {
            const existingRange = shiftRangeMinutes(existing.startTime, existing.endTime);
            if (existingRange && rangesOverlap(dragRange, existingRange)) {
              return `Traslape (${existing.startTime}–${existing.endTime})`;
            }
          }
        }
      }
    }

    return null;
  }

  async function handleDropShift(targetUserId: string, targetDateStr: string, isDuplicate: boolean) {
    if (!draggingShift || !data) return;

    const sourceShift = draggingShift;
    const sourceUserId = sourceShift.userId;
    const sourceDateStr = formatDateOnly(new Date(sourceShift.date));

    // Si es la misma casilla y no es duplicar, no hacer nada
    if (sourceUserId === targetUserId && sourceDateStr === targetDateStr && !isDuplicate) {
      setDraggingShift(null);
      setDragOverCellKey(null);
      return;
    }

    setDraggingShift(null);
    setDragOverCellKey(null);

    const targetEmployee = data.employees.find((e) => e.id === targetUserId);
    const targetEmployeeName = targetEmployee?.name ?? "Colaborador";

    if (isDuplicate) {
      showToast(`Duplicando turno para ${targetEmployeeName}...`);
      const result = await copyShiftToCellAction(sourceShift.id, targetUserId, targetDateStr);
      if ("error" in result && result.error) {
        showToast(result.error, "error");
      } else {
        showToast(`Turno duplicado para ${targetEmployeeName}.`);
        load();
      }
      return;
    }

    // Actualización optimista inmediata en pantalla (movimiento suave y sin parpadeo)
    const previousShifts = data.shifts;
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        shifts: prev.shifts.map((s) =>
          s.id === sourceShift.id
            ? {
                ...s,
                userId: targetUserId,
                date: targetDateStr,
                user: { id: targetUserId, name: targetEmployeeName },
                publicationStatus: "DRAFT" as const,
              }
            : s,
        ),
      };
    });

    const result = await moveScheduledShiftAction(sourceShift.id, {
      userId: targetUserId,
      date: targetDateStr,
    });

    if (result.error) {
      setData((prev) => (prev ? { ...prev, shifts: previousShifts } : prev));
      showToast(result.error, "error");
    } else {
      showToast(`Turno movido a ${targetEmployeeName}.`);
      // Recargar datos frescos en segundo plano
      getScheduleGridForWeek(weekStart).then((res) => {
        if (!("error" in res)) {
          setData(res as unknown as GridData);
        }
      });
    }
  }

  function handleShiftClick(shift: Shift) {
    if (shift.event) {
      setEventModal({ mode: "edit", eventId: shift.event.id });
    } else {
      setModal({ mode: "edit", shift });
    }
  }

  async function load() {
    setLoading(true);
    setError(null);

    const result = await getScheduleGridForWeek(weekStart);

    if ("error" in result) {
      setError(result.error ?? "Error al cargar horarios");
      setData(null);
    } else {
      setData(result as unknown as GridData);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  // En móvil, al cambiar de semana selecciona hoy si cae dentro de ella
  useEffect(() => {
    const idx = Array.from({ length: 7 }, (_, i) => addDaysToDateOnly(weekStart, i)).indexOf(
      todayDateOnly(),
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileDayIndex(idx >= 0 ? idx : 0);
  }, [weekStart]);

  // Listener para salir de pantalla completa con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  async function handleCopyPrevious() {
    setCopying(true);
    setError(null);

    const result = await copyPreviousWeekAction(weekStart);

    setCopying(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    showToast("Semana anterior copiada correctamente.");
    load();
  }

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

  async function handlePublishEmployee(userId: string) {
    setPublishingEmployeeId(userId);
    setError(null);

    const result = await publishEmployeeScheduleAction(weekStart, userId);

    setPublishingEmployeeId(null);

    if (result.error) {
      setError(result.error);
      return;
    }

    showToast("Turnos del trabajador publicados.");
    load();
  }

  const days = useMemo(() => {
    const list: Date[] = [];
    for (let i = 0; i < 7; i++) list.push(parseDateOnly(addDaysToDateOnly(weekStart, i)));
    return list;
  }, [weekStart]);

  const todayStr = todayDateOnly();

  const visibleEmployees = useMemo(() => {
    if (!data) return [];
    let list =
      employeeFilter === "all"
        ? data.employees
        : data.employees.filter((employee) => employee.id === employeeFilter);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((employee) => employee.name.toLowerCase().includes(q));
    }

    return list;
  }, [data, employeeFilter, searchQuery]);

  const visibleShifts = useMemo(() => {
    if (!data) return [];
    return data.shifts.filter((shift) => {
      const matchesEmployee = employeeFilter === "all" || shift.userId === employeeFilter;
      const matchesBranch = branchFilter === "all" || shift.branchId === branchFilter;
      return matchesEmployee && matchesBranch;
    });
  }, [branchFilter, data, employeeFilter]);

  const employeePublication = useMemo(() => {
    const map = new Map<string, { published: boolean; hasShifts: boolean }>();
    if (!data) return map;

    for (const employee of data.employees) {
      const employeeShifts = data.shifts.filter((shift) => shift.userId === employee.id);
      map.set(employee.id, {
        hasShifts: employeeShifts.length > 0,
        published:
          employeeShifts.length > 0 &&
          employeeShifts.every((shift) => shift.publicationStatus === "PUBLISHED"),
      });
    }

    return map;
  }, [data]);

  const shiftsByCell = useMemo(() => {
    const map = new Map<string, Shift[]>();
    if (!data) return map;

    for (const s of visibleShifts) {
      const key = `${s.userId}|${formatDateOnly(new Date(s.date))}`;
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }

    return map;
  }, [data, visibleShifts]);

  const employeeTotals = useMemo(() => {
    const map = new Map<string, { hours: number; turnos: number }>();
    if (!data) return map;

    for (const s of visibleShifts) {
      if (s.type !== "TURNO" || !s.startTime || !s.endTime) continue;
      const current = map.get(s.userId) ?? { hours: 0, turnos: 0 };
      current.hours += shiftHours(s.startTime, s.endTime);
      current.turnos += 1;
      map.set(s.userId, current);
    }

    return map;
  }, [data, visibleShifts]);

  /** Totales diarios para métricas de encabezado y pie de tabla estilo Connecteam */
  const dayTotals = useMemo(() => {
    const map = new Map<string, { shifts: number; hours: number; workers: Set<string> }>();
    if (!data) return map;

    for (const day of days) {
      const dStr = formatDateOnly(day);
      map.set(dStr, { shifts: 0, hours: 0, workers: new Set() });
    }

    for (const s of visibleShifts) {
      if (s.type !== "TURNO" || !s.startTime || !s.endTime) continue;
      const dStr = formatDateOnly(new Date(s.date));
      const entry = map.get(dStr);
      if (entry) {
        entry.shifts += 1;
        entry.hours += shiftHours(s.startTime, s.endTime);
        entry.workers.add(s.userId);
      }
    }

    return map;
  }, [data, days, visibleShifts]);

  const summary = useMemo(() => {
    if (!data) return null;

    const rateByUser = new Map(visibleEmployees.map((e) => [e.id, e.hourlyRate]));
    const peopleSet = new Set<string>();
    let totalHours = 0;
    let totalShifts = 0;
    let totalCost = 0;

    for (const s of visibleShifts) {
      if (s.type !== "TURNO" || !s.startTime || !s.endTime) continue;

      const hours = shiftHours(s.startTime, s.endTime);
      totalHours += hours;
      totalShifts += 1;
      peopleSet.add(s.userId);

      const rate = rateByUser.get(s.userId) ?? null;
      if (rate !== null) totalCost += hours * rate;
    }

    return { totalHours, totalShifts, peopleCount: peopleSet.size, totalCost };
  }, [data, visibleEmployees, visibleShifts]);

  const alerts = useMemo(() => {
    const list: Alert[] = [];
    if (!data) return list;

    const employeeNames = new Map(visibleEmployees.map((e) => [e.id, e.name]));

    const byEmployeeDay = new Map<string, Shift[]>();
    for (const s of visibleShifts) {
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

    for (const employee of visibleEmployees) {
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
  }, [data, employeeTotals, visibleEmployees, visibleShifts]);

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
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-50 flex flex-col bg-background p-2 sm:p-4 overflow-hidden"
          : "space-y-3"
      }
    >
      {/* Barra de Controles y Filtros Superior (Connecteam Style) */}
      <div className="flex flex-col gap-2.5 rounded-xl border border-outline-variant bg-surface-container p-2.5 sm:p-3 shadow-sm">
        {/* Fila 1: Navegación de semana, Búsqueda rápida, Filtros y Pantalla Completa */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Navegación de Semana */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setWeekStart((prev) => addDaysToDateOnly(prev, -7))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant transition hover:border-outline hover:text-on-surface"
              aria-label="Semana anterior"
              title="Semana anterior"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>

            <div className="min-w-[170px] text-center">
              <p className="text-xs font-bold text-on-surface sm:text-sm">{formatWeekRange(weekStart)}</p>
            </div>

            <button
              onClick={() => setWeekStart((prev) => addDaysToDateOnly(prev, 7))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant transition hover:border-outline hover:text-on-surface"
              aria-label="Semana siguiente"
              title="Semana siguiente"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>

            <button
              onClick={() => setWeekStart(getMostRecentMonday())}
              disabled={weekStart === getMostRecentMonday()}
              className="rounded-lg border border-outline-variant px-2.5 py-1 text-xs font-semibold text-on-surface-variant transition hover:border-outline hover:text-on-surface disabled:opacity-40"
            >
              Hoy
            </button>
          </div>

          {/* Búsqueda rápida de trabajador */}
          <div className="relative flex-1 min-w-[160px] max-w-[260px]">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Buscar trabajador..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-full rounded-lg border border-outline-variant bg-background pl-8 pr-7 text-xs font-medium text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant hover:text-on-surface"
                aria-label="Limpiar búsqueda"
              >
                ×
              </button>
            )}
          </div>

          {/* Selector de Sucursal y Empleado */}
          {data && (
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="branch-filter">
                Filtrar por sucursal
              </label>
              <select
                id="branch-filter"
                value={branchFilter}
                onChange={(event) => setBranchFilter(event.target.value)}
                className="h-8 rounded-lg border border-outline-variant bg-background px-2.5 text-xs font-semibold text-on-surface outline-none"
              >
                <option value="all">Todas las sucursales</option>
                {data.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>

              <label className="sr-only" htmlFor="employee-filter">
                Filtrar por empleado
              </label>
              <select
                id="employee-filter"
                value={employeeFilter}
                onChange={(event) => setEmployeeFilter(event.target.value)}
                className="h-8 rounded-lg border border-outline-variant bg-background px-2.5 text-xs font-semibold text-on-surface outline-none"
              >
                <option value="all">Todos los empleados</option>
                {data.employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Acciones principales a la derecha: Pantalla Completa & Publicar */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={toggleFullscreen}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                isFullscreen
                  ? "border-primary bg-primary/10 text-primary hover:bg-primary/20"
                  : "border-outline-variant text-on-surface-variant hover:border-outline hover:text-on-surface"
              }`}
              title={isFullscreen ? "Salir de pantalla completa (Esc)" : "Ver en pantalla completa"}
            >
              {isFullscreen ? (
                <>
                  <MinimizeIcon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Salir</span>
                  <span className="hidden text-[10px] opacity-70 lg:inline">(Esc)</span>
                </>
              ) : (
                <>
                  <MaximizeIcon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Pantalla completa</span>
                </>
              )}
            </button>

            {data && (
              <button
                onClick={handlePublishToggle}
                disabled={publishing || data.shifts.length === 0}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-60 ${
                  data.status === "PUBLISHED"
                    ? "border border-outline-variant text-on-surface-variant hover:border-secondary/40 hover:text-secondary"
                    : "bg-primary text-on-primary hover:opacity-90 shadow-sm"
                }`}
              >
                {publishing
                  ? "Guardando..."
                  : data.status === "PUBLISHED"
                    ? "Despublicar todos"
                    : "Publicar todos"}
              </button>
            )}
          </div>
        </div>

        {/* Fila 2: Leyenda de Sucursales + Acciones secundarias */}
        {data && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/60 pt-2 text-xs">
            {/* Leyenda y Filtro Rápido de Sucursales (Connecteam style) */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                Sucursales:
              </span>
              <button
                type="button"
                onClick={() => setBranchFilter("all")}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition ${
                  branchFilter === "all"
                    ? "bg-primary text-on-primary shadow-xs"
                    : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Todas
              </button>
              {data.branches.map((b) => {
                const bColor = b.color || fallbackBranchColor(b.id);
                const isSelected = branchFilter === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBranchFilter(isSelected ? "all" : b.id)}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
                      isSelected
                        ? "bg-surface-container-highest text-on-surface ring-1 ring-primary"
                        : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: bColor }} />
                    <span>{b.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Opciones adicionales: Color, Disponibilidad, Plantillas, Copiar */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Modo de color estilo Connecteam */}
              <div className="flex items-center rounded-lg border border-outline-variant bg-surface-container p-0.5 text-xs font-semibold">
                <span className="px-1.5 text-[10px] uppercase tracking-wider text-on-surface-variant font-bold hidden sm:inline">
                  Color:
                </span>
                <button
                  type="button"
                  onClick={() => setColorBy("branch")}
                  className={`rounded px-2 py-0.5 text-[10px] font-bold transition ${
                    colorBy === "branch"
                      ? "bg-primary text-on-primary shadow-xs"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                  title="Colores basados en la sucursal"
                >
                  Sucursal
                </button>
                <button
                  type="button"
                  onClick={() => setColorBy("position")}
                  className={`rounded px-2 py-0.5 text-[10px] font-bold transition ${
                    colorBy === "position"
                      ? "bg-primary text-on-primary shadow-xs"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                  title="Colores basados en el puesto (Bartender, Cocina, Mesero, etc.)"
                >
                  Puesto
                </button>
              </div>

              <label className="flex items-center gap-1.5 text-xs font-medium text-on-surface-variant cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showAvailability}
                  onChange={(e) => setShowAvailability(e.target.checked)}
                  className="rounded border-outline-variant accent-primary"
                />
                <span>Disponibilidad</span>
              </label>

              <button
                onClick={handleCopyPrevious}
                disabled={copying}
                className="inline-flex items-center gap-1 rounded-lg border border-outline-variant px-2.5 py-1 text-xs font-semibold text-on-surface-variant transition hover:border-outline hover:text-on-surface disabled:opacity-60"
                title="Copiar turnos de la semana anterior"
              >
                <ClipboardIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{copying ? "Copiando..." : "Copiar anterior"}</span>
              </button>

              <button
                onClick={() => setShowSaveTemplate(true)}
                disabled={data.shifts.length === 0}
                className="inline-flex items-center gap-1 rounded-lg border border-outline-variant px-2.5 py-1 text-xs font-semibold text-on-surface-variant transition hover:border-outline hover:text-on-surface disabled:opacity-40"
              >
                <BookIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Guardar plantilla</span>
              </button>

              <button
                onClick={() => setEventModal({ mode: "create", date: todayStr })}
                className="inline-flex items-center gap-1 rounded-lg border border-outline-variant px-2.5 py-1 text-xs font-semibold text-on-surface-variant transition hover:border-outline hover:text-on-surface"
              >
                <PartyIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Nuevo evento</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-error/40 bg-error/10 p-3 text-xs text-error">
          {error}
        </div>
      )}

      {alerts.length > 0 && <AlertsPanel alerts={alerts} />}

      {/* Barra resumen de métricas */}
      {summary && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-outline-variant/60 bg-surface-container/50 px-3 py-1.5 text-xs text-on-surface-variant">
          <span>
            <strong className="font-bold text-on-surface">{visibleEmployees.length}</strong> trabajadores
          </span>
          <span>•</span>
          <span>
            <strong className="font-bold text-on-surface">{summary.totalShifts}</strong> turnos
          </span>
          <span>•</span>
          <span>
            <strong className="font-bold text-on-surface">{formatHours(summary.totalHours)}</strong> totales
          </span>
          {alerts.length > 0 && (
            <>
              <span>•</span>
              <span className="font-bold text-error">
                {alerts.length} conflicto{alerts.length === 1 ? "" : "s"}
              </span>
            </>
          )}
          <span className="hidden xl:inline text-[11px] text-on-surface-variant/80">
            • 🖐️ <strong className="font-semibold text-on-surface">Arrastra</strong> para mover · <strong className="font-semibold text-on-surface">Alt + Arrastra</strong> para duplicar
          </span>
          <span className="ml-auto hidden font-medium sm:inline">
            Costo proyectado: <strong className="font-bold text-on-surface">{formatCurrency(summary.totalCost)}</strong>
          </span>
        </div>
      )}

      {/* Estado vacío si no hay turnos */}
      {!loading && data && data.shifts.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-outline-variant bg-surface-container p-8 text-center">
          <p className="font-semibold text-on-surface">Esta semana todavía no tiene turnos programados.</p>
          <p className="max-w-md text-xs text-on-surface-variant">
            Haz clic en cualquier celda para agregar un turno, copia la semana anterior, o aplica una plantilla guardada.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            <button
              onClick={handleCopyPrevious}
              disabled={copying}
              className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-3.5 py-2 text-xs font-semibold text-on-surface-variant transition hover:border-primary/40 hover:text-primary disabled:opacity-60"
            >
              <ClipboardIcon className="h-4 w-4" />
              {copying ? "Copiando..." : "Copiar semana anterior"}
            </button>
            <button
              onClick={() => setShowUseTemplate(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-on-primary transition hover:opacity-90 shadow-sm"
            >
              <BookIcon className="h-4 w-4" />
              Usar plantilla
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-on-surface-variant">Cargando horario...</p>
        </div>
      ) : data ? (
        <>
          {/* Vista móvil */}
          <div className="md:hidden">
            <MobileDayView
              days={days}
              dayIndex={mobileDayIndex}
              onSelectDay={setMobileDayIndex}
              todayStr={todayStr}
              employees={visibleEmployees}
              employeeTotals={employeeTotals}
              overtimeEmployeeIds={overtimeEmployeeIds}
              shiftsByCell={shiftsByCell}
              alertCellKeys={alertCellKeys}
              employeePublication={employeePublication}
              publishingEmployeeId={publishingEmployeeId}
              onPublishEmployee={handlePublishEmployee}
              onShiftClick={handleShiftClick}
              onAddClick={(userId, date) => setModal({ mode: "create", userId, date })}
              availability={data.availability}
              showAvailability={showAvailability}
              colorBy={colorBy}
            />
          </div>

          {/* Cuadrícula Desktop Completa estilo Connecteam */}
          <div
            className={`hidden md:block overflow-auto rounded-xl border border-outline-variant bg-surface-container shadow-sm ${
              isFullscreen ? "flex-1 min-h-0" : "max-h-[calc(100vh-230px)]"
            }`}
          >
            <div
              className="grid min-w-[1280px]"
              style={{ gridTemplateColumns: "230px repeat(7, minmax(135px, 1fr)) 95px" }}
            >
              {/* Encabezado Fijo: Columna de Trabajadores */}
              <div className="sticky left-0 top-0 z-30 flex items-center justify-between border-b-2 border-r border-outline-variant bg-surface-container-high px-3 py-2.5 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)]">
                <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">
                  Trabajador
                </span>
                <span className="rounded bg-surface-container-highest px-1.5 py-0.5 text-[9px] font-bold text-on-surface-variant">
                  {visibleEmployees.length}
                </span>
              </div>

              {/* Encabezados Fijos: Días de la semana con Totales Diarios (Connecteam) */}
              {days.map((day, i) => {
                const dStr = formatDateOnly(day);
                const isToday = dStr === todayStr;
                const dayTot = dayTotals.get(dStr) ?? { shifts: 0, hours: 0, workers: new Set() };

                return (
                  <div
                    key={i}
                    className={`sticky top-0 z-20 border-b-2 border-r border-outline-variant px-2 py-2 text-center transition-colors ${
                      isToday
                        ? "border-b-primary bg-primary/[0.08]"
                        : "border-b-outline-variant bg-surface-container-high"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span
                        className={`text-[10px] font-black uppercase tracking-wider ${
                          isToday ? "text-primary" : "text-on-surface-variant"
                        }`}
                      >
                        {DAY_LABELS[i]}
                      </span>
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-black ${
                          isToday
                            ? "bg-primary text-on-primary shadow-xs"
                            : "text-on-surface font-semibold"
                        }`}
                      >
                        {day.getUTCDate()}
                      </span>
                    </div>

                    {/* Resumen diario de personal estilo Connecteam */}
                    <div className="mt-1 flex items-center justify-center gap-1 text-[10px] font-medium text-on-surface-variant">
                      <span className="font-semibold text-on-surface">{dayTot.shifts} t.</span>
                      <span>·</span>
                      <span className="font-mono text-[10px]">{formatHours(dayTot.hours)}</span>
                    </div>
                  </div>
                );
              })}

              {/* Encabezado Fijo: Total por Empleado */}
              <div className="sticky right-0 top-0 z-30 flex items-center justify-center border-b-2 border-l border-outline-variant bg-surface-container-high px-2 py-2.5 text-center shadow-[-2px_0_6px_-2px_rgba(0,0,0,0.06)]">
                <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">
                  Total Sem
                </span>
              </div>

              {/* Mensaje si no hay trabajadores tras filtrar */}
              {visibleEmployees.length === 0 && (
                <div className="col-span-9 p-8 text-center text-sm text-on-surface-variant">
                  {searchQuery
                    ? `No se encontraron trabajadores que coincidan con "${searchQuery}".`
                    : "No hay personal activo para programar."}
                </div>
              )}

              {/* Filas de Empleados */}
              {visibleEmployees.map((employee) => {
                const totals = employeeTotals.get(employee.id) ?? { hours: 0, turnos: 0 };
                const isRowHovered = hoveredEmployeeId === employee.id;

                return (
                  <Fragment key={employee.id}>
                    {/* Columna Izquierda Fija: Información del Trabajador */}
                    <div
                      onMouseEnter={() => setHoveredEmployeeId(employee.id)}
                      onMouseLeave={() => setHoveredEmployeeId(null)}
                      className={`sticky left-0 z-20 flex min-h-[50px] items-center gap-2.5 border-b border-r border-outline-variant px-3 py-1.5 transition-colors shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)] ${
                        isRowHovered ? "bg-surface-container-high" : "bg-surface-container"
                      }`}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-black text-primary ring-1 ring-primary/20">
                        {getInitials(employee.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-on-surface" title={employee.name}>
                          {employee.name}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[10px]">
                          <span
                            className={`font-mono font-bold ${
                              overtimeEmployeeIds.has(employee.id)
                                ? "text-secondary font-black"
                                : "text-on-surface-variant"
                            }`}
                          >
                            {overtimeEmployeeIds.has(employee.id) && "⚠️ "}
                            {formatHours(totals.hours)}
                          </span>
                          <span className="text-on-surface-variant/40">·</span>
                          <span className="text-on-surface-variant">
                            {totals.turnos} t.
                          </span>
                        </div>
                        {(() => {
                          const publication = employeePublication.get(employee.id) ?? {
                            published: false,
                            hasShifts: false,
                          };
                          if (!publication.hasShifts) return null;
                          return (
                            <button
                              type="button"
                              onClick={() => handlePublishEmployee(employee.id)}
                              disabled={
                                publication.published || publishingEmployeeId === employee.id
                              }
                              className={`mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider transition disabled:cursor-default ${
                                publication.published
                                  ? "bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim opacity-90"
                                  : "bg-primary/15 text-primary hover:bg-primary/25"
                              }`}
                            >
                              {publishingEmployeeId === employee.id ? (
                                "..."
                              ) : publication.published ? (
                                <>
                                  <CheckIcon className="h-2.5 w-2.5" />
                                  <span>Publicado</span>
                                </>
                              ) : (
                                "Publicar"
                              )}
                            </button>
                          );
                        })()}
                      </div>
                    </div>

                    {/* 7 Celdas de Días */}
                    {days.map((day, i) => {
                      const dateStr = formatDateOnly(day);
                      const key = `${employee.id}|${dateStr}`;
                      const cellShifts = shiftsByCell.get(key) ?? [];
                      const hasAlert = alertCellKeys.has(key);
                      const availability = data.availability[key];
                      const isDragOver = dragOverCellKey === key;
                      const dragConflict = isDragOver ? checkDragConflict(employee.id, dateStr) : null;

                      return (
                        <div
                          key={i}
                          onMouseEnter={() => setHoveredEmployeeId(employee.id)}
                          onMouseLeave={() => setHoveredEmployeeId(null)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = e.altKey || isAltPressed ? "copy" : "move";
                            if (dragOverCellKey !== key) {
                              setDragOverCellKey(key);
                            }
                          }}
                          onDragLeave={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                              if (dragOverCellKey === key) {
                                setDragOverCellKey(null);
                              }
                            }
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const isDuplicate = e.altKey || isAltPressed;
                            void handleDropShift(employee.id, dateStr, isDuplicate);
                          }}
                          className={`group relative min-h-[50px] p-1 border-b border-r border-outline-variant transition-all ${
                            isDragOver
                              ? dragConflict
                                ? "bg-error/20 ring-2 ring-inset ring-error"
                                : "bg-primary/15 ring-2 ring-inset ring-primary"
                              : isRowHovered
                                ? "bg-primary/[0.03]"
                                : ""
                          } ${
                            hasAlert && !isDragOver
                              ? "bg-error/[0.06] ring-1 ring-inset ring-error/40"
                              : ""
                          }`}
                        >
                          {/* Banner de Feedback al arrastrar estilo Connecteam */}
                          {isDragOver && (
                            <div
                              className={`pointer-events-none absolute inset-x-1 top-1 z-30 flex items-center justify-center rounded px-1.5 py-0.5 text-[9px] font-bold shadow-md transition-transform animate-in fade-in zoom-in-95 duration-100 ${
                                dragConflict
                                  ? "bg-error text-on-error"
                                  : "bg-primary text-on-primary"
                              }`}
                            >
                              <span className="truncate">
                                {dragConflict
                                  ? `⚠️ ${dragConflict}`
                                  : isAltPressed
                                    ? "Duplicar aquí (+)"
                                    : "Soltar para mover"}
                              </span>
                            </div>
                          )}

                          {/* Alerta de Traslape */}
                          {hasAlert && !isDragOver && (
                            <div className="mb-1 flex items-center gap-1 rounded bg-error/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-error">
                              <AlertIcon className="h-2.5 w-2.5 shrink-0" />
                              <span>Traslape</span>
                            </div>
                          )}

                          {/* Indicador de Disponibilidad no intrusivo (Connecteam) */}
                          {showAvailability && availability && availability.type !== "AVAILABLE_ALL_DAY" && !isDragOver && (
                            <>
                              {availability.type === "UNAVAILABLE" && (
                                <div className="mb-1 flex items-center gap-1 rounded bg-error/10 px-1 py-0.5 text-[9px] font-bold text-error">
                                  <span className="h-1.5 w-1.5 rounded-full bg-error" />
                                  <span className="truncate">No disp.</span>
                                </div>
                              )}
                              {availability.type === "PREFER_OFF" && (
                                <div className="mb-1 flex items-center gap-1 rounded bg-secondary/10 px-1 py-0.5 text-[9px] font-semibold text-secondary">
                                  <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
                                  <span className="truncate">Pref. descanso</span>
                                </div>
                              )}
                              {availability.type === "AVAILABLE_PARTIAL" && (
                                <div className="mb-1 flex items-center gap-1 rounded bg-surface-container-highest px-1 py-0.5 text-[9px] font-medium text-on-surface-variant">
                                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                  <span className="truncate">
                                    {availability.startTime}–{availability.endTime}
                                  </span>
                                </div>
                              )}
                            </>
                          )}

                          {/* Turnos en la Celda */}
                          {cellShifts.length === 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setModal({ mode: "create", userId: employee.id, date: dateStr })
                              }
                              className="flex h-full min-h-[42px] w-full items-center justify-center rounded-md border border-dashed border-transparent transition group-hover:border-primary/40 group-hover:bg-primary/[0.04]"
                              aria-label={`Agregar turno a ${employee.name} el ${formatAlertDate(dateStr)}`}
                            >
                              <span className="flex items-center gap-1 text-[11px] font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                                <PlusIcon className="h-3 w-3" />
                                <span>Turno</span>
                              </span>
                            </button>
                          ) : (
                            <div className="space-y-1">
                              {cellShifts.map((s) => (
                                <ShiftBlock
                                  key={s.id}
                                  shift={s}
                                  colorBy={colorBy}
                                  isDragging={draggingShift?.id === s.id}
                                  onClick={() => handleShiftClick(s)}
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData("text/plain", s.id);
                                    e.dataTransfer.effectAllowed = "copyMove";
                                    setDraggingShift(s);
                                  }}
                                  onDragEnd={() => {
                                    setDraggingShift(null);
                                    setDragOverCellKey(null);
                                  }}
                                />
                              ))}

                              {/* Botón sutil para agregar otro turno en el mismo día */}
                              <button
                                type="button"
                                onClick={() =>
                                  setModal({ mode: "create", userId: employee.id, date: dateStr })
                                }
                                className="flex w-full items-center justify-center gap-1 rounded py-0.5 text-[9px] font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100 hover:bg-primary/[0.08]"
                                aria-label="Agregar otro turno"
                              >
                                <PlusIcon className="h-2.5 w-2.5" />
                                <span>Otro</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Columna Derecha Fija: Total Semanal del Empleado */}
                    <div
                      onMouseEnter={() => setHoveredEmployeeId(employee.id)}
                      onMouseLeave={() => setHoveredEmployeeId(null)}
                      className={`sticky right-0 z-20 flex min-h-[50px] flex-col items-center justify-center border-b border-l border-outline-variant px-2 text-center transition-colors shadow-[-2px_0_6px_-2px_rgba(0,0,0,0.06)] ${
                        isRowHovered ? "bg-surface-container-high" : "bg-surface-container"
                      }`}
                    >
                      <span
                        className={`font-mono text-xs font-extrabold ${
                          overtimeEmployeeIds.has(employee.id)
                            ? "text-secondary font-black"
                            : "text-on-surface"
                        }`}
                      >
                        {formatHours(totals.hours)}
                      </span>
                      <span className="text-[9px] text-on-surface-variant">
                        {totals.turnos} t.
                      </span>
                    </div>
                  </Fragment>
                );
              })}

              {/* Fila Fija Inferior: Totales Diarios de la Semana (Connecteam style) */}
              {visibleEmployees.length > 0 && (
                <div className="contents">
                  <div className="sticky bottom-0 left-0 z-20 flex min-h-[44px] items-center border-t-2 border-r border-outline-variant bg-surface-container-high px-3 py-1.5 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-on-surface">
                        Totales del día
                      </p>
                      <p className="text-[9px] text-on-surface-variant">
                        {summary ? `${summary.peopleCount} activos` : ""}
                      </p>
                    </div>
                  </div>

                  {days.map((day, i) => {
                    const dStr = formatDateOnly(day);
                    const isToday = dStr === todayStr;
                    const dayTot = dayTotals.get(dStr) ?? { shifts: 0, hours: 0, workers: new Set() };

                    return (
                      <div
                        key={i}
                        className={`sticky bottom-0 z-10 flex min-h-[44px] flex-col items-center justify-center border-t-2 border-r border-outline-variant px-2 py-1 text-center ${
                          isToday ? "bg-primary/[0.08]" : "bg-surface-container-high"
                        }`}
                      >
                        <span className="font-mono text-xs font-black text-on-surface">
                          {formatHours(dayTot.hours)}
                        </span>
                        <span className="text-[9px] font-medium text-on-surface-variant">
                          {dayTot.shifts} t. · {dayTot.workers.size} pers.
                        </span>
                      </div>
                    );
                  })}

                  <div className="sticky bottom-0 right-0 z-20 flex min-h-[44px] flex-col items-center justify-center border-t-2 border-l border-outline-variant bg-surface-container-high px-2 py-1 text-center shadow-[-2px_0_6px_-2px_rgba(0,0,0,0.08)]">
                    <span className="font-mono text-xs font-black text-primary">
                      {summary ? formatHours(summary.totalHours) : "0h"}
                    </span>
                    <span className="text-[9px] font-bold text-on-surface-variant">Gran total</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}

      {/* Modales */}
      {modal && data && (
        <ShiftModal
          employees={data.employees}
          branches={data.branches}
          templates={data.templates}
          weekDates={days.map((d) => formatDateOnly(d))}
          availability={data.availability}
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

      {showSaveTemplate && data && (
        <SaveAsTemplateModal
          weekStart={weekStart}
          branches={data.branches}
          onClose={() => setShowSaveTemplate(false)}
          onSaved={() => setShowSaveTemplate(false)}
        />
      )}

      {showUseTemplate && (
        <UseTemplateModal
          onClose={() => setShowUseTemplate(false)}
          onPick={(template, templateEmployees) => {
            setShowUseTemplate(false);
            setApplyingTemplate({ template, employees: templateEmployees });
          }}
        />
      )}

      {applyingTemplate && (
        <ApplyTemplateModal
          templateId={applyingTemplate.template.id}
          templateName={applyingTemplate.template.name}
          employees={applyingTemplate.employees}
          defaultWeekStart={weekStart}
          onClose={() => setApplyingTemplate(null)}
          onApplied={() => {
            setApplyingTemplate(null);
            load();
          }}
        />
      )}

      {eventModal && data && (
        <EventModal
          eventId={eventModal.mode === "edit" ? eventModal.eventId : undefined}
          defaultDate={eventModal.mode === "create" ? eventModal.date : todayStr}
          employees={data.employees}
          branches={data.branches}
          onClose={() => setEventModal(null)}
          onSaved={() => {
            setEventModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}
