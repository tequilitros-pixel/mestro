/**
 * ==========================================================
 * MAESTRO
 * Sistema Operativo de la Destilería
 * ----------------------------------------------------------
 * Componente:
 * EmptyState
 *
 * Propósito:
 * Mostrar estados vacíos de manera consistente.
 * ==========================================================
 */

import { ReactNode } from "react";
import clsx from "clsx";

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-slate-900 px-8 py-16 text-center",
        className
      )}
    >
        {icon && (
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-800 text-4xl text-slate-400">
                {icon}
            </div>
        )}

        <h2 className="text-2xl font-bold text-white">
            {title}
        </h2>

        {description && (
            <p className="mt-3 max-w-md text-slate-400">
                {description}
            </p>
        )}

        {action && (
            <div className="mt-8">
                {action}
            </div>
        )}
    </div>
  );
}