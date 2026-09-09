"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";

type WorkingRow = {
  id: string;
  name: string;
  branchName: string;
  branchTimezone: string | null;
  startedAt: string;
};

type CompletedRow = WorkingRow & { endedAt: string; workedMinutes: number };

const time = (value: string, timezone: string | null) =>
  new Intl.DateTimeFormat("es-MX", {
    timeZone: timezone ?? "America/Mexico_City",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));

const elapsed = (seconds: number) =>
  [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");

const worked = (minutes: number) => `${Math.floor(minutes / 60)} h ${minutes % 60} min`;

export function AdminClockBoard({
  now,
  working,
  completed,
}: {
  now: number;
  working: WorkingRow[];
  completed: CompletedRow[];
}) {
  const [currentNow, setCurrentNow] = useState(now);
  useEffect(() => {
    const anchor = performance.now();
    const tick = () => setCurrentNow(now + performance.now() - anchor);
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [now]);

  return (
    <>
      <section aria-labelledby="working-now-heading" className="space-y-3">
        <div>
          <h2 id="working-now-heading" className="text-xl font-black">Trabajando ahora</h2>
          <p className="text-sm text-on-surface-variant">Personas con una entrada activa en este momento.</p>
        </div>
        {working.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {working.map((row) => (
              <Card key={row.id} className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-black">{row.name}</h3>
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">En curso</span>
                </div>
                <p className="text-sm">{row.branchName}</p>
                <div className="grid grid-cols-2 gap-2 text-sm text-on-surface-variant">
                  <p><span className="text-xs">Entrada</span><br /><strong className="text-on-surface">{time(row.startedAt, row.branchTimezone)}</strong></p>
                  <p><span className="text-xs">Tiempo trabajado</span><br /><strong className="font-mono text-on-surface">{elapsed(Math.max(0, Math.floor((currentNow - Date.parse(row.startedAt)) / 1000)))}</strong></p>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card><p className="text-sm text-on-surface-variant">Nadie tiene un turno activo ahora.</p></Card>
        )}
      </section>

      <section aria-labelledby="completed-today-heading" className="space-y-3">
        <div>
          <h2 id="completed-today-heading" className="text-xl font-black">Terminados hoy</h2>
          <p className="text-sm text-on-surface-variant">Jornadas cerradas en la fecha local de cada sucursal.</p>
        </div>
        {completed.length ? (
          <div className="space-y-2">
            {completed.map((row) => (
              <Card key={row.id} className="grid gap-2 text-sm sm:grid-cols-[1.2fr_1fr_1fr_1fr] sm:items-center">
                <p className="font-bold">{row.name}<br /><span className="font-normal text-on-surface-variant">{row.branchName}</span></p>
                <p><span className="text-xs text-on-surface-variant">Entrada</span><br />{time(row.startedAt, row.branchTimezone)}</p>
                <p><span className="text-xs text-on-surface-variant">Salida</span><br />{time(row.endedAt, row.branchTimezone)}</p>
                <p><span className="text-xs text-on-surface-variant">Total</span><br /><strong>{worked(row.workedMinutes)}</strong></p>
              </Card>
            ))}
          </div>
        ) : (
          <Card><p className="text-sm text-on-surface-variant">Todavía no hay turnos terminados hoy.</p></Card>
        )}
      </section>
    </>
  );
}
