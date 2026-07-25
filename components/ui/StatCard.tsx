/**
 * ==========================================================
 * MAESTRO
 * Sistema Operativo de la Destilería
 * ----------------------------------------------------------
 * Componente:
 * StatCard
 *
 * Propósito:
 * Mostrar métricas, KPIs e indicadores.
 * ==========================================================
 */

import { ReactNode } from "react";
import clsx from "clsx";

type StatCardProps = {
  title: string;
  value: ReactNode;
  icon?: ReactNode;
  description?: string;
  trend?: ReactNode;
  className?: string;
};

export default function StatCard({
  title,
  value,
  icon,
  description,
  trend,
  className,
}: StatCardProps) {
  return (
    <div
      className={clsx(
        "rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-lg shadow-black/20",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400">
            {title}
          </p>

          <h3 className="mt-2 text-3xl font-black text-white">
            {value}
          </h3>

          {description && (
            <p className="mt-2 text-sm text-slate-500">
              {description}
            </p>
          )}
        </div>

        {icon && (
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-600 text-2xl text-white">
            {icon}
          </div>
        )}
      </div>

      {trend && (
        <div className="mt-5 border-t border-slate-800 pt-4">
          {trend}
        </div>
      )}
    </div>
  );
}