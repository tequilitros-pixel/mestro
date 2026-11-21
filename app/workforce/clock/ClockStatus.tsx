"use client";

import { useEffect, useState } from "react";
import {
  clockStateLabel,
  displayedSession,
  durationClock,
  type DisplayClockEvent,
} from "./presentation";

export function ClockStatus({
  events,
  name,
  branches,
  serverNow,
  state,
}: {
  events: DisplayClockEvent[];
  name: string;
  branches: { id: string; name: string; timezone: string | null }[];
  serverNow: number;
  state: string;
}) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const anchor = performance.now();
    const tick = () => setNow(serverNow + performance.now() - anchor);
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [serverNow]);

  const session = displayedSession(events, now);
  const branch = branches.find((item) => item.id === session?.branchId);
  const time = (value: string) =>
    new Intl.DateTimeFormat("es-MX", {
      timeZone: branch?.timezone ?? "America/Mexico_City",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(value));
  const ongoing = state !== "NO_SESSION" && session && !session.endedAt;

  return (
    <div className="space-y-3 text-center">
      <h2 className="text-2xl font-bold">
        {ongoing ? clockStateLabel(state) : session?.endedAt ? "Turno finalizado" : "Sin turno activo"}
      </h2>
      {ongoing ? (
        <div>
          <p
            role="timer"
            aria-label="Tiempo trabajado"
            className="font-mono text-5xl font-bold tabular-nums sm:text-6xl"
          >
            {durationClock(session.seconds)}
          </p>
          <p className="mt-1 text-sm text-on-surface-variant">Tiempo trabajado</p>
        </div>
      ) : null}
      <p className="text-xl font-semibold">{name}</p>
      {session && (ongoing || session.endedAt) ? (
        <div className="space-y-1 text-sm text-on-surface-variant">
          {session.endedAt ? (
            <p className="font-semibold text-on-surface">
              Tiempo trabajado: {Math.floor(session.seconds / 3600)} h {String(Math.floor((session.seconds % 3600) / 60)).padStart(2, "0")} min
            </p>
          ) : null}
          <p>Entrada: {time(session.startedAt)}</p>
          {session.endedAt ? <p>Salida: {time(session.endedAt)}</p> : null}
          <p>Sucursal: {branch?.name ?? "No disponible"}</p>
        </div>
      ) : null}
    </div>
  );
}
