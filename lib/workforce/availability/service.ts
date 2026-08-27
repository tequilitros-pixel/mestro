import "server-only";
import { prisma } from "@/lib/prisma";
import { assertAvailabilityAccess } from "./authorization";
import { dateOnly, effectiveAvailability, requiresManagerAttention, shiftAvailabilityConflict, validateTimeRange, type EffectiveAvailability } from "./rules";

export type WorkforceActor = { id: string; role: string };

async function employeeForAccess(actor: WorkforceActor, employeeId: string) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, include: { employments: { orderBy: { startedAt: "desc" } } } });
  if (!employee) throw new Error("Empleado no encontrado.");
  assertAvailabilityAccess({ actorUserId: actor.id, actorRole: actor.role, employeeUserId: employee.userId, employeeId: employee.id, requestedEmployeeId: employeeId });
  const employment = employee.employments.find((item) => item.status === "ACTIVE");
  if (!employment) throw new Error("La relación laboral no está activa.");
  return { employee, employment };
}

export async function getOwnEmployeeOrNull(actor: WorkforceActor) {
  const employee = await prisma.employee.findUnique({ where: { userId: actor.id }, include: { employments: { where: { status: "ACTIVE" } } } });
  return employee?.employments[0] ? { employee, employment: employee.employments[0] } : null;
}

export async function resolveOwnEmployee(actor: WorkforceActor) {
  const own = await getOwnEmployeeOrNull(actor);
  if (!own) throw new Error("Tu usuario no tiene una relación laboral activa vinculada.");
  return own;
}

export async function getAvailabilityProfile(actor: WorkforceActor, employeeId: string, from: Date, days = 35) {
  const { employee, employment } = await employeeForAccess(actor, employeeId);
  const start = dateOnly(from);
  const end = new Date(start.getTime() + days * 86_400_000);
  const [rules, exceptions] = await Promise.all([
    prisma.availabilityRule.findMany({ where: { employmentId: employment.id }, orderBy: [{ dayOfWeek: "asc" }, { effectiveFrom: "desc" }] }),
    prisma.availabilityException.findMany({ where: { employmentId: employment.id, date: { gte: start, lt: end } }, orderBy: { date: "asc" } }),
  ]);
  const byDate = new Map(exceptions.map((item) => [item.date.toISOString().slice(0, 10), item]));
  const effective = Array.from({ length: days }, (_, index) => {
    const date = new Date(start.getTime() + index * 86_400_000);
    return { date, availability: effectiveAvailability({ date, rules, exception: byDate.get(date.toISOString().slice(0, 10)) }) };
  });
  return { employee, employment, rules, exceptions, effective };
}

async function attentionFor(employmentId: string, effectiveDate: Date, now: Date) {
  const links = await prisma.schedulePublicationShift.findMany({
    where: { shiftRevision: { employmentId, businessDate: dateOnly(effectiveDate) } },
    select: { shiftRevision: { select: { businessDate: true } } },
  });
  return requiresManagerAttention({ now, effectiveDate, publishedShiftDates: links.map((item) => item.shiftRevision.businessDate) });
}

export async function saveAvailabilityRule(actor: WorkforceActor, input: { employeeId: string; dayOfWeek: number; state: "AVAILABLE" | "UNAVAILABLE"; startTime: string | null; endTime: string | null; effectiveFrom: Date }) {
  const { employment } = await employeeForAccess(actor, input.employeeId);
  if (!Number.isInteger(input.dayOfWeek) || input.dayOfWeek < 0 || input.dayOfWeek > 6) throw new Error("Día de semana inválido.");
  validateTimeRange(input.startTime, input.endTime);
  const effectiveFrom = dateOnly(input.effectiveFrom);
  if (effectiveFrom < dateOnly(new Date())) throw new Error("Sólo se puede editar disponibilidad recurrente futura.");
  const attention = await attentionFor(employment.id, effectiveFrom, new Date());
  await prisma.$transaction(async (tx) => {
    const next = await tx.availabilityRule.findFirst({ where: { employmentId: employment.id, dayOfWeek: input.dayOfWeek, effectiveFrom: { gt: effectiveFrom } }, orderBy: { effectiveFrom: "asc" } });
    await tx.availabilityRule.updateMany({ where: { employmentId: employment.id, dayOfWeek: input.dayOfWeek, effectiveTo: null, effectiveFrom: { lt: effectiveFrom } }, data: { effectiveTo: new Date(effectiveFrom.getTime() - 86_400_000) } });
    await tx.availabilityRule.deleteMany({ where: { employmentId: employment.id, dayOfWeek: input.dayOfWeek, effectiveFrom } });
    await tx.availabilityRule.create({ data: { employmentId: employment.id, dayOfWeek: input.dayOfWeek, available: input.state === "AVAILABLE", startTime: input.startTime, endTime: input.endTime, effectiveFrom, effectiveTo: next?.effectiveFrom ? new Date(next.effectiveFrom.getTime() - 86_400_000) : null } });
  });
  return attention;
}

export async function saveAvailabilityException(actor: WorkforceActor, input: { employeeId: string; date: Date; state: "AVAILABLE" | "UNAVAILABLE"; startTime: string | null; endTime: string | null; reason: string | null }) {
  const { employment } = await employeeForAccess(actor, input.employeeId);
  const date = dateOnly(input.date);
  if (date < dateOnly(new Date())) throw new Error("Sólo se pueden editar excepciones futuras.");
  validateTimeRange(input.startTime, input.endTime);
  const attention = await attentionFor(employment.id, date, new Date());
  await prisma.availabilityException.upsert({
    where: { employmentId_date: { employmentId: employment.id, date } },
    update: { type: input.state, startTime: input.startTime, endTime: input.endTime, reason: input.reason },
    create: { employmentId: employment.id, date, type: input.state, startTime: input.startTime, endTime: input.endTime, reason: input.reason },
  });
  return attention;
}

export async function deleteAvailabilityException(actor: WorkforceActor, employeeId: string, dateInput: Date) {
  const { employment } = await employeeForAccess(actor, employeeId);
  const date = dateOnly(dateInput);
  if (date < dateOnly(new Date())) throw new Error("No se puede borrar una excepción pasada.");
  const attention = await attentionFor(employment.id, date, new Date());
  await prisma.availabilityException.deleteMany({ where: { employmentId: employment.id, date } });
  return attention;
}

export async function getTeamAvailability(actor: WorkforceActor, dateInput: Date) {
  if (actor.role !== "ADMIN") throw new Error("Sólo administración puede consultar disponibilidad de equipo.");
  const date = dateOnly(dateInput);
  const employments = await prisma.employment.findMany({ where: { status: "ACTIVE" }, include: { employee: true, availabilityRules: true, availabilityExceptions: { where: { date } }, branchAssignments: { where: { effectiveFrom: { lte: date }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }] }, include: { branch: true } } }, orderBy: { employee: { displayName: "asc" } } });
  return employments.map((employment) => {
    const availability: EffectiveAvailability = effectiveAvailability({ date, rules: employment.availabilityRules, exception: employment.availabilityExceptions[0] });
    return { employee: employment.employee, employmentId: employment.id, branches: employment.branchAssignments.map((item) => ({ name: item.branch.name, type: item.type })), availability, conflict: shiftAvailabilityConflict(availability) };
  });
}
