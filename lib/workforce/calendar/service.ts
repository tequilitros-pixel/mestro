import "server-only";
import { prisma } from "@/lib/prisma";
import { dateOnly } from "@/lib/workforce/availability/rules";
import {
  resolveOwnEmployee,
  type WorkforceActor,
} from "@/lib/workforce/availability/service";
import { effectiveCalendarStatus } from "./rules";

export type CalendarShift = {
  id: string;
  businessDate: Date;
  startAt: Date;
  endAt: Date;
  branchName: string;
  branchTimezone: string;
  status: "NEW" | "CHANGED" | "CANCELLED";
  revisionNumber: number;
};

export async function getEmployeeCalendar(
  actor: WorkforceActor,
  from: Date,
  days: number,
) {
  const { employee, employment } = await resolveOwnEmployee(actor);
  const start = dateOnly(from);
  const end = new Date(start.getTime() + days * 86_400_000);
  const shifts = await prisma.shift.findMany({
    where: {
      employmentId: employment.id,
      businessDate: { gte: start, lt: end },
      status: { in: ["PUBLISHED", "CANCELLED"] },
    },
    include: {
      branch: true,
      revisions: {
        include: { branch: true },
        orderBy: { revisionNumber: "desc" },
        take: 1,
      },
      publicationLinks: { select: { shiftRevisionId: true } },
    },
    orderBy: { startAt: "asc" },
  });
  return {
    employee,
    employment,
    shifts: shifts.map((shift): CalendarShift => {
      const revision = shift.revisions[0];
      const historicalRevisionIds = new Set(
        shift.publicationLinks.map((item) => item.shiftRevisionId),
      );
      return {
        id: shift.id,
        businessDate: revision?.businessDate ?? shift.businessDate,
        startAt: revision?.startAt ?? shift.startAt,
        endAt: revision?.endAt ?? shift.endAt,
        branchName: revision?.branch.name ?? shift.branch.name,
        branchTimezone:
          revision?.branch.timezone ??
          shift.branch.timezone ??
          "America/Mexico_City",
        status: effectiveCalendarStatus({
          status: revision?.status ?? shift.status,
          hasPublicationLink: shift.publicationLinks.length > 0,
          latestRevisionLinked: revision
            ? historicalRevisionIds.has(revision.id)
            : false,
        }),
        revisionNumber: revision?.revisionNumber ?? 0,
      };
    }),
  };
}

export const calendarNotificationEvents = [
  "schedule.published",
  "shift.changed",
  "shift.cancelled",
  "availability.conflict.resolved",
] as const;
