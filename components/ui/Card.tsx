import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  highlight?: boolean;
}

export function Card({ highlight = false, className = "", children, ...props }: CardProps) {
  return (
    <div
      className={`surface-sheen rounded-xl border p-5 transition-colors duration-150 ${
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
  return <p className="font-mono text-xs uppercase tracking-wide text-on-surface-variant mb-1">{children}</p>;
}

export function CardValue({ children }: { children: React.ReactNode }) {
  return <p className="text-2xl font-bold text-on-surface">{children}</p>;
}
