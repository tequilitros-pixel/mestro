"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarIcon, ClockIcon } from "@/components/ui/icons";

type Shift = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  notes: string | null;
  branch: { id: string; name: string };
};

type OpenShift = {
  id: string;
  clockIn: string;
  branch: { id: string; name: string };
} | null;

type CalendarViewProps = {
  shifts: Shift[];
  openShift: OpenShift;
};

const DIAS = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function CalendarView({ shifts, openShift }: CalendarViewProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayKey = dateKey(today);

  const byDate = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const shift of shifts) {
      const key = shift.date.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(shift);
      map.set(key, list);
    }
    return map;
  }, [shifts]);

  // Franja de 21 días a partir de hoy, para que siempre haya algo que recorrer
  // aunque el turno más próximo esté varios días adelante.
  const days = useMemo(() => {
    const list: Date[] = [];
    for (let i = 0; i < 21; i += 1) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      list.push(d);
    }
    return list;
  }, [today]);

  const firstDateWithShift = shifts.length > 0 ? shifts[0].date.slice(0, 10) : todayKey;

  const [selectedKey, setSelectedKey] = useState(firstDateWithShift);

  const selectedDate = new Date(`${selectedKey}T00:00:00`);
  const selectedShifts = byDate.get(selectedKey) ?? [];

  const monthLabel = `${MESES[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;

  return (
    <main className="min-h-screen bg-background text-on-surface">
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-outline">
              {monthLabel}
            </p>
            <h1 className="mt-1 text-3xl font-bold text-on-surface">Mi calendario</h1>
          </div>

          <Link
            href="/timeclock"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-container border border-outline-variant text-on-surface-variant transition hover:border-primary/25 hover:text-primary"
            aria-label="Ir al checador"
          >
            <ClockIcon className="h-5 w-5" />
          </Link>
        </div>

        {/* Selector de día */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {days.map((day) => {
            const key = dateKey(day);
            const isSelected = key === selectedKey;
            const isToday = key === todayKey;
            const hasShift = byDate.has(key);

            return (
              <button
                key={key}
                onClick={() => setSelectedKey(key)}
                className={`flex shrink-0 flex-col items-center gap-1 rounded-xl px-3.5 py-3 transition ${
                  isSelected
                    ? "bg-primary text-on-surface"
                    : isToday
                      ? "bg-surface-container-high text-on-surface border border-primary/40"
                      : "bg-surface-container text-on-surface-variant border border-outline-variant"
                }`}
              >
                <span className="font-mono text-[10px] font-bold tracking-wider">
                  {DIAS[day.getDay()]}
                </span>
                <span className="font-mono text-base font-bold">
                  {day.getDate()}
                </span>
                <span
                  className={`h-1 w-1 rounded-full ${
                    hasShift
                      ? isSelected
                        ? "bg-surface-container"
                        : "bg-primary"
                      : "bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Turnos del día seleccionado */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-on-surface-variant">
              {selectedDate.toLocaleDateString("es-MX", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>

            {selectedKey === todayKey && (
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                Hoy
              </span>
            )}
          </div>

          {selectedShifts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-outline-variant py-10 text-center text-outline">
              <CalendarIcon className="h-8 w-8 text-on-surface-variant" />
              <p className="text-sm">Sin turno programado este día.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedShifts.map((shift) => {
                const isTodayShift = selectedKey === todayKey;
                const isActive =
                  isTodayShift &&
                  openShift !== null &&
                  openShift.branch.id === shift.branch.id;
                const isPast = selectedKey < todayKey;

                const status = isActive
                  ? { label: "EN TURNO", tone: "bg-tertiary-fixed-dim/10 text-tertiary-fixed-dim" }
                  : isPast
                    ? { label: "COMPLETADO", tone: "bg-surface-container-highest text-on-surface-variant" }
                    : { label: "PROGRAMADO", tone: "bg-secondary/10 text-secondary" };

                return (
                  <div
                    key={shift.id}
                    className={`rounded-2xl p-4 ${
                      isActive
                        ? "bg-surface-container ring-1 ring-tertiary-fixed-dim/40"
                        : "bg-surface-container border border-outline-variant"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-on-surface">{shift.branch.name}</p>
                        <p className="mt-1 font-mono text-sm text-on-surface-variant">
                          {shift.startTime} — {shift.endTime}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-3 py-1 font-mono text-[10px] font-bold tracking-widest ${status.tone}`}
                      >
                        {status.label}
                      </span>
                    </div>

                    {isActive && (
                      <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-container-high">
                        <div className="h-full w-3/4 bg-tertiary-fixed-dim" />
                      </div>
                    )}

                    {shift.notes && (
                      <p className="mt-3 text-sm text-on-surface-variant">{shift.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
