"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatBusinessDateTime } from "@/lib/dateTime";
import { SearchIcon, XIcon, PlusIcon } from "@/components/ui/icons";
import type { ServiceEventStatus } from "@prisma/client";

type EventItem = {
  id: string;
  code: string;
  clientName: string;
  clientPhone: string | null;
  location: string;
  eventDate: Date | string;
  guestCount: number;
  saleAmount: number | null;
  status: ServiceEventStatus;
  notes: string | null;
  package: { id: string; name: string } | null;
  equipmentKit: { id: string; name: string } | null;
};

const statusConfig: Record<
  ServiceEventStatus,
  { label: string; badgeClass: string }
> = {
  DRAFT: {
    label: "Borrador",
    badgeClass: "bg-surface-container-highest text-on-surface-variant",
  },
  PREPARING: {
    label: "Preparando",
    badgeClass: "bg-secondary/20 text-secondary border border-secondary/30",
  },
  READY: {
    label: "Listo para salir",
    badgeClass: "bg-primary/20 text-primary border border-primary/30",
  },
  IN_PROGRESS: {
    label: "En curso",
    badgeClass: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  },
  RETURN_PENDING: {
    label: "Pendiente de regreso",
    badgeClass: "bg-orange-500/20 text-orange-400 border border-orange-500/30",
  },
  COMPLETED: {
    label: "Completado",
    badgeClass: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  },
  CANCELLED: {
    label: "Cancelado / Archivado",
    badgeClass: "bg-error/15 text-error border border-error/25",
  },
};

type TabFilter = "ACTIVE" | "RETURN_PENDING" | "COMPLETED" | "ARCHIVED" | "ALL";

export default function EventsListClient({
  events,
}: {
  events: EventItem[];
}) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabFilter>("ACTIVE");

  const counts = useMemo(() => {
    let active = 0;
    let returnPending = 0;
    let completed = 0;
    let archived = 0;

    for (const ev of events) {
      if (ev.status === "CANCELLED") archived++;
      else if (ev.status === "COMPLETED") completed++;
      else if (ev.status === "RETURN_PENDING") {
        returnPending++;
        active++;
      } else {
        active++;
      }
    }
    return { active, returnPending, completed, archived, total: events.length };
  }, [events]);

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((ev) => {
      // Filtro de pestaña
      if (tab === "ACTIVE") {
        if (ev.status === "COMPLETED" || ev.status === "CANCELLED") return false;
      } else if (tab === "RETURN_PENDING") {
        if (ev.status !== "RETURN_PENDING") return false;
      } else if (tab === "COMPLETED") {
        if (ev.status !== "COMPLETED") return false;
      } else if (tab === "ARCHIVED") {
        if (ev.status !== "CANCELLED") return false;
      }

      // Filtro de texto
      if (!q) return true;
      const clientMatch = ev.clientName.toLowerCase().includes(q);
      const locMatch = ev.location.toLowerCase().includes(q);
      const codeMatch = ev.code.toLowerCase().includes(q);
      const pkgMatch = ev.package?.name.toLowerCase().includes(q);
      const kitMatch = ev.equipmentKit?.name.toLowerCase().includes(q);

      return clientMatch || locMatch || codeMatch || pkgMatch || kitMatch;
    });
  }, [events, search, tab]);

  return (
    <div className="space-y-6">
      {/* Controles de búsqueda y filtros */}
      <section className="rounded-2xl border border-outline-variant bg-surface-container p-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Buscador */}
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, salón, código, paquete..."
              className="w-full rounded-xl border border-outline-variant bg-background py-2.5 pl-10 pr-9 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
              >
                <XIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          <Link
            href="/administration/inventory/events/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary hover:opacity-90 active:scale-95 transition"
          >
            <PlusIcon className="h-4 w-4" />
            <span>Nuevo evento</span>
          </Link>
        </div>

        {/* Pestañas de estado */}
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab("ACTIVE")}
            className={`rounded-lg px-3.5 py-2 transition ${
              tab === "ACTIVE"
                ? "bg-primary text-on-primary"
                : "border border-outline-variant bg-background text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Activos / En Curso ({counts.active})
          </button>
          <button
            type="button"
            onClick={() => setTab("RETURN_PENDING")}
            className={`rounded-lg px-3.5 py-2 transition ${
              tab === "RETURN_PENDING"
                ? "bg-orange-500 text-white font-bold"
                : "border border-outline-variant bg-background text-orange-400 hover:text-orange-300"
            }`}
          >
            Pendientes de Regreso ({counts.returnPending})
          </button>
          <button
            type="button"
            onClick={() => setTab("COMPLETED")}
            className={`rounded-lg px-3.5 py-2 transition ${
              tab === "COMPLETED"
                ? "bg-emerald-600 text-white"
                : "border border-outline-variant bg-background text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Completados ({counts.completed})
          </button>
          <button
            type="button"
            onClick={() => setTab("ARCHIVED")}
            className={`rounded-lg px-3.5 py-2 transition ${
              tab === "ARCHIVED"
                ? "bg-surface-container-highest text-on-surface font-bold"
                : "border border-outline-variant bg-background text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Archivados ({counts.archived})
          </button>
          <button
            type="button"
            onClick={() => setTab("ALL")}
            className={`rounded-lg px-3.5 py-2 transition ${
              tab === "ALL"
                ? "bg-surface-container-highest text-on-surface font-bold"
                : "border border-outline-variant bg-background text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Todos ({counts.total})
          </button>
        </div>
      </section>

      {/* Lista de eventos */}
      <div className="rounded-2xl border border-outline-variant bg-surface-container divide-y divide-outline-variant overflow-hidden">
        {filteredEvents.length === 0 ? (
          <div className="p-8 text-center text-sm text-on-surface-variant">
            <p className="font-semibold text-on-surface">No hay eventos para mostrar.</p>
            <p className="mt-1">
              Prueba cambiando la pestaña de estado o ajustando el texto de búsqueda.
            </p>
          </div>
        ) : (
          filteredEvents.map((event) => {
            const config = statusConfig[event.status] ?? {
              label: event.status,
              badgeClass: "bg-surface-container-highest text-on-surface",
            };

            return (
              <Link
                key={event.id}
                href={`/administration/inventory/events/${event.id}`}
                className="group flex flex-col gap-3 p-5 transition sm:flex-row sm:items-center sm:justify-between hover:bg-surface-container-high/60"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-base text-on-surface group-hover:text-primary transition">
                      {event.clientName}
                    </p>
                    <span className="text-xs text-on-surface-variant font-mono">
                      {event.code}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${config.badgeClass}`}
                    >
                      {config.label}
                    </span>
                  </div>

                  <p className="text-xs text-on-surface-variant">
                    📍 {event.location} · 🗓️ {formatBusinessDateTime(event.eventDate)} · 👥 {event.guestCount} invitados
                  </p>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant/80 pt-0.5">
                    {event.package && (
                      <span className="rounded-md bg-surface-container-high px-2 py-0.5 font-medium text-on-surface">
                        🍸 {event.package.name}
                      </span>
                    )}
                    {event.equipmentKit && (
                      <span className="rounded-md bg-surface-container-high px-2 py-0.5 font-medium text-on-surface">
                        🚚 {event.equipmentKit.name}
                      </span>
                    )}
                    {event.clientPhone && (
                      <span className="text-[11px]">📞 {event.clientPhone}</span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-between sm:flex-col sm:items-end gap-1.5 pt-2 sm:pt-0 border-t sm:border-0 border-outline-variant/40">
                  {event.saleAmount !== null && (
                    <p className="font-bold text-base text-tertiary-fixed-dim">
                      ${Number(event.saleAmount).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}
                  <span className="text-xs font-semibold text-primary group-hover:underline">
                    Ver checklist →
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
