
import Link from "next/link";

type EquipmentCardProps = {
  id: string;
  name: string;
  status: string;
  current: number;
  max: number;
  unit: string;
  lot?: string;
};

export function EquipmentCard({
  id,
  name,
  status,
  current,
  max,
  unit,
  lot,
}: EquipmentCardProps) {
  const percentage = Math.round((current / max) * 100);

  return (
    <Link href={`/equipment/${id}`}>
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/10 cursor-pointer">

        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {name}
            </h3>

            <p className="text-sm text-slate-400">
              {status}
            </p>
          </div>

          <span className="rounded-full bg-green-500/10 px-3 py-1 text-sm text-green-400">
            Activo
          </span>
        </div>

        <div>

          <div className="mb-2 flex justify-between text-sm text-slate-400">

            <span>
              {current.toLocaleString()} / {max.toLocaleString()} {unit}
            </span>

            <span>{percentage}%</span>

          </div>

          <div className="h-3 rounded-full bg-slate-800">

            <div
              className="h-3 rounded-full bg-amber-400"
              style={{
                width: `${percentage}%`,
              }}
            />

          </div>

        </div>

        {lot && (
          <p className="mt-4 text-sm text-amber-400">
            Lote: {lot}
          </p>
        )}

      </div>
    </Link>
  );
}