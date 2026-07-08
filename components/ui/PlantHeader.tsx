type PlantHeaderProps = {
  title: string;
  status: string;
  date?: string;
  health?: number;
};

export default function PlantHeader({
  title,
  status,
  date,
  health,
}: PlantHeaderProps) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.4em] text-amber-400">
            MAESTRO
          </p>

          <h1 className="mt-3 text-5xl font-bold text-white">
            {title}
          </h1>

          <p className="mt-2 text-slate-400">
            {date ?? "Centro de control de planta"}
          </p>
        </div>

        <div className="rounded-3xl bg-slate-800 p-5 text-right">
          <p className="text-sm text-slate-400">Estado general</p>

          <p className="mt-2 text-2xl font-bold text-green-400">
            {status}
          </p>

          {health !== undefined && (
            <p className="mt-1 text-sm text-slate-400">
              Salud {health}%
            </p>
          )}
        </div>
      </div>
    </section>
  );
}