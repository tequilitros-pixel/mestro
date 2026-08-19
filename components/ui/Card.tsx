import { HTMLAttributes } from "react";

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

export function CardLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">{children}</p>;
}

export function CardValue({ children }: { children: React.ReactNode }) {
  return <p className="text-xl font-bold leading-6 text-on-surface sm:text-2xl">{children}</p>;
}
