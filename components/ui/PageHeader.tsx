/**
 * ==========================================================
 * MAESTRO
 * Sistema Operativo de la Destilería
 * ----------------------------------------------------------
 * Componente:
 * PageHeader
 *
 * Propósito:
 * Encabezado estándar de todas las páginas.
 * ==========================================================
 */

import { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
};

export default function PageHeader({
  title,
  subtitle,
  icon,
  actions,
}: PageHeaderProps) {
  return (
    <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-4">
        {icon && (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-600 text-3xl shadow-lg">
            {icon}
          </div>
        )}

        <div>
          <h1 className="text-4xl font-black tracking-tight text-white">
            {title}
          </h1>

          {subtitle && (
            <p className="mt-2 max-w-2xl text-slate-400">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex flex-wrap gap-3">
          {actions}
        </div>
      )}
    </header>
  );
}