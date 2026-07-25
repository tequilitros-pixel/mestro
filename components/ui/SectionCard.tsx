/**
 * ==========================================================
 * MAESTRO
 * Sistema Operativo de la Destilería
 * ----------------------------------------------------------
 * Componente:
 * SectionCard
 *
 * Propósito:
 * Tarjeta estándar para secciones de MAESTRO.
 * ==========================================================
 */

import { ReactNode } from "react";

type SectionCardProps = {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export default function SectionCard({
  title,
  subtitle,
  icon,
  actions,
  children,
  className = "",
}: SectionCardProps) {
  return (
    <section
      className={`
        rounded-3xl
        border
        border-slate-800
        bg-slate-900
        shadow-lg
        shadow-black/20
        overflow-hidden
        ${className}
      `}
    >
      {(title || subtitle || actions) && (
        <header className="flex flex-col gap-5 border-b border-slate-800 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">

          <div className="flex items-start gap-4">

            {icon && (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-600 text-2xl">
                {icon}
              </div>
            )}

            <div>

              {title && (
                <h2 className="text-xl font-black text-white">
                  {title}
                </h2>
              )}

              {subtitle && (
                <p className="mt-1 text-sm text-slate-400">
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
      )}

      <div className="p-6">
        {children}
      </div>
    </section>
  );
}