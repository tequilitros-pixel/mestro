type StatusLevel = "ok" | "warning" | "neutral";

type PlantHeaderProps = {
  title: string;
  status: string;
  statusLevel?: StatusLevel;
  date?: string;
  health?: number;
};

const STATUS_DOT_CLASSES: Record<StatusLevel, string> = {
  ok: "bg-tertiary-fixed-dim",
  warning: "bg-secondary",
  neutral: "bg-outline",
};

const STATUS_TEXT_CLASSES: Record<StatusLevel, string> = {
  ok: "text-tertiary-fixed-dim",
  warning: "text-secondary",
  neutral: "text-on-surface-variant",
};

export default function PlantHeader({
  title,
  status,
  statusLevel = "neutral",
  date,
  health,
}: PlantHeaderProps) {
  return (
    <section className="surface-sheen rounded-xl border border-outline-variant bg-surface-container p-4 sm:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
            Destiladora del Norte
          </p>

          <h1 className="mt-1 text-2xl font-bold text-on-surface sm:text-[26px]">
            {title}
          </h1>

          <p className="mt-2 text-on-surface-variant">
            {date ?? "Centro de control de planta"}
          </p>
        </div>

        <div className="rounded-xl bg-surface-container-high p-3 text-right">
          <p className="text-xs text-on-surface-variant">Estado general</p>

          <p
            className={`mt-1 inline-flex items-center gap-2 text-lg font-bold ${STATUS_TEXT_CLASSES[statusLevel]}`}
          >
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT_CLASSES[statusLevel]}`}
            />
            {status}
          </p>

          {health !== undefined && (
            <p className="mt-1 text-sm text-on-surface-variant">
              Salud {health}%
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
