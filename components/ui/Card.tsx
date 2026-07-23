import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  highlight?: boolean;
}

export function Card({ highlight = false, className = "", children, ...props }: CardProps) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        highlight
          ? "bg-blue-900/60 border-blue-700"
          : "bg-slate-900/60 border-slate-700"
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">{children}</p>;
}

export function CardValue({ children }: { children: React.ReactNode }) {
  return <p className="text-2xl font-bold text-white">{children}</p>;
}
