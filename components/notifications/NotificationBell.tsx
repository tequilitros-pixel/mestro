"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellIcon } from "@/components/ui/icons";
import {
  getMyNotificationsAction,
  getUnreadNotificationsCountAction,
  markAllNotificationsAsReadAction,
  markNotificationAsReadAction,
  type NotificationCategory,
  type NotificationItem,
  type NotificationPriority,
} from "@/app/actions/notifications";

function getCategoryBadge(category: NotificationCategory) {
  switch (category) {
    case "POS":
      return { label: "Punto de Venta", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", icon: "💳" };
    case "TIMECLOCK":
      return { label: "Checador / Turnos", color: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30", icon: "⏰" };
    case "PAYROLL":
      return { label: "Nómina", color: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30", icon: "💵" };
    case "INVENTORY":
      return { label: "Inventario", color: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30", icon: "📦" };
    case "PRODUCTION":
      return { label: "Producción", color: "bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/30", icon: "🥃" };
    case "SYSTEM":
    default:
      return { label: "Sistema", color: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30", icon: "⚙️" };
  }
}

function getPriorityBadge(priority: NotificationPriority) {
  switch (priority) {
    case "URGENT":
      return <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" title="Urgente" />;
    case "HIGH":
      return <span className="inline-block h-2 w-2 rounded-full bg-amber-500" title="Alta prioridad" />;
    default:
      return null;
  }
}

function formatRelativeTime(isoString: string): string {
  try {
    const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
    if (diff < 60) return "Hace un momento";
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
    const days = Math.floor(diff / 86400);
    if (days === 1) return "Ayer";
    if (days < 7) return `Hace ${days} d`;
    return new Date(isoString).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

export default function NotificationBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [isLoading, setIsLoading] = useState(false);
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  // Carga inicial y sondeo ligero cada 35 segundos
  useEffect(() => {
    let isMounted = true;

    async function loadCount() {
      try {
        const count = await getUnreadNotificationsCountAction();
        if (isMounted) setUnreadCount(count);
      } catch (err) {
        console.error("Error al obtener conteo de notificaciones:", err);
      }
    }

    loadCount();
    const interval = setInterval(loadCount, 35000);

    const onFocus = () => {
      loadCount();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  // Cargar lista completa al abrir
  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const result = await getMyNotificationsAction({
        unreadOnly: filter === "unread",
        limit: 40,
      });
      if (result.success) {
        setNotifications(result.data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      void loadNotifications();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isOpen, filter]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (item: NotificationItem) => {
    if (!item.read) {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read: true, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      startTransition(async () => {
        await markNotificationAsReadAction(item.id);
      });
    }

    if (item.href) {
      setIsOpen(false);
      router.push(item.href);
    }
  };

  const handleMarkAllAsRead = async () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() }))
    );
    setUnreadCount(0);
    startTransition(async () => {
      await markAllNotificationsAsReadAction();
    });
  };

  const displayedNotifications =
    filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* Botón de la Campana */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="shell-icon-button relative text-on-surface-variant hover:text-on-surface focus:outline-none"
        aria-label="Notificaciones"
        title="Centro de Notificaciones"
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-surface">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel Desplegable (Popover) */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Panel de Notificaciones"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-outline-variant bg-surface-container-high/95 p-3 shadow-2xl backdrop-blur-md z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Cabecera */}
          <div className="flex items-center justify-between pb-2 border-b border-outline-variant/60">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-on-surface">Notificaciones</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {unreadCount} nuevas
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="text-xs font-medium text-primary hover:underline"
              >
                Marcar todas leídas
              </button>
            )}
          </div>

          {/* Filtros */}
          <div className="flex gap-1.5 py-2">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                filter === "all"
                  ? "bg-primary text-on-primary shadow-xs"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                filter === "unread"
                  ? "bg-primary text-on-primary shadow-xs"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              No leídas {unreadCount > 0 && `(${unreadCount})`}
            </button>
          </div>

          {/* Lista de Notificaciones */}
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
            {isLoading && notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-on-surface-variant">
                Cargando notificaciones...
              </div>
            ) : displayedNotifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-on-surface-variant">
                <p className="text-base mb-1">📭</p>
                {filter === "unread"
                  ? "No tienes notificaciones pendientes por leer"
                  : "No hay notificaciones registradas"}
              </div>
            ) : (
              displayedNotifications.map((item) => {
                const badge = getCategoryBadge(item.category);
                return (
                  <div
                    key={item.id}
                    onClick={() => handleMarkAsRead(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleMarkAsRead(item);
                      }
                    }}
                    className={`group relative flex flex-col gap-1 rounded-xl p-2.5 transition-all text-left cursor-pointer border ${
                      item.read
                        ? "border-transparent bg-surface-container/40 hover:bg-surface-container text-on-surface-variant"
                        : "border-primary/20 bg-primary/5 hover:bg-primary/10 text-on-surface shadow-xs"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${badge.color}`}
                      >
                        <span>{badge.icon}</span>
                        <span>{badge.label}</span>
                      </span>

                      <div className="flex items-center gap-1.5">
                        {getPriorityBadge(item.priority)}
                        <span className="text-[10px] text-on-surface-variant">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                        {!item.read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        )}
                      </div>
                    </div>

                    <div className="mt-0.5">
                      <p className="text-xs font-semibold leading-snug line-clamp-1">{item.title}</p>
                      <p className="text-[11px] leading-relaxed line-clamp-2 text-on-surface-variant mt-0.5">
                        {item.body}
                      </p>
                    </div>

                    {item.href && (
                      <div className="mt-1 flex items-center text-[10px] font-medium text-primary">
                        <span>Ver detalle &rarr;</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
