import assert from "node:assert/strict";
import { Client } from "pg";

import {
  CONTROLLED_BACKFILL_VERSION,
  legacyEmployeeInput,
  legacyPayRateInput,
  legacyWorkSessionInput,
} from "../../lib/workforce/legacy/backfill";
import { analyzeRateCoverage } from "../../lib/workforce/legacy/bridge";

const EXPECTED_HOST_PREFIX = "ep-red-lake-ats4n9i7";
type Classification = "SAFE" | "SAFE_WITH_UNKNOWN" | "REVIEW_REQUIRED" | "ARCHIVE_ONLY" | "SKIPPED";
type Summary = Record<"legacyScanned" | "safeMigrated" | "safeWithUnknownMigrated" | "reviewRequired" | "archiveOnly" | "failed" | "skippedIdempotent" | "domainRowsCreated", number>;

const emptySummary = (): Summary => ({ legacyScanned: 0, safeMigrated: 0, safeWithUnknownMigrated: 0, reviewRequired: 0, archiveOnly: 0, failed: 0, skippedIdempotent: 0, domainRowsCreated: 0 });

async function insertRecord(client: Client, dryRun: boolean, row: { legacyModel: string; legacyId: string; targetModel?: string; targetId?: string; classification: Classification; status: "MIGRATED" | "REVIEW" | "SKIPPED"; confidence?: "KNOWN" | "LEGACY_UNKNOWN"; notes?: string }) {
  if (dryRun) return true;
  const result = await client.query(
    `INSERT INTO "WorkforceMigrationRecord" (id,"migrationVersion","legacyModel","legacyId","targetModel","targetId",classification,confidence,status,notes,"createdAt","updatedAt")
     VALUES ('wfr_' || substr(md5($1 || ':' || $2 || ':' || $3),1,24),$1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now())
     ON CONFLICT ("migrationVersion","legacyModel","legacyId") DO NOTHING`,
    [CONTROLLED_BACKFILL_VERSION, row.legacyModel, row.legacyId, row.targetModel ?? null, row.targetId ?? null, row.classification, row.confidence ?? null, row.status, row.notes ?? null],
  );
  return result.rowCount === 1;
}

async function transaction(client: Client, body: () => Promise<void>) {
  await client.query("BEGIN");
  try { await body(); await client.query("COMMIT"); } catch (error) { await client.query("ROLLBACK"); throw error; }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const rawUrl = process.env.DATABASE_URL;
  assert.ok(rawUrl, "DATABASE_URL is required");
  const url = new URL(rawUrl);
  assert.ok(url.hostname.startsWith(EXPECTED_HOST_PREFIX), "refusing non-DEV endpoint");
  assert.equal(url.pathname, "/neondb", "refusing non-DEV database");

  const client = new Client({ connectionString: rawUrl });
  await client.connect();
  const summary = emptySummary();
  const reviewQueue: Array<{ legacyType: string; legacyId: string; reason: string; candidateAction: string; blocking: boolean }> = [];
  try {
    const branch = (await client.query(`SELECT b.* FROM "Branch" b LEFT JOIN "TimeClockEntry" t ON t."branchId"=b.id GROUP BY b.id ORDER BY count(t.id) DESC, b.id LIMIT 1`)).rows[0];
    assert.ok(branch, "controlled sample requires one branch");
    const users = (await client.query(
      `SELECT u.* FROM "User" u
       WHERE EXISTS (SELECT 1 FROM "TimeClockEntry" t WHERE t."userId"=u.id)
          OR EXISTS (SELECT 1 FROM "ScheduledShift" s WHERE s."userId"=u.id)
          OR EXISTS (SELECT 1 FROM "SalaryRate" r WHERE r."userId"=u.id)
       ORDER BY (SELECT count(*) FROM "TimeClockEntry" t WHERE t."userId"=u.id) DESC, u.id LIMIT 4`,
    )).rows;
    assert.equal(users.length, 4, "controlled sample requires four evidenced worker users");
    const userIds = users.map((u) => u.id);
    const periods = (await client.query(`SELECT * FROM "PayrollPeriod" ORDER BY "weekStart" DESC LIMIT 2`)).rows;
    assert.equal(periods.length, 2, "controlled sample requires two payroll periods");

    for (const user of users) {
      summary.legacyScanned++;
      const candidate = legacyEmployeeInput({ id: user.id, name: user.name, active: user.active });
      if (dryRun) { summary.safeWithUnknownMigrated++; continue; }
      await transaction(client, async () => {
        const employee = await client.query(
          `INSERT INTO "Employee" (id,"userId","displayName","firstName","lastName",active,"createdAt","updatedAt") VALUES ($1,$2,$3,null,null,$4,now(),now()) ON CONFLICT (id) DO NOTHING`,
          [candidate.id, candidate.userId, candidate.displayName, candidate.active],
        );
        const employment = await client.query(
          `INSERT INTO "Employment" (id,"employeeId",status,"startedAt","dataConfidence","createdAt","updatedAt") VALUES ($1,$2,$3,null,'LEGACY_UNKNOWN',now(),now()) ON CONFLICT (id) DO NOTHING`,
          [candidate.employmentId, candidate.id, candidate.active ? "ACTIVE" : "INACTIVE"],
        );
        const mapped = await insertRecord(client, false, { legacyModel: "User", legacyId: user.id, targetModel: "Employee", targetId: candidate.id, classification: "SAFE_WITH_UNKNOWN", confidence: "LEGACY_UNKNOWN", status: "MIGRATED", notes: `Employment ${candidate.employmentId}; name preserved unsplit; startedAt unknown` });
        summary.domainRowsCreated += (employee.rowCount ?? 0) + (employment.rowCount ?? 0);
        mapped ? summary.safeWithUnknownMigrated++ : summary.skippedIdempotent++;
      });
    }

    const rates = (await client.query(`SELECT * FROM "SalaryRate" WHERE "userId" = ANY($1::text[]) ORDER BY "userId","effectiveFrom"`, [userIds])).rows;
    const rateGroups = new Map<string, typeof rates>();
    for (const rate of rates) rateGroups.set(rate.userId, [...(rateGroups.get(rate.userId) ?? []), rate]);
    for (const rate of rates) {
      summary.legacyScanned++;
      const coverage = analyzeRateCoverage((rateGroups.get(rate.userId) ?? []).map((r) => ({ id: r.id, userId: r.userId, scheme: r.scheme, amount: Number(r.amount), effectiveFrom: r.effectiveFrom, effectiveTo: r.effectiveTo })));
      const mapped = legacyPayRateInput({ id: rate.id, userId: rate.userId, scheme: rate.scheme, amount: Number(rate.amount), effectiveFrom: rate.effectiveFrom, effectiveTo: rate.effectiveTo });
      if (!mapped.candidate || coverage.some((issue) => issue.category === "CONFLICTING_DATA")) {
        summary.reviewRequired++; reviewQueue.push({ legacyType: "SalaryRate", legacyId: rate.id, reason: "invalid range or ambiguous overlap", candidateAction: "resolve rate history", blocking: true });
        await insertRecord(client, dryRun, { legacyModel: "SalaryRate", legacyId: rate.id, classification: "REVIEW_REQUIRED", status: "REVIEW", notes: "invalid range or ambiguous overlap" });
        continue;
      }
      if (dryRun) { summary.safeWithUnknownMigrated++; continue; }
      await transaction(client, async () => {
        const c = mapped.candidate!;
        const result = await client.query(`INSERT INTO "PayRate" (id,"employmentId","rateType",amount,currency,"effectiveFrom","effectiveTo","createdAt","updatedAt") VALUES ($1,$2,$3,$4,null,$5,$6,now(),now()) ON CONFLICT (id) DO NOTHING`, [c.id, c.employmentId, c.rateType, c.amount, c.effectiveFrom, c.effectiveTo]);
        const recorded = await insertRecord(client, false, { legacyModel: "SalaryRate", legacyId: rate.id, targetModel: "PayRate", targetId: c.id, classification: "SAFE_WITH_UNKNOWN", confidence: "LEGACY_UNKNOWN", status: "MIGRATED", notes: "currency unknown" });
        summary.domainRowsCreated += result.rowCount ?? 0; recorded ? summary.safeWithUnknownMigrated++ : summary.skippedIdempotent++;
      });
    }

    const clocks = (await client.query(
      `SELECT t.*,s.date AS "scheduledBusinessDate" FROM "TimeClockEntry" t LEFT JOIN "ScheduledShift" s ON s.id=t."scheduledShiftId" WHERE t."branchId"=$1 AND t."userId"=ANY($2::text[]) ORDER BY t."clockIn"`,
      [branch.id, userIds],
    )).rows;
    for (const clock of clocks) {
      summary.legacyScanned++;
      const mapped = legacyWorkSessionInput({ id: clock.id, userId: clock.userId, branchId: clock.branchId, clockIn: clock.clockIn, clockOut: clock.clockOut, scheduledBusinessDate: clock.scheduledBusinessDate });
      if (!mapped.candidate) {
        summary.reviewRequired++; reviewQueue.push({ legacyType: "TimeClockEntry", legacyId: clock.id, reason: mapped.reason, candidateAction: "confirm business date", blocking: false });
        await insertRecord(client, dryRun, { legacyModel: "TimeClockEntry", legacyId: clock.id, classification: "REVIEW_REQUIRED", status: "REVIEW", notes: mapped.reason });
        continue;
      }
      if (dryRun) { summary.safeWithUnknownMigrated++; continue; }
      await transaction(client, async () => {
        const c = mapped.candidate!;
        const result = await client.query(`INSERT INTO "WorkSession" (id,"employmentId","branchId","businessDate","startedAt","endedAt","workedMinutes","breakMinutes",origin,"reconstructionVersion",status,"reconstructedAt","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,null,'LEGACY_IMPORTED',1,$8,now(),now(),now()) ON CONFLICT (id) DO NOTHING`, [c.id, c.employmentId, c.branchId, c.businessDate, c.startedAt, c.endedAt, c.workedMinutes, c.status]);
        const recorded = await insertRecord(client, false, { legacyModel: "TimeClockEntry", legacyId: clock.id, targetModel: "WorkSession", targetId: c.id, classification: "SAFE_WITH_UNKNOWN", confidence: "LEGACY_UNKNOWN", status: "MIGRATED", notes: "composite legacy record; break unknown; no ClockEvent fabricated" });
        summary.domainRowsCreated += result.rowCount ?? 0; recorded ? summary.safeWithUnknownMigrated++ : summary.skippedIdempotent++;
      });
    }

    const shifts = (await client.query(`SELECT s.id FROM "ScheduledShift" s WHERE s."branchId"=$1 AND s."userId"=ANY($2::text[])`, [branch.id, userIds])).rows;
    for (const shift of shifts) {
      summary.legacyScanned++; summary.reviewRequired++;
      reviewQueue.push({ legacyType: "ScheduledShift", legacyId: shift.id, reason: branch.timezone ? "publication provenance unknown" : "branch timezone missing", candidateAction: "confirm timezone and import canonical shift without publication", blocking: false });
      await insertRecord(client, dryRun, { legacyModel: "ScheduledShift", legacyId: shift.id, classification: "REVIEW_REQUIRED", status: "REVIEW", notes: branch.timezone ? "publication provenance unknown" : "branch timezone missing" });
    }

    const payrollEntries = (await client.query(`SELECT e.id FROM "PayrollEntry" e WHERE e."periodId"=ANY($1::text[]) AND e."userId"=ANY($2::text[])`, [periods.map((p) => p.id), userIds])).rows;
    for (const entry of payrollEntries) {
      summary.legacyScanned++; summary.archiveOnly++;
      await insertRecord(client, dryRun, { legacyModel: "PayrollEntry", legacyId: entry.id, classification: "ARCHIVE_ONLY", status: "SKIPPED", notes: "comparison source; currency/payment evidence insufficient for PayrollLine" });
    }

    const persisted = dryRun ? null : (await client.query(`SELECT classification,status,count(*)::int count FROM "WorkforceMigrationRecord" WHERE "migrationVersion"=$1 GROUP BY classification,status ORDER BY classification,status`, [CONTROLLED_BACKFILL_VERSION])).rows;
    console.log(JSON.stringify({ mode: dryRun ? "DRY_RUN" : "APPLY", environment: { host: url.hostname, database: "neondb" }, sample: { branch: { id: branch.id, code: branch.code }, employees: users.length, payrollPeriods: periods.length }, summary, reviewQueue, persisted }, null, 2));
  } finally { await client.end(); }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
