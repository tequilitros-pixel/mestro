import "server-only";
import { prisma } from "@/lib/prisma";
import { formatDateOnly, parseDateOnly } from "@/lib/dateOnly";

export type EffectiveAvailability = {
  type: "AVAILABLE_ALL_DAY" | "AVAILABLE_PARTIAL" | "UNAVAILABLE" | "PREFER_OFF";
  startTime: string | null;
  endTime: string | null;
  source: "EXCEPTION" | "RECURRING";
};

function mondayDayIndex(date: string) {
  return (parseDateOnly(date).getUTCDay() + 6) % 7;
}

function range(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const from = sh * 60 + sm;
  let to = eh * 60 + em;
  if (to <= from) to += 1440;
  return [from, to] as const;
}

export async function getEffectiveAvailability(userId: string, date: string): Promise<EffectiveAvailability | null> {
  const exactDate = parseDateOnly(date);
  const exception = await prisma.employeeAvailabilityException.findUnique({ where: { userId_date: { userId, date: exactDate } } });
  if (exception) return { type: exception.type, startTime: exception.startTime, endTime: exception.endTime, source: "EXCEPTION" };
  const rule = await prisma.employeeAvailabilityRule.findUnique({ where: { userId_dayOfWeek: { userId, dayOfWeek: mondayDayIndex(date) } } });
  if (!rule?.active) return null;
  return { type: rule.type, startTime: rule.startTime, endTime: rule.endTime, source: "RECURRING" };
}

export function availabilityConflict(availability: EffectiveAvailability | null, startTime: string, endTime: string) {
  if (!availability || availability.type === "AVAILABLE_ALL_DAY") return null;
  if (availability.type === "PREFER_OFF") return "Este empleado indicó que preferiría descansar este día.";
  if (availability.type === "UNAVAILABLE") return "Este empleado indicó que no está disponible este día.";
  if (!availability.startTime || !availability.endTime) return "La disponibilidad parcial del empleado está incompleta.";
  const shift = range(startTime, endTime);
  const available = range(availability.startTime, availability.endTime);
  if (shift[0] < available[0] || shift[1] > available[1]) return "Este turno está fuera de la disponibilidad indicada por el empleado.";
  return null;
}

export async function getAvailabilityMatrix(userIds: string[], start: Date, end: Date) {
  const [rules, exceptions] = await Promise.all([
    prisma.employeeAvailabilityRule.findMany({ where: { userId: { in: userIds }, active: true } }),
    prisma.employeeAvailabilityException.findMany({ where: { userId: { in: userIds }, date: { gte: start, lt: end } } }),
  ]);
  const ruleMap = new Map(rules.map((item) => [`${item.userId}|${item.dayOfWeek}`, item]));
  const exceptionMap = new Map(exceptions.map((item) => [`${item.userId}|${formatDateOnly(item.date)}`, item]));
  const result: Record<string, EffectiveAvailability> = {};
  for (const userId of userIds) {
    for (let cursor = new Date(start); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const date = formatDateOnly(cursor);
      const exception = exceptionMap.get(`${userId}|${date}`);
      const rule = ruleMap.get(`${userId}|${mondayDayIndex(date)}`);
      const item = exception ?? rule;
      if (item) result[`${userId}|${date}`] = { type: item.type, startTime: item.startTime, endTime: item.endTime, source: exception ? "EXCEPTION" : "RECURRING" };
    }
  }
  return result;
}
