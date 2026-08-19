import type { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  title: string;
  value: string;
  status: "ok" | "warning" | "danger";
};

export default function PlantStatusCard({
  icon,
  title,
  value,
  status,
}: Props) {
  const color =
    status === "ok"
      ? "bg-tertiary-fixed-dim"
      : status === "warning"
      ? "bg-secondary"
      : "bg-error";

  return (
    <div className="surface-sheen flex min-h-[5.5rem] flex-col justify-between rounded-xl border border-outline-variant bg-surface-container p-3 transition-colors duration-150 hover:border-primary/25">
      <div className="flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-high text-on-surface [&_svg]:h-6 [&_svg]:w-6">
          {icon}
        </div>

        <div className={`h-2.5 w-2.5 rounded-full ${color}`} />
      </div>

      <h3 className="mt-3 text-xs font-semibold text-on-surface-variant">
        {title}
      </h3>

      <p className="mt-1 text-2xl font-bold text-on-surface">
        {value}
      </p>
    </div>
  );
}
