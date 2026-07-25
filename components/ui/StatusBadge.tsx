/**
 * ==========================================================
 * MAESTRO
 * Sistema Operativo de la Destilería
 * ----------------------------------------------------------
 * Componente:
 * StatusBadge
 *
 * Propósito:
 * Mostrar estados de forma consistente en toda la aplicación.
 * ==========================================================
 */

import clsx from "clsx";

type Status =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

type StatusBadgeProps = {
  status: Status;
  children: React.ReactNode;
  className?: string;
};

const styles: Record<Status, string> = {
  success:
    "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",

  warning:
    "bg-amber-500/15 text-amber-400 border border-amber-500/30",

  danger:
    "bg-red-500/15 text-red-400 border border-red-500/30",

  info:
    "bg-blue-500/15 text-blue-400 border border-blue-500/30",

  neutral:
    "bg-slate-700/40 text-slate-300 border border-slate-600",
};

export default function StatusBadge({
  status,
  children,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-2",
        "rounded-full",
        "px-3 py-1",
        "text-xs font-semibold",
        styles[status],
        className
      )}
    >
      <span className="h-2 w-2 rounded-full bg-current" />

      {children}
    </span>
  );
}