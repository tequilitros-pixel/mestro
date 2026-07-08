import Link from "next/link";

type EquipmentCardProps = {
  icon: string;
  title: string;
  status: string;
  lot?: string;
  value?: string;
  subtitle?: string;
  href: string;
  tone?: "green" | "yellow" | "red" | "blue" | "slate";
};

const toneStyles = {
  green: "bg-green-400/10 text-green-400 border-green-400/30",
  yellow: "bg-yellow-400/10 text-yellow-400 border-yellow-400/30",
  red: "bg-red-400/10 text-red-400 border-red-400/30",
  blue: "bg-blue-400/10 text-blue-400 border-blue-400/30",
  slate: "bg-slate-700 text-slate-300 border-slate-600",
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
      className="block rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl transition hover:border-amber-400/40 hover:bg-slate-800"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-4xl">{icon}</div>

          <h3 className="mt-4 text-2xl font-bold text-white">
            {title}
          </h3>

          {lot && (
            <p className="mt-1 text-sm text-slate-400">
              Lote {lot}
            </p>
          )}
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${toneStyles[tone]}`}
        >
          {status}
        </span>
      </div>

      <div className="mt-8">
        <p className="text-4xl font-bold text-white">
          {value ?? "--"}
        </p>

        <p className="mt-2 text-sm text-slate-400">
          {subtitle ?? "Sin datos"}
        </p>
      </div>

      <p className="mt-8 text-sm font-bold text-amber-400">
        Abrir →
      </p>
    </Link>
  );
}