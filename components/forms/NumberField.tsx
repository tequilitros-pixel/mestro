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
            className="block text-sm font-semibold text-on-surface-variant"
          >
            {label}
          </label>
        )}

        <div
          className={clsx(
            "flex items-center rounded-xl border bg-background transition",
            error
              ? "border-error"
              : "border-outline-variant focus-within:border-primary"
          )}
        >

          <input
            ref={ref}
            id={id}
            type="number"
            className={clsx(
              "w-full bg-transparent px-4 py-3 text-sm outline-none",
              "text-on-surface placeholder:text-outline",
              "[appearance:textfield]",
              "[&::-webkit-inner-spin-button]:appearance-none",
              "[&::-webkit-outer-spin-button]:appearance-none",
              className
            )}
            {...props}
          />

          {unit && (
            <span className="border-l border-outline-variant px-4 text-sm font-semibold text-on-surface-variant">
              {unit}
            </span>
          )}

        </div>

        {error ? (
          <p className="text-sm text-error">
            {error}
          </p>
        ) : hint ? (
          <p className="text-sm text-outline">
            {hint}
          </p>
        ) : null}

      </div>
    );
  }
);

NumberField.displayName = "NumberField";

export default NumberField;