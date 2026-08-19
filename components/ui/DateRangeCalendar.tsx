"use client";

/**
 * Selector de rango basado en los calendarios nativos del dispositivo.
 * Recibe y devuelve fechas calendario (`YYYY-MM-DD`), sin convertirlas a UTC.
 */
export function DateRangeCalendar({
  from,
  to,
  onFromChange,
  onToChange,
  compact = false,
}: {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  compact?: boolean;
}) {
  const inputClass = compact
    ? "rounded-xl border border-outline-variant bg-surface-container px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
    : "w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary";

  return (
    <div className="flex flex-wrap items-end gap-3" aria-label="Rango de fechas">
      <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface-variant">
        Desde
        <input type="date" value={from} max={to || undefined} onChange={(event) => onFromChange(event.target.value)} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface-variant">
        Hasta
        <input type="date" value={to} min={from || undefined} onChange={(event) => onToChange(event.target.value)} className={inputClass} />
      </label>
    </div>
  );
}
