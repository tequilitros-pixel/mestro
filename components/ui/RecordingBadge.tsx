export default function RecordingBadge({
  minutesSinceLastRecord,
  isOverdue,
}: {
  minutesSinceLastRecord: number;
  isOverdue: boolean;
}) {
  const hours = Math.floor(minutesSinceLastRecord / 60);
  const mins = Math.round(minutesSinceLastRecord % 60);
  const text = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs font-semibold ${
        isOverdue
          ? "bg-error/15 text-error"
          : "bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          isOverdue ? "bg-error" : "bg-tertiary-fixed-dim"
        }`}
      />
      {isOverdue ? `Atrasado · ${text}` : `Al día · ${text}`}
    </span>
  );
}
