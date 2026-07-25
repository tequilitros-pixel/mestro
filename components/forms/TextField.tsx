/**
 * ==========================================================
 * MAESTRO
 * Sistema Operativo de la Destilería
 * ----------------------------------------------------------
 * Componente:
 * TextField
 *
 * Propósito:
 * Campo de texto reutilizable para formularios.
 * ==========================================================
 */

import { forwardRef, InputHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  (
    {
      label,
      hint,
      error,
      leftIcon,
      rightIcon,
      className,
      id,
      ...props
    },
    ref
  ) => {
    return (
      <div className="space-y-2">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-slate-300"
          >
            {label}
          </label>
        )}

        <div
          className={clsx(
            "flex items-center gap-3 rounded-xl border bg-slate-950 px-4 py-3 transition",
            error
              ? "border-red-500"
              : "border-slate-700 focus-within:border-purple-500",
          )}
        >
          {leftIcon && (
            <div className="text-slate-400">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={id}
            className={clsx(
              "w-full bg-transparent outline-none",
              "text-white placeholder:text-slate-500",
              className
            )}
            {...props}
          />

          {rightIcon && (
            <div className="text-slate-400">
              {rightIcon}
            </div>
          )}
        </div>

        {error ? (
          <p className="text-sm text-red-400">
            {error}
          </p>
        ) : hint ? (
          <p className="text-sm text-slate-500">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }
);

TextField.displayName = "TextField";

export default TextField;