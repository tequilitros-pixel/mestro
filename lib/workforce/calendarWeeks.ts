import { mondayOfWeek } from "@/lib/dateOnly";

export function groupCalendarWeeks(days: string[]) {
  const weeks: Array<{ start: string; days: string[] }> = [];
  for (const day of days) {
    const start = mondayOfWeek(day);
    const current = weeks[weeks.length - 1];
    if (current?.start === start) current.days.push(day);
    else weeks.push({ start, days: [day] });
  }
  return weeks;
}
