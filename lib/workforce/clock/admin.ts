import "server-only";

import { withRlsContext } from "@/lib/rls";
import { localBusinessDate, dateKey } from "../timesheet/rules";
import { resolveWorkforcePolicy } from "../settings/service";
import { isOperationalClockIdentity } from "@/app/workforce/clock/presentation";
import type { ClockActor } from "./service";

const DAY_MS = 86_400_000;

export type AdminClockWorkingRow = {
  id: string;
  name: string;
  branchName: string;
  branchTimezone: string | null;
  startedAt: string;
};

export type AdminClockCompletedRow = AdminClockWorkingRow & {
  endedAt: string;
  workedMinutes: number;
};

export type AdminClockMissedRow = {
  id: string;
  name: string;
  branchName: string;
  branchTimezone: string | null;
  expectedStart: string | null;
};

export type AdminClockDashboard = {
  now: Date;
  working: AdminClockWorkingRow[];
  completed: AdminClockCompletedRow[];
  missed: AdminClockMissedRow[];
};

function activeToday(value: Date, timezone: string | null, now: Date, fallback: string) {
  return dateKey(value) === dateKey(localBusinessDate(now, timezone ?? fallback));
}

function operational(row: {
  employment: {
    status: string;
    employee: { active: boolean; user: { active: boolean } | null };
  };
}) {
  return isOperationalClockIdentity({
    employeeActive: row.employment.employee.active,
    userActive: row.employment.employee.user?.active ?? false,
    employmentStatus: row.employment.status,
  });
}

const sessionSelect = {
  id: true,
  startedAt: true,
  endedAt: true,
  workedMinutes: true,
  businessDate: true,
  employment: {
    select: {
      status: true,
      employee: {
        select: {
          displayName: true,
          active: true,
          user: { select: { active: true } },
        },
      },
    },
  },
  branch: { select: { name: true, timezone: true } },
} as const;

const exceptionSelect = {
  id: true,
  businessDate: true,
  scheduledStart: true,
  shift: { select: { startAt: true } },
  employment: {
    select: {
      status: true,
      employee: {
        select: {
          displayName: true,
          active: true,
          user: { select: { active: true } },
        },
      },
    },
  },
  branch: { select: { name: true, timezone: true } },
} as const;

export async function getAdminClockDashboard(actor: ClockActor): Promise<AdminClockDashboard> {
  if (actor.role !== "ADMIN") throw new Error("No autorizado.");
  return withRlsContext(actor, async (tx) => {
    const now = new Date();
    const policy = await resolveWorkforcePolicy(now, tx);
    const today = localBusinessDate(now, policy.companyTimezone);
    const [working, completed, missed] = await Promise.all([
      tx.workSession.findMany({
        where: { endedAt: null, startedAt: { not: null }, businessDate: { gte: new Date(today.getTime() - DAY_MS), lte: new Date(today.getTime() + DAY_MS) } },
        select: sessionSelect,
        orderBy: { startedAt: "asc" },
      }),
      tx.workSession.findMany({
        where: { endedAt: { not: null }, businessDate: { gte: new Date(today.getTime() - DAY_MS), lte: new Date(today.getTime() + DAY_MS) } },
        select: sessionSelect,
        orderBy: { endedAt: "desc" },
      }),
      tx.attendanceException.findMany({
        where: { type: "NO_SHOW", status: "OPEN", businessDate: { gte: new Date(today.getTime() - DAY_MS), lte: new Date(today.getTime() + DAY_MS) } },
        select: exceptionSelect,
        orderBy: { scheduledStart: "asc" },
      }),
    ]);

    return {
      now,
      working: working
        .filter(operational)
        .filter((row): row is typeof row & { startedAt: Date } => Boolean(row.startedAt))
        .map((row) => ({
          id: row.id,
          name: row.employment.employee.displayName ?? "Empleado",
          branchName: row.branch.name,
          branchTimezone: row.branch.timezone,
          startedAt: row.startedAt.toISOString(),
        })),
      completed: completed
        .filter(operational)
        .filter((row): row is typeof row & { startedAt: Date; endedAt: Date } => Boolean(row.startedAt && row.endedAt))
        .filter((row) => activeToday(row.businessDate, row.branch.timezone, now, policy.companyTimezone))
        .map((row) => ({
          id: row.id,
          name: row.employment.employee.displayName ?? "Empleado",
          branchName: row.branch.name,
          branchTimezone: row.branch.timezone,
          startedAt: row.startedAt.toISOString(),
          endedAt: row.endedAt.toISOString(),
          workedMinutes: row.workedMinutes,
        })),
      missed: missed
        .filter(operational)
        .filter((row) => activeToday(row.businessDate, row.branch.timezone, now, policy.companyTimezone))
        .map((row) => ({
          id: row.id,
          name: row.employment.employee.displayName ?? "Empleado",
          branchName: row.branch.name,
          branchTimezone: row.branch.timezone,
          expectedStart: (row.scheduledStart ?? row.shift?.startAt)?.toISOString() ?? null,
        })),
    };
  });
}
