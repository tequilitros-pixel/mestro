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
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        isOverdue
          ? "bg-red-500/20 text-red-400"
          : "bg-green-500/20 text-green-400"
      }`}
    >
      {isOverdue ? `⏰ Atrasado ${text}` : `🟢 Al día · ${text}`}
    </span>
  );
}
