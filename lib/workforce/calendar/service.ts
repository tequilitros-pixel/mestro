import "server-only";
import { prisma } from "@/lib/prisma";
import { dateOnly } from "@/lib/workforce/availability/rules";
import { resolveOwnEmployee, type WorkforceActor } from "@/lib/workforce/availability/service";
import { calendarStatus, latestPublishedRevisions } from "./rules";

export type CalendarShift = { id: string; businessDate: Date; startAt: Date; endAt: Date; branchName: string; branchTimezone: string; status: "NEW" | "CHANGED" | "CANCELLED"; revisionNumber: number };

export async function getEmployeeCalendar(actor: WorkforceActor, from: Date, days: number) {
  const { employee, employment } = await resolveOwnEmployee(actor);
  const start = dateOnly(from);
  const end = new Date(start.getTime() + days * 86_400_000);
  const links = await prisma.schedulePublicationShift.findMany({
    where: { shiftRevision: { employmentId: employment.id, businessDate: { gte: start, lt: end } } },
    include: { publication: true, shiftRevision: { include: { branch: true } } },
    orderBy: [{ publication: { publishedAt: "desc" } }, { shiftRevision: { revisionNumber: "desc" } }],
  });
  const latest = latestPublishedRevisions(links.map((link)=>({ shiftId:link.shiftId, publicationPublishedAt:link.publication.publishedAt, revisionNumber:link.shiftRevision.revisionNumber, revisionStatus:link.shiftRevision.status, businessDate:link.shiftRevision.businessDate, startAt:link.shiftRevision.startAt, endAt:link.shiftRevision.endAt, branchName:link.shiftRevision.branch.name, branchTimezone:link.shiftRevision.branch.timezone })));
  return { employee, employment, shifts: latest.map((row):CalendarShift=>({ id:row.shiftId,businessDate:row.businessDate,startAt:row.startAt,endAt:row.endAt,branchName:row.branchName,branchTimezone:row.branchTimezone??"America/Mexico_City",status:calendarStatus(row),revisionNumber:row.revisionNumber })) };
}

export const calendarNotificationEvents = ["schedule.published", "shift.changed", "shift.cancelled", "availability.conflict.resolved"] as const;
