import Link from "next/link";
import type { ReactNode } from "react";

type EquipmentCardProps = {
  icon: ReactNode;
  title: string;
  status: string;
  lot?: string;
  value?: string;
  subtitle?: string;
  href: string;
  tone?: "green" | "yellow" | "red" | "blue" | "slate";
};

const toneStyles = {
  green: "bg-tertiary-fixed-dim/10 text-tertiary-fixed-dim border-tertiary-fixed-dim/30",
  yellow: "bg-secondary/10 text-secondary border-secondary/30",
  red: "bg-error/10 text-error border-error/30",
  blue: "bg-on-surface-variant/10 text-on-surface-variant border-on-surface-variant/30",
  slate: "bg-surface-container-high text-on-surface-variant border-outline-variant",
};

export default function EquipmentCard({
  icon,
  title,
  status,
  lot,
  value,
  subtitle,
  href,
  tone = "green",
}: EquipmentCardProps) {
  return (
    <Link
      href={href}
      className="surface-sheen block rounded-xl border border-outline-variant bg-surface-container p-6 shadow-xl transition duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.01] hover:border-primary/25 hover:bg-surface-container-high"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-high text-on-surface [&_svg]:h-6 [&_svg]:w-6">
            {icon}
          </div>

          <h3 className="mt-4 text-2xl font-bold text-primary">
            {title}
          </h3>

          {lot && (
            <p className="mt-1 text-sm text-on-surface-variant">
              Lote {lot}
            </p>
          )}
        </div>

        <span
          className={`rounded-full border px-3 py-1 font-mono text-xs font-bold uppercase ${toneStyles[tone]}`}
        >
          {status}
        </span>
      </div>

      <div className="mt-8">
        <p className="text-4xl font-bold text-primary">
          {value ?? "--"}
        </p>

        <p className="mt-2 text-sm text-on-surface-variant">
          {subtitle ?? "Sin datos"}
        </p>
      </div>

      <p className="mt-8 text-sm font-bold text-on-surface-variant">
        Abrir →
      </p>
    </Link>
  );
}