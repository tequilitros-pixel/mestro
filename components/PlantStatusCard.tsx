type Props = {
  icon: string;
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
      ? "bg-green-500"
      : status === "warning"
      ? "bg-yellow-500"
      : "bg-red-500";

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 transition hover:border-amber-400">
      <div className="flex items-center justify-between">
        <span className="text-4xl">{icon}</span>

        <div className={`h-4 w-4 rounded-full ${color}`} />
      </div>

      <h3 className="mt-5 text-xl font-bold text-white">
        {title}
      </h3>

      <p className="mt-3 text-4xl font-black text-amber-400">
        {value}
      </p>
    </div>
  );
}