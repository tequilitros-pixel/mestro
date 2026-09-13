import { createHash } from "node:crypto";

export const CONTROLLED_BACKFILL_VERSION = "workforce-v1-controlled-2026-08-26";

export type BackfillClassification =
  | "SAFE"
  | "SAFE_WITH_UNKNOWN"
  | "REVIEW_REQUIRED"
  | "ARCHIVE_ONLY"
  | "SKIPPED";

export function stableTargetId(targetModel: string, legacyModel: string, legacyId: string) {
  const digest = createHash("sha256")
    .update(`${CONTROLLED_BACKFILL_VERSION}:${targetModel}:${legacyModel}:${legacyId}`)
    .digest("hex")
    .slice(0, 24);
  return `wfm_${digest}`;
}

export function legacyEmployeeInput(user: { id: string; name: string; active: boolean }) {
  return {
    id: stableTargetId("Employee", "User", user.id),
    employmentId: stableTargetId("Employment", "User", user.id),
    userId: user.id,
    displayName: user.name,
    firstName: null,
    lastName: null,
    active: user.active,
    startedAt: null,
    dataConfidence: "LEGACY_UNKNOWN" as const,
    classification: "SAFE_WITH_UNKNOWN" as const,
  };
}

export function legacyPayRateInput(rate: {
  id: string;
  userId: string;
  scheme: "HORA" | "DIA" | "SEMANA";
  amount: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}) {
  if (!Number.isFinite(rate.amount) || rate.amount <= 0) return { candidate: null, classification: "REVIEW_REQUIRED" as const };
  if (rate.effectiveTo && rate.effectiveTo <= rate.effectiveFrom) return { candidate: null, classification: "REVIEW_REQUIRED" as const };
  return {
    candidate: {
      id: stableTargetId("PayRate", "SalaryRate", rate.id),
      employmentId: stableTargetId("Employment", "User", rate.userId),
      rateType: { HORA: "HOURLY", DIA: "DAILY", SEMANA: "WEEKLY" }[rate.scheme],
      amount: rate.amount,
      currency: null,
      effectiveFrom: rate.effectiveFrom,
      effectiveTo: rate.effectiveTo,
    },
    classification: "SAFE_WITH_UNKNOWN" as const,
  };
}

export function nativePayRateIsValid(input: { currency: string | null }) {
  return typeof input.currency === "string" && /^[A-Z]{3}$/.test(input.currency);
}

export function legacyWorkSessionInput(entry: {
  id: string;
  userId: string;
  branchId: string;
  clockIn: Date;
  clockOut: Date | null;
  scheduledBusinessDate: Date | null;
}) {
  if (!entry.scheduledBusinessDate) return { candidate: null, classification: "REVIEW_REQUIRED" as const, reason: "business date cannot be proven" };
  const workedMinutes = entry.clockOut ? Math.round((entry.clockOut.getTime() - entry.clockIn.getTime()) / 60_000) : 0;
  if (workedMinutes < 0) return { candidate: null, classification: "REVIEW_REQUIRED" as const, reason: "clock-out precedes clock-in" };
  return {
    candidate: {
      id: stableTargetId("WorkSession", "TimeClockEntry", entry.id),
      employmentId: stableTargetId("Employment", "User", entry.userId),
      branchId: entry.branchId,
      businessDate: entry.scheduledBusinessDate,
      startedAt: entry.clockIn,
      endedAt: entry.clockOut,
      workedMinutes,
      breakMinutes: null,
      origin: "LEGACY_IMPORTED" as const,
      status: entry.clockOut ? ("COMPLETE" as const) : ("INCOMPLETE" as const),
    },
    classification: "SAFE_WITH_UNKNOWN" as const,
    reason: null,
  };
}
