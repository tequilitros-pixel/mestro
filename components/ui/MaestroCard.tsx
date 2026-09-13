import Link from "next/link";
import { BrainIcon, CheckIcon } from "@/components/ui/icons";

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
    <section className="surface-sheen rounded-xl border border-outline-variant bg-surface-container p-8 shadow-xl">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-on-primary">
          <BrainIcon className="h-7 w-7" />
        </div>

        <div>
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-on-surface-variant">
            {title}
          </p>

          <h2 className="text-3xl font-bold text-primary">
            Centro de decisiones
          </h2>
        </div>
      </div>

      <p className="mt-6 text-lg text-on-surface-variant">
        {message}
      </p>

      <div className="mt-8 space-y-3">
        <p className="font-mono text-sm font-semibold uppercase tracking-[0.25em] text-on-surface-variant">
          Hoy debes
        </p>

        {tasks.map((task, index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-xl bg-surface-container-high px-4 py-3"
          >
            <CheckIcon className="h-4 w-4 shrink-0 text-tertiary-fixed-dim" />

            <span className="text-on-surface">
              {task}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-surface-container-high p-4">
          <p className="text-sm text-on-surface-variant">
            Producción esperada
          </p>

          <p className="mt-2 text-2xl font-bold text-primary">
            {production ?? "--"}
          </p>
        </div>

        <div className="rounded-xl bg-surface-container-high p-4">
          <p className="text-sm text-on-surface-variant">
            Confianza
          </p>

          <p className="mt-2 text-2xl font-bold text-primary">
            {confidence ?? "--"}%
          </p>
        </div>
      </div>

      <Link
        href={href}
        className="mt-8 flex justify-center rounded-xl bg-primary px-6 py-4 text-lg font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.02] active:scale-[0.98]"
      >
        Ver detalles →
      </Link>
    </section>
  );
}