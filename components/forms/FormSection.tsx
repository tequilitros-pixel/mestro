/**
 * ==========================================================
 * MAESTRO
 * Sistema Operativo de la Destilería
 * ----------------------------------------------------------
 * Componente:
 * FormSection
 *
 * Propósito:
 * Contenedor estándar para formularios.
 * ==========================================================
 */

import { ReactNode } from "react";
import clsx from "clsx";

type FormSectionProps = {
  title?: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export default function FormSection({
  title,
  description,
  children,
  actions,
  className,
}: FormSectionProps) {
  return (
    <section
      className={clsx(
        "rounded-3xl border border-slate-800 bg-slate-900",
        className
      )}
    >
      {(title || description) && (
        <header className="border-b border-slate-800 px-6 py-5">
          {title && (
            <h2 className="text-xl font-bold text-white">
              {title}
            </h2>
          )}

          {description && (
            <p className="mt-2 text-sm text-slate-400">
              {description}
            </p>
          )}
        </header>
      )}

      <div className="space-y-6 p-6">
        {children}
      </div>

      {actions && (
        <footer className="flex justify-end gap-3 border-t border-slate-800 px-6 py-5">
          {actions}
        </footer>
      )}
    </section>
  );
}