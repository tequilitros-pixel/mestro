import { type ComponentPropsWithoutRef, type HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  highlight?: boolean;
  size?: "compact" | "standard" | "panel";
}

const SIZE_CLASSES = {
  compact: "p-3",
  standard: "p-4",
  panel: "p-4 sm:p-5",
};

export function Card({ highlight = false, size = "standard", className = "", children, ...props }: CardProps) {
  return (
    <div
      className={`surface-sheen rounded-xl border transition-colors duration-150 ${SIZE_CLASSES[size]} ${
        highlight
          ? "bg-primary/[0.06] border-primary/25"
          : "bg-surface-container/60 border-outline-variant"
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardLabel({ className = "", children, ...props }: ComponentPropsWithoutRef<"p">) {
  return (
    <p className={`mb-1 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant ${className}`} {...props}>
      {children}
    </p>
  );
}

export function CardValue({ className = "", children, ...props }: ComponentPropsWithoutRef<"p">) {
  return (
    <p className={`text-xl font-bold leading-6 text-on-surface sm:text-2xl ${className}`} {...props}>
      {children}
    </p>
  );
}
