import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-primary text-on-primary hover:opacity-90 hover:shadow-[0_0_0_1px_rgb(255_255_255_/_0.08),0_8px_20px_-6px_rgb(255_255_255_/_0.25)] disabled:bg-primary/40",
  secondary:
    "bg-surface-container-high text-on-surface border border-outline-variant hover:bg-surface-container-highest hover:border-outline disabled:opacity-40",
  danger:
    "bg-error text-on-error hover:opacity-90 disabled:bg-error/40",
  ghost:
    "bg-transparent text-on-surface hover:bg-surface-container-high disabled:opacity-40",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`rounded-full font-semibold transition duration-150 ease-out hover:scale-[1.04] active:scale-[0.97] disabled:cursor-not-allowed disabled:hover:scale-100 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
