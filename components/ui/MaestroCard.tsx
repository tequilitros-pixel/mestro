import Link from "next/link";

type MaestroCardProps = {
  title?: string;
  message: string;
  tasks: string[];
  production?: string;
  confidence?: number;
  href?: string;
};

export default function MaestroCard({
  title = "MAESTRO",
  message,
  tasks,
  production,
  confidence,
  href = "/plant",
}: MaestroCardProps) {
  return (
    <section className="rounded-3xl border border-amber-500/20 bg-slate-900 p-8 shadow-xl">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400 text-3xl">
          🧠
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-amber-400">
            {title}
          </p>

          <h2 className="text-3xl font-bold text-white">
            Centro de decisiones
          </h2>
        </div>
      </div>

      <p className="mt-6 text-lg text-slate-300">
        {message}
      </p>

      <div className="mt-8 space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-400">
          Hoy debes
        </p>

        {tasks.map((task, index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-xl bg-slate-800 px-4 py-3"
          >
            <span className="text-green-400">✔</span>

            <span className="text-slate-200">
              {task}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-slate-800 p-4">
          <p className="text-sm text-slate-400">
            Producción esperada
          </p>

          <p className="mt-2 text-2xl font-bold text-white">
            {production ?? "--"}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-800 p-4">
          <p className="text-sm text-slate-400">
            Confianza
          </p>

          <p className="mt-2 text-2xl font-bold text-amber-400">
            {confidence ?? "--"}%
          </p>
        </div>
      </div>

      <Link
        href={href}
        className="mt-8 flex justify-center rounded-2xl bg-amber-400 px-6 py-4 text-lg font-bold text-slate-950 transition hover:scale-[1.02]"
      >
        Ver detalles →
      </Link>
    </section>
  );
}