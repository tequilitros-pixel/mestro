import type { HTMLAttributes, ReactNode } from "react";
import { Card } from "@/components/ui/Card";

type ClassProps = { className?: string };

export function PageHeader({ title, description, actions, className = "" }: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
} & ClassProps) {
  return (
    <header className={`flex min-h-14 flex-col justify-center gap-3 sm:min-h-[4rem] sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-on-surface sm:text-[26px]">{title}</h1>
        {description && <p className="mt-0.5 text-[13px] leading-5 text-on-surface-variant">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionHeader({ title, description, actions, className = "" }: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
} & ClassProps) {
  return <div className={`flex min-h-9 items-center justify-between gap-3 ${className}`}><div><h2 className="text-sm font-semibold text-on-surface">{title}</h2>{description && <p className="text-xs text-on-surface-variant">{description}</p>}</div>{actions}</div>;
}

export function MetricCard({ label, value, detail, tone = "neutral", className = "" }: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
} & ClassProps) {
  const tones = { neutral: "text-on-surface", success: "text-tertiary-fixed-dim", warning: "text-secondary", danger: "text-error" };
  return <Card size="compact" className={`flex min-h-[5.5rem] flex-col justify-between ${className}`}><p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">{label}</p><p className={`text-xl font-bold leading-6 sm:text-2xl ${tones[tone]}`}>{value}</p>{detail && <p className="text-[11px] text-on-surface-variant">{detail}</p>}</Card>;
}

export function DataPanel({ children, className = "", ...props }: HTMLAttributes<HTMLDivElement> & ClassProps) {
  return <Card size="panel" className={className} {...props}>{children}</Card>;
}

export function FilterBar({ children, className = "" }: { children: ReactNode } & ClassProps) {
  return <div className={`flex flex-wrap items-end gap-2.5 rounded-xl border border-outline-variant bg-surface-container p-3 sm:p-4 ${className}`}>{children}</div>;
}

export function ChartPanel({ title, actions, children, className = "" }: { title: string; actions?: ReactNode; children: ReactNode } & ClassProps) {
  return <DataPanel className={className}><SectionHeader title={title} actions={actions} className="mb-3" /><div className="h-56 sm:h-64">{children}</div></DataPanel>;
}

export function EmptyState({ children, className = "" }: { children: ReactNode } & ClassProps) {
  return <div className={`rounded-xl border border-dashed border-outline-variant px-4 py-6 text-center text-sm text-on-surface-variant ${className}`}>{children}</div>;
}

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const tones = { neutral: "bg-surface-container-highest text-on-surface-variant", success: "bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim", warning: "bg-secondary/15 text-secondary", danger: "bg-error/15 text-error" };
  return <span className={`inline-flex min-h-6 items-center rounded-full px-2.5 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}
