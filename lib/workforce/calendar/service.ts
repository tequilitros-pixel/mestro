import "server-only";
import { prisma } from "@/lib/prisma";
import { dateOnly } from "@/lib/workforce/availability/rules";
import {
  resolveOwnEmployee,
  type WorkforceActor,
} from "@/lib/workforce/availability/service";
import { calendarStatus, latestPublishedRevisions } from "./rules";

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
      publicationLinks: {
        include: {
          publication: { select: { publishedAt: true, version: true } },
          shiftRevision: { include: { branch: true } },
        },
      },
    },
    orderBy: { startAt: "asc" },
  });
  const latestPublishedByShiftId = new Map(
    latestPublishedRevisions(
      shifts.flatMap((shift) =>
        shift.publicationLinks.map(({ publication, shiftRevision }) => ({
          shiftId: shift.id,
          publicationPublishedAt: publication.publishedAt,
          revisionNumber: shiftRevision.revisionNumber,
          revisionStatus: shiftRevision.status,
          businessDate: shiftRevision.businessDate,
          startAt: shiftRevision.startAt,
          endAt: shiftRevision.endAt,
          branchName: shiftRevision.branch.name,
          branchTimezone: shiftRevision.branch.timezone,
        })),
      ),
    ).map((snapshot) => [snapshot.shiftId, snapshot] as const),
  );
  return {
    employee,
    employment,
    shifts: shifts.map((shift): CalendarShift => {
      const revision = shift.revisions[0];
      const published = latestPublishedByShiftId.get(shift.id);
      return {
        id: shift.id,
        businessDate: published?.businessDate ?? revision?.businessDate ?? shift.businessDate,
        startAt: published?.startAt ?? revision?.startAt ?? shift.startAt,
        endAt: published?.endAt ?? revision?.endAt ?? shift.endAt,
        branchName: published?.branchName ?? revision?.branch.name ?? shift.branch.name,
        branchTimezone:
          published?.branchTimezone ??
          revision?.branch.timezone ??
          shift.branch.timezone ??
          "America/Mexico_City",
        status:
          shift.status === "CANCELLED"
            ? "CANCELLED"
            : published
              ? calendarStatus(published)
              : "NEW",
        revisionNumber: published?.revisionNumber ?? revision?.revisionNumber ?? 0,
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
