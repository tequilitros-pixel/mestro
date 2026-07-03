type CapacityBarProps = {
  current: number;
  max: number;
  unit: string;
};

export function CapacityBar({
  current,
  max,
  unit,
}: CapacityBarProps) {
  const percentage = Math.round((current / max) * 100);

  return (
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
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}