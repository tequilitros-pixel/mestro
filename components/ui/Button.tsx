import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-primary text-on-primary hover:bg-primary/90 disabled:bg-primary/40",
  secondary:
    "bg-transparent text-on-surface border border-outline-variant hover:bg-surface-container-high disabled:opacity-40",
  danger:
    "bg-error text-on-error hover:opacity-90 disabled:bg-error/40",
  ghost:
    "bg-transparent text-on-surface hover:bg-surface-container-high disabled:opacity-40",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "min-h-8 px-2.5 py-1 text-xs",
  md: "min-h-9 px-3 py-1.5 text-sm",
  lg: "min-h-10 px-4 py-2 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`rounded-lg font-semibold transition duration-150 [transition-timing-function:cubic-bezier(.2,.8,.2,1)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
