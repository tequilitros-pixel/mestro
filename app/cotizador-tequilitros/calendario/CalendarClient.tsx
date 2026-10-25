"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { getCalendarMonthAction } from "../actions";
import {
  type DayAvailability,
  MAX_CONFIRMED_EVENTS_PER_DAY,
} from "@/lib/tequilitros/quote-types";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
  PlusIcon,
  XIcon,
} from "@/components/ui/icons";

interface CalendarClientProps {
  initialYear: number;
  initialMonth: number;
  daysData: DayAvailability[];
}

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const WEEKDAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function CalendarClient({
  initialYear,
  initialMonth,
  daysData,
}: CalendarClientProps) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth); // 1-12
  const [calendarDays, setCalendarDays] = useState(daysData);
  const [selectedDay, setSelectedDay] = useState<DayAvailability | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function changeMonth(direction: -1 | 1) {
    const nextMonth = month + direction;
    const targetMonth = nextMonth === 0 ? 12 : nextMonth === 13 ? 1 : nextMonth;
    const targetYear = nextMonth === 0 ? year - 1 : nextMonth === 13 ? year + 1 : year;

    setCalendarError(null);
    startTransition(async () => {
      try {
        const nextDays = await getCalendarMonthAction(targetYear, targetMonth);
        setYear(targetYear);
        setMonth(targetMonth);
        setCalendarDays(nextDays);
        setSelectedDay(null);
      } catch {
        setCalendarError("No se pudo cargar la disponibilidad del mes solicitado.");
      }
    });
  }

  // Primer día de la semana del mes
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Encabezado del Calendario */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-outline-variant pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
              <CalendarIcon className="h-4 w-4" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-on-surface">
              Calendario de Disponibilidad
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-on-surface-variant">
            Semáforo de fechas: Monitorea disponibilidad, cotizaciones tentativas y fechas saturadas.
          </p>
        </div>

        {/* Controles de mes y año */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeMonth(-1)}
            disabled={isPending}
            className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition"
            title="Mes anterior"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <span className="min-w-36 text-center text-base font-bold text-on-surface" aria-live="polite">
            {MONTH_NAMES[month - 1]} {year}{isPending ? "…" : ""}
          </span>
          <button
            onClick={() => changeMonth(1)}
            disabled={isPending}
            className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition"
            title="Mes siguiente"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {calendarError && (
        <p className="rounded-xl border border-error/30 bg-error/15 px-4 py-3 text-xs text-error">
          {calendarError}
        </p>
      )}

      {/* Leyenda del Semáforo */}
      <div className="flex flex-wrap items-center gap-4 text-xs bg-surface-container px-4 py-2.5 rounded-xl border border-outline-variant">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-emerald-500" />
          <span className="font-semibold text-on-surface">Verde:</span>
          <span className="text-on-surface-variant">Disponible</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-amber-500" />
          <span className="font-semibold text-on-surface">Amarillo:</span>
          <span className="text-on-surface-variant">Cotización pendiente (sugerir anticipo)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-red-500" />
          <span className="font-semibold text-on-surface">Rojo:</span>
          <span className="text-on-surface-variant">
            3 eventos confirmados (Capacidad Máxima)
          </span>
        </div>
      </div>

      {/* Grid del Calendario */}
      <div className="rounded-2xl border border-outline-variant bg-surface-container-low overflow-hidden shadow-sm">
        {/* Cabecera Días de la semana */}
        <div className="grid grid-cols-7 border-b border-outline-variant bg-surface-container text-center text-xs font-bold text-on-surface-variant py-2.5">
          {WEEKDAY_NAMES.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        {/* Celdas de los días */}
        <div className="grid grid-cols-7 divide-x divide-y divide-outline-variant">
          {/* Celdas vacías antes del día 1 */}
          {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
            <div key={`empty-${idx}`} className="h-24 sm:h-32 bg-surface-container-lowest/50 p-2" />
          ))}

          {/* Días del mes */}
          {calendarDays.map((dayItem) => {
            const dayNum = parseInt(dayItem.dateStr.slice(8), 10);
            const isRed = dayItem.status === "RED";
            const isYellow = dayItem.status === "YELLOW";
            const isGreen = dayItem.status === "GREEN";

            return (
              <div
                key={dayItem.dateStr}
                onClick={() => setSelectedDay(dayItem)}
                className={`group relative h-24 sm:h-32 p-2 sm:p-2.5 flex flex-col justify-between cursor-pointer transition ${
                  isRed
                    ? "bg-red-500/10 hover:bg-red-500/20"
                    : isYellow
                    ? "bg-amber-500/10 hover:bg-amber-500/20"
                    : "bg-surface hover:bg-surface-container"
                }`}
              >
                {/* Número del día y badge */}
                <div className="flex items-start justify-between">
                  <span
                    className={`text-xs sm:text-sm font-bold font-mono rounded-md px-1.5 py-0.5 ${
                      isRed
                        ? "bg-red-500 text-white"
                        : isYellow
                        ? "bg-amber-500 text-black"
                        : "text-on-surface"
                    }`}
                  >
                    {dayNum}
                  </span>

                  <span
                    className={`h-2 w-2 rounded-full ${
                      isRed ? "bg-red-500" : isYellow ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                  />
                </div>

                {/* Resumen del día */}
                <div className="space-y-0.5 text-[10px] sm:text-xs">
                  {dayItem.confirmedCount > 0 && (
                    <p className="font-semibold text-red-400 truncate">
                      🔴 {dayItem.confirmedCount} confirmado{dayItem.confirmedCount > 1 ? "s" : ""}
                    </p>
                  )}
                  {dayItem.pendingCount > 0 && (
                    <p className="font-semibold text-amber-400 truncate">
                      🟡 {dayItem.pendingCount} pendiente{dayItem.pendingCount > 1 ? "s" : ""}
                    </p>
                  )}
                  {dayItem.confirmedCount === 0 && dayItem.pendingCount === 0 && (
                    <p className="text-emerald-500/80 hidden sm:block">Disponible</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL O PANEL DE DETALLE AL DAR CLIC EN UN DÍA */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-outline-variant bg-surface p-6 shadow-2xl text-on-surface space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div>
                <p className="text-xs uppercase font-bold text-on-surface-variant">Detalle de Fecha</p>
                <h3 className="text-lg font-bold text-on-surface">
                  {new Date(selectedDay.dateStr + "T12:00:00Z").toLocaleDateString("es-MX", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-high transition"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Estado general del día */}
            <div
              className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                selectedDay.status === "RED"
                  ? "bg-red-500/15 border-red-500/30 text-red-400"
                  : selectedDay.status === "YELLOW"
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                  : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
              }`}
            >
              <div>
                <strong className="block text-sm">
                  {selectedDay.status === "RED"
                    ? "🔴 Capacidad Máxima (Saturado)"
                    : selectedDay.status === "YELLOW"
                    ? "🟡 Fecha Tentativa (Cotizaciones en Proceso)"
                    : "🟢 Fecha Totalmente Disponible"}
                </strong>
                <span className="text-[11px] opacity-90">
                  {selectedDay.confirmedCount} evento(s) confirmado(s) · {selectedDay.pendingCount} cotización(es) en espera
                </span>
              </div>
              <span className="font-mono text-xs font-bold">
                Límite: {MAX_CONFIRMED_EVENTS_PER_DAY} barras
              </span>
            </div>

            {/* Lista de eventos del día */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Movimientos Agendados ({selectedDay.events.length})
              </p>

              {selectedDay.events.length === 0 ? (
                <p className="text-xs text-on-surface-variant py-4 text-center italic bg-surface-container rounded-lg">
                  No hay cotizaciones ni eventos para este día.
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedDay.events.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-3 rounded-xl border border-outline-variant bg-surface-container flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              ev.isConfirmed
                                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            }`}
                          >
                            {ev.isConfirmed ? "CONFIRMADO" : "PENDIENTE"}
                          </span>
                          <span className="font-mono font-bold text-on-surface">{ev.code}</span>
                        </div>
                        <p className="font-semibold text-on-surface mt-1">{ev.clientName}</p>
                        <p className="text-[11px] text-on-surface-variant">
                          {ev.guestCount} personas · Atendido por: {ev.creatorName}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Botón para cotizar para esta fecha si no está saturado */}
            <div className="pt-2">
              {selectedDay.status !== "RED" ? (
                <Link
                  href="/cotizador-tequilitros"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 px-4 text-xs font-bold text-on-primary hover:opacity-90 transition"
                >
                  <PlusIcon className="h-4 w-4" />
                  <span>Crear Cotización en el Cotizador</span>
                </Link>
              ) : (
                <p className="text-xs text-center text-red-400 font-semibold py-2">
                  Esta fecha ya cuenta con 3 eventos confirmados. No es posible agendar más barras móviles.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
