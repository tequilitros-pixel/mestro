/**
 * ==========================================================
 * MAESTRO
 * Sistema Operativo de la Destilería
 * ----------------------------------------------------------
 * Componente:
 * NumberField
 *
 * Propósito:
 * Campo numérico reutilizable.
 * ==========================================================
 */

import { forwardRef, InputHTMLAttributes } from "react";
import clsx from "clsx";

type NumberFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  unit?: string;
};

const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(
  (
    {
      label,
      hint,
      error,
      unit,
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
            "flex items-center rounded-xl border bg-slate-950 transition",
            error
              ? "border-red-500"
              : "border-slate-700 focus-within:border-purple-500"
          )}
        >

          <input
            ref={ref}
            id={id}
            type="number"
            className={clsx(
              "w-full bg-transparent px-4 py-3 outline-none",
              "text-white placeholder:text-slate-500",
              "[appearance:textfield]",
              "[&::-webkit-inner-spin-button]:appearance-none",
              "[&::-webkit-outer-spin-button]:appearance-none",
              className
            )}
            {...props}
          />

          {unit && (
            <span className="border-l border-slate-700 px-4 text-sm font-semibold text-slate-400">
              {unit}
            </span>
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

NumberField.displayName = "NumberField";

export default NumberField;