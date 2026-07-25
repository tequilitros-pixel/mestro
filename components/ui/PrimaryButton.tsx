/**
 * ==========================================================
 * MAESTRO
 * Sistema Operativo de la Destilería
 * ----------------------------------------------------------
 * Componente:
 * PrimaryButton
 *
 * Propósito:
 * Botón principal para acciones importantes.
 * ==========================================================
 */

import { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  loading?: boolean;
};

export default function PrimaryButton({
  children,
  loading = false,
  className,
  disabled,
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center gap-2",
        "rounded-xl",
        "bg-purple-600",
        "px-5 py-2.5",
        "font-semibold",
        "text-white",
        "transition-all duration-200",
        "hover:bg-purple-700",
        "active:scale-95",
        "disabled:cursor-not-allowed",
        "disabled:opacity-50",
        "focus:outline-none",
        "focus:ring-2",
        "focus:ring-purple-500",
        "focus:ring-offset-2",
        "focus:ring-offset-slate-950",
        className
      )}
    >
      {loading && (
        <svg
          className="h-4 w-4 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeOpacity=".25"
            strokeWidth="4"
          />
          <path
            d="M22 12A10 10 0 0012 2"
            stroke="currentColor"
            strokeWidth="4"
          />
        </svg>
      )}

      {children}
    </button>
  );
}