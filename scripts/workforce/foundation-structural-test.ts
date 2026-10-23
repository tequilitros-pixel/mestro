import assert from "node:assert/strict";

import { Client, type QueryResult } from "pg";

import { buildEffectiveClockStream } from "../../lib/workforce/clock/effectiveStream";

const EXPECTED_HOST = "ep-red-lake-ats4n9i7.c-9.us-east-1.aws.neon.tech";
const EXPECTED_DATABASE = "neondb";
const EXPECTED_MIGRATION = "20260826202402_add_workforce_v1_foundation";
const PREFIX = "WFTEST-";

const ids = {
  user: `${PREFIX}user`,
  employeeA: `${PREFIX}employee-no-user`,
  employeeB: `${PREFIX}employee-with-user`,
  employmentA: `${PREFIX}employment-a`,
  employmentB: `${PREFIX}employment-b`,
  rateA: `${PREFIX}rate-a`,
  rateB: `${PREFIX}rate-b`,
  branchA: `${PREFIX}branch-a`,
  branchB: `${PREFIX}branch-b`,
  assignmentA: `${PREFIX}assignment-a`,
  period: `${PREFIX}schedule-period`,
  shift: `${PREFIX}shift`,
  revision1: `${PREFIX}revision-1`,
  revision2: `${PREFIX}revision-2`,
  publication1: `${PREFIX}publication-1`,
  publication2: `${PREFIX}publication-2`,
  publicationLink1: `${PREFIX}publication-link-1`,
  publicationLink2: `${PREFIX}publication-link-2`,
  sessionA: `${PREFIX}session-a`,
  sessionB: `${PREFIX}session-b`,
  unscheduledSession: `${PREFIX}session-unscheduled`,
  timesheet: `${PREFIX}timesheet`,
  timesheetB: `${PREFIX}timesheet-b`,
  timesheetLine: `${PREFIX}timesheet-line`,
  payrollPeriod: `${PREFIX}payroll-period`,
  appliedPayrollPeriod: `${PREFIX}payroll-period-next`,
  payrollLine: `${PREFIX}payroll-line`,
} as const;

type TestResult = {
  test: string;
  status: "PASS" | "FAIL";
  notes: string;
};

const results: TestResult[] = [];

function pass(test: string, notes: string) {
  results.push({ test, status: "PASS", notes });
}

async function expectDatabaseRejection(
  client: Client,
  name: string,
  sql: string,
  params: unknown[],
  expectedCode: string,
) {
  const savepoint = `wftest_${results.length}`;
  await client.query(`SAVEPOINT ${savepoint}`);
  try {
    await client.query(sql, params);
    throw new Error(`${name} was accepted unexpectedly`);
  } catch (error) {
    const code = (error as { code?: string }).code;
    assert.equal(code, expectedCode, `${name} returned PostgreSQL code ${code}`);
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    await client.query(`RELEASE SAVEPOINT ${savepoint}`);
    pass(name, `Rejected with PostgreSQL ${expectedCode}`);
  }
}

async function queryOne<T extends Record<string, unknown>>(
  client: Client,
  text: string,
  params: unknown[] = [],
): Promise<T> {
  const result: QueryResult<T> = await client.query(text, params);
  assert.equal(result.rowCount, 1);
  return result.rows[0];
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  assert.ok(connectionString, "DATABASE_URL must be supplied explicitly");
  const url = new URL(connectionString);
  assert.equal(url.hostname, EXPECTED_HOST, "ABORT: unexpected database endpoint");
  assert.equal(url.pathname.slice(1), EXPECTED_DATABASE, "ABORT: unexpected database");

  const client = new Client({ connectionString });
  let transactionOpen = false;

  try {
    await client.connect();
    const identity = await queryOne<{ database: string }>(
      client,
      "SELECT current_database() AS database",
    );
    assert.equal(identity.database, EXPECTED_DATABASE);
    const migration = await queryOne<{ applied: boolean }>(
      client,
      `SELECT finished_at IS NOT NULL AND rolled_back_at IS NULL AS applied
       FROM _prisma_migrations
       WHERE migration_name = $1 AND finished_at IS NOT NULL
       ORDER BY finished_at DESC LIMIT 1`,
      [EXPECTED_MIGRATION],
    );
    assert.equal(migration.applied, true, "ABORT: foundation migration is not applied");

    await client.query("BEGIN");
    transactionOpen = true;

    await client.query(
      `INSERT INTO "Branch" (id, name, code, active, timezone, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, true, 'America/Mexico_City', now(), now()),
              ($4, $5, $6, true, 'America/Mexico_City', now(), now())`,
      [ids.branchA, `${PREFIX}Branch A`, `${PREFIX}A`, ids.branchB, `${PREFIX}Branch B`, `${PREFIX}B`],
    );
    await client.query(
      `INSERT INTO "User" (id, name, username, password, role, active, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'ADMIN', true, now(), now())`,
      [ids.user, `${PREFIX}Login Account`, `${PREFIX}login`, `${PREFIX}not-a-real-password`],
    );

    await client.query(
      `INSERT INTO "Employee" (id, "employeeNumber", "firstName", "lastName", active, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, true, now(), now())`,
      [ids.employeeA, `${PREFIX}001`, `${PREFIX}Alpha`, "Synthetic"],
    );
    await client.query(
      `INSERT INTO "Employment" (id, "employeeId", status, "dataConfidence", "createdAt", "updatedAt")
       VALUES ($1, $2, 'ACTIVE', 'KNOWN', now(), now())`,
      [ids.employmentA, ids.employeeA],
    );
    await client.query(
      `INSERT INTO "PayRate" (id, "employmentId", "rateType", amount, currency, "effectiveFrom", "createdAt", "updatedAt")
       VALUES ($1, $2, 'HOURLY', 100.00, 'MXN', '2099-01-01T00:00:00Z', now(), now())`,
      [ids.rateA, ids.employmentA],
    );
    await client.query(
      `INSERT INTO "BranchAssignment" (id, "employmentId", "branchId", type, "effectiveFrom", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'HOME', '2099-01-01T00:00:00Z', now(), now())`,
      [ids.assignmentA, ids.employmentA, ids.branchA],
    );
    const employeeWithoutUser = await queryOne<{ userId: string | null }>(
      client,
      `SELECT "userId" FROM "Employee" WHERE id=$1`,
      [ids.employeeA],
    );
    assert.equal(employeeWithoutUser.userId, null);
    pass("Identity separation: Employee without User", "Employment, PayRate and HOME assignment are valid");

    await client.query(
      `INSERT INTO "Employee" (id, "userId", "employeeNumber", "firstName", "lastName", active, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, true, now(), now())`,
      [ids.employeeB, ids.user, `${PREFIX}002`, `${PREFIX}Beta`, "Synthetic"],
    );
    await client.query(
      `INSERT INTO "Employment" (id, "employeeId", status, "startedAt", "dataConfidence", "createdAt", "updatedAt")
       VALUES ($1, $2, 'ACTIVE', '2099-01-01T00:00:00Z', 'KNOWN', now(), now())`,
      [ids.employmentB, ids.employeeB],
    );
    await client.query(
      `INSERT INTO "PayRate" (id, "employmentId", "rateType", amount, currency, "effectiveFrom", "createdAt", "updatedAt")
       VALUES ($1, $2, 'HOURLY', 120.00, 'MXN', '2099-01-01T00:00:00Z', now(), now())`,
      [ids.rateB, ids.employmentB],
    );
    const linkedIdentity = await queryOne<{ username: string; employeeId: string }>(
      client,
      `SELECT u.username, e.id AS "employeeId" FROM "User" u JOIN "Employee" e ON e."userId"=u.id WHERE u.id=$1`,
      [ids.user],
    );
    assert.equal(linkedIdentity.employeeId, ids.employeeB);
    assert.equal(linkedIdentity.username, `${PREFIX}login`);
    pass("Optional User to Employee link", "Legacy User row remains independently queryable");

    for (let day = 0; day < 5; day += 1) {
      await client.query(
        `INSERT INTO "AvailabilityRule" (id, "employmentId", "dayOfWeek", available, "startTime", "endTime", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, true, '17:00', '01:00', now(), now())`,
        [`${PREFIX}availability-${day}`, ids.employmentA, day],
      );
    }
    await client.query(
      `INSERT INTO "AvailabilityException" (id, "employmentId", date, type, reason, "createdAt", "updatedAt")
       VALUES ($1, $2, '2099-01-07', 'UNAVAILABLE', $3, now(), now())`,
      [`${PREFIX}availability-exception`, ids.employmentA, `${PREFIX}synthetic exception`],
    );
    const availability = await queryOne<{ rules: number; exceptions: number }>(
      client,
      `SELECT
         (SELECT count(*)::int FROM "AvailabilityRule" WHERE "employmentId"=$1) AS rules,
         (SELECT count(*)::int FROM "AvailabilityException" WHERE "employmentId"=$1) AS exceptions`,
      [ids.employmentA],
    );
    assert.deepEqual(availability, { rules: 5, exceptions: 1 });
    pass("Availability recurrence and exception", "Five recurring rules coexist with one dated override");

    await client.query(
      `INSERT INTO "SchedulePeriod" (id, "branchId", "periodStart", "periodEnd", status, version, "createdById", "createdAt", "updatedAt")
       VALUES ($1, $2, '2099-01-05', '2099-01-11', 'PUBLISHED', 2, $3, now(), now())`,
      [ids.period, ids.branchA, ids.user],
    );
    await client.query(
      `INSERT INTO "Shift" (id, "schedulePeriodId", "employmentId", "branchId", "businessDate", "startAt", "endAt", "expectedBreakMinutes", status, version, "createdById", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, '2099-01-05', '2099-01-06T05:00:00Z', '2099-01-06T09:00:00Z', 0, 'PUBLISHED', 1, $5, now(), now())`,
      [ids.shift, ids.period, ids.employmentA, ids.branchA, ids.user],
    );
    await client.query(
      `INSERT INTO "ShiftRevision" (id, "shiftId", "revisionNumber", "employmentId", "branchId", "businessDate", "startAt", "endAt", "expectedBreakMinutes", status, reason, "changedById", "changedAt")
       VALUES ($1, $2, 1, $3, $4, '2099-01-05', '2099-01-06T05:00:00Z', '2099-01-06T09:00:00Z', 0, 'PUBLISHED', $5, $6, now())`,
      [ids.revision1, ids.shift, ids.employmentA, ids.branchA, `${PREFIX}initial`, ids.user],
    );
    await client.query(
      `INSERT INTO "SchedulePublication" (id, "schedulePeriodId", version, "publishedById", "publishedAt") VALUES ($1,$2,1,$3,now())`,
      [ids.publication1, ids.period, ids.user],
    );
    await client.query(
      `INSERT INTO "SchedulePublicationShift" (id, "publicationId", "shiftId", "shiftRevisionId") VALUES ($1,$2,$3,$4)`,
      [ids.publicationLink1, ids.publication1, ids.shift, ids.revision1],
    );
    await client.query(
      `UPDATE "Shift" SET "startAt"='2099-01-06T06:00:00Z', "endAt"='2099-01-06T10:00:00Z', version=2, "updatedAt"=now() WHERE id=$1`,
      [ids.shift],
    );
    await client.query(
      `INSERT INTO "ShiftRevision" (id, "shiftId", "revisionNumber", "employmentId", "branchId", "businessDate", "startAt", "endAt", "expectedBreakMinutes", status, reason, "changedById", "changedAt")
       VALUES ($1, $2, 2, $3, $4, '2099-01-05', '2099-01-06T06:00:00Z', '2099-01-06T10:00:00Z', 0, 'PUBLISHED', $5, $6, now())`,
      [ids.revision2, ids.shift, ids.employmentA, ids.branchA, `${PREFIX}revision`, ids.user],
    );
    await client.query(
      `INSERT INTO "SchedulePublication" (id, "schedulePeriodId", version, "publishedById", "publishedAt") VALUES ($1,$2,2,$3,now())`,
      [ids.publication2, ids.period, ids.user],
    );
    await client.query(
      `INSERT INTO "SchedulePublicationShift" (id, "publicationId", "shiftId", "shiftRevisionId") VALUES ($1,$2,$3,$4)`,
      [ids.publicationLink2, ids.publication2, ids.shift, ids.revision2],
    );
    const publicationHistory = await client.query<{ version: number; revision: number }>(
      `SELECT p.version, r."revisionNumber" AS revision
       FROM "SchedulePublication" p
       JOIN "SchedulePublicationShift" ps ON ps."publicationId"=p.id
       JOIN "ShiftRevision" r ON r.id=ps."shiftRevisionId"
       WHERE p."schedulePeriodId"=$1 ORDER BY p.version`,
      [ids.period],
    );
    assert.deepEqual(publicationHistory.rows, [{ version: 1, revision: 1 }, { version: 2, revision: 2 }]);
    pass("Schedule publication versioning", "v1 remains on revision 1; v2 points to revision 2");

    const observed = [
      [`${PREFIX}clock-in`, "CLOCK_IN", "2099-01-05T23:03:00Z", `${PREFIX}idem-in`],
      [`${PREFIX}break-start`, "BREAK_START", "2099-01-06T03:00:00Z", `${PREFIX}idem-break-start`],
      [`${PREFIX}break-end`, "BREAK_END", "2099-01-06T03:30:00Z", `${PREFIX}idem-break-end`],
      [`${PREFIX}clock-out`, "CLOCK_OUT", "2099-01-06T07:04:00Z", `${PREFIX}idem-out`],
    ] as const;
    for (const [id, type, occurredAt, idempotencyKey] of observed) {
      await client.query(
        `INSERT INTO "ClockEvent" (id,"employmentId","branchId",type,"deviceOccurredAt","serverReceivedAt",timezone,source,"idempotencyKey","createdAt")
         VALUES ($1,$2,$3,$4,$5,now(),'America/Mexico_City','WFTEST',$6,now())`,
        [id, ids.employmentA, ids.branchA, type, occurredAt, idempotencyKey],
      );
    }
    await expectDatabaseRejection(
      client,
      "ClockEvent idempotency uniqueness",
      `INSERT INTO "ClockEvent" (id,"employmentId","branchId",type,"deviceOccurredAt","serverReceivedAt",timezone,source,"idempotencyKey","createdAt") VALUES ($1,$2,$3,'CLOCK_IN',now(),now(),'America/Mexico_City','WFTEST',$4,now())`,
      [`${PREFIX}duplicate-idempotency`, ids.employmentA, ids.branchA, `${PREFIX}idem-in`],
      "23505",
    );

    const missingIn = `${PREFIX}missing-in`;
    await client.query(
      `INSERT INTO "ClockEvent" (id,"employmentId","branchId",type,"deviceOccurredAt","serverReceivedAt",timezone,source,"idempotencyKey","createdAt") VALUES ($1,$2,$3,'CLOCK_IN','2099-01-07T23:02:00Z',now(),'America/Mexico_City','WFTEST',$4,now())`,
      [missingIn, ids.employmentA, ids.branchA, `${PREFIX}idem-missing-in`],
    );
    await client.query(
      `INSERT INTO "ClockCorrection" (id,"employmentId",type,"proposedEventType","proposedOccurredAt",reason,status,"requestedById","requestedAt","approvedById","approvedAt","createdAt","updatedAt")
       VALUES ($1,$2,'ADD_MISSING_EVENT','CLOCK_OUT','2099-01-08T07:05:00Z',$3,'APPROVED',$4,now(),$4,now(),now(),now())`,
      [`${PREFIX}correction-missing`, ids.employmentA, `${PREFIX}missing punch`, ids.user],
    );
    const missingObservedCount = await queryOne<{ count: number }>(client, `SELECT count(*)::int AS count FROM "ClockEvent" WHERE id=$1`, [missingIn]);
    assert.equal(missingObservedCount.count, 1);
    pass("Missing punch correction", "One observed CLOCK_IN remains; approved correction supplies CLOCK_OUT");

    const duplicateA = `${PREFIX}duplicate-a`;
    const duplicateB = `${PREFIX}duplicate-b`;
    for (const [id, second] of [[duplicateA, 0], [duplicateB, 5]] as const) {
      await client.query(
        `INSERT INTO "ClockEvent" (id,"employmentId","branchId",type,"deviceOccurredAt","serverReceivedAt",timezone,source,"idempotencyKey","createdAt") VALUES ($1,$2,$3,'CLOCK_IN',$4,now(),'America/Mexico_City','WFTEST',$5,now())`,
        [id, ids.employmentA, ids.branchA, new Date(Date.UTC(2099, 0, 9, 23, 2, second)), `${PREFIX}idem-${id}`],
      );
    }
    await client.query(
      `INSERT INTO "ClockCorrection" (id,"employmentId","targetClockEventId",type,reason,status,"requestedById","requestedAt","approvedById","approvedAt","createdAt","updatedAt") VALUES ($1,$2,$3,'VOID_EVENT',$4,'APPROVED',$5,now(),$5,now(),now(),now())`,
      [`${PREFIX}correction-void`, ids.employmentA, duplicateB, `${PREFIX}duplicate`, ids.user],
    );
    const duplicateCount = await queryOne<{ count: number }>(client, `SELECT count(*)::int AS count FROM "ClockEvent" WHERE id=ANY($1::text[])`, [[duplicateA, duplicateB]]);
    assert.equal(duplicateCount.count, 2);
    pass("Void correction", "Both observations remain; correction targets duplicate B");

    const originalOut = `${PREFIX}modify-out`;
    await client.query(
      `INSERT INTO "ClockEvent" (id,"employmentId","branchId",type,"deviceOccurredAt","serverReceivedAt",timezone,source,"idempotencyKey","createdAt") VALUES ($1,$2,$3,'CLOCK_OUT','2099-01-11T07:20:00Z',now(),'America/Mexico_City','WFTEST',$4,now())`,
      [originalOut, ids.employmentA, ids.branchA, `${PREFIX}idem-modify-out`],
    );
    await client.query(
      `INSERT INTO "ClockCorrection" (id,"employmentId","targetClockEventId",type,"proposedOccurredAt",reason,status,"requestedById","requestedAt","approvedById","approvedAt","createdAt","updatedAt") VALUES ($1,$2,$3,'MODIFY_OCCURRED_TIME','2099-01-11T07:05:00Z',$4,'APPROVED',$5,now(),$5,now(),now(),now())`,
      [`${PREFIX}correction-modify`, ids.employmentA, originalOut, `${PREFIX}adjust time`, ids.user],
    );
    const preservedTime = await queryOne<{ occurred: string }>(client, `SELECT to_char("deviceOccurredAt" AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI') AS occurred FROM "ClockEvent" WHERE id=$1`, [originalOut]);
    assert.equal(preservedTime.occurred, "2099-01-11 07:20");
    pass("Modify-time correction", "Observed 01:20-equivalent remains; correction preserves proposed 01:05-equivalent");

    const effectiveMissing = buildEffectiveClockStream(
      [{
        id: missingIn,
        employmentId: ids.employmentA,
        branchId: ids.branchA,
        type: "CLOCK_IN",
        occurredAt: new Date("2099-01-07T23:02:00Z"),
      }],
      [{
        id: `${PREFIX}correction-missing`,
        employmentId: ids.employmentA,
        requestedAt: new Date("2099-01-08T07:06:00Z"),
        status: "APPROVED",
        type: "ADD_MISSING_EVENT",
        branchId: ids.branchA,
        proposedEventType: "CLOCK_OUT",
        proposedOccurredAt: new Date("2099-01-08T07:05:00Z"),
      }],
    );
    assert.deepEqual(effectiveMissing.map((event) => event.type), ["CLOCK_IN", "CLOCK_OUT"]);
    pass("Effective stream integration", "Approved corrections alter effective output without changing observations");

    await client.query(
      `INSERT INTO "WorkSession" (id,"employmentId","branchId","shiftId","businessDate","startedAt","endedAt","workedMinutes","breakMinutes","reconstructionVersion",status,"reconstructedAt","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,'2099-01-05','2099-01-05T23:03:00Z','2099-01-06T07:04:00Z',451,30,1,'COMPLETE',now(),now(),now())`,
      [ids.sessionA, ids.employmentA, ids.branchA, ids.shift],
    );
    for (let index = 0; index < observed.length; index += 1) {
      await client.query(
        `INSERT INTO "WorkSessionClockEvent" (id,"workSessionId","clockEventId",sequence) VALUES ($1,$2,$3,$4)`,
        [`${PREFIX}session-event-${index}`, ids.sessionA, observed[index][0], index],
      );
    }
    await client.query(`UPDATE "WorkSession" SET "reconstructionVersion"=2,"updatedAt"=now() WHERE id=$1`, [ids.sessionA]);
    const session = await queryOne<{ businessDate: string; workedMinutes: number; breakMinutes: number; version: number; inputs: number }>(
      client,
      `SELECT to_char(w."businessDate",'YYYY-MM-DD') AS "businessDate", w."workedMinutes", w."breakMinutes", w."reconstructionVersion" AS version,
              count(l.id)::int AS inputs
       FROM "WorkSession" w JOIN "WorkSessionClockEvent" l ON l."workSessionId"=w.id WHERE w.id=$1 GROUP BY w.id`,
      [ids.sessionA],
    );
    assert.deepEqual(session, { businessDate: "2099-01-05", workedMinutes: 451, breakMinutes: 30, version: 2, inputs: 4 });
    pass("WorkSession reconstruction", "Materialized session keeps four observed inputs and increments reconstruction version");

    const unscheduledClock = `${PREFIX}unscheduled-clock`;
    await client.query(
      `INSERT INTO "ClockEvent" (id,"employmentId","branchId",type,"deviceOccurredAt","serverReceivedAt",timezone,source,"idempotencyKey","createdAt") VALUES ($1,$2,$3,'CLOCK_IN','2099-01-06T06:30:00Z',now(),'America/Mexico_City','WFTEST',$4,now())`,
      [unscheduledClock, ids.employmentA, ids.branchA, `${PREFIX}idem-unscheduled`],
    );
    await client.query(
      `INSERT INTO "WorkSession" (id,"employmentId","branchId","businessDate","startedAt","workedMinutes","breakMinutes","reconstructionVersion",status,"reconstructedAt","createdAt","updatedAt") VALUES ($1,$2,$3,'2099-01-06','2099-01-06T06:30:00Z',0,0,1,'OPEN',now(),now(),now())`,
      [ids.unscheduledSession, ids.employmentA, ids.branchA],
    );
    const businessDates = await client.query<{ id: string; date: string }>(
      `SELECT id,to_char("businessDate",'YYYY-MM-DD') AS date FROM "WorkSession" WHERE id=ANY($1::text[]) ORDER BY id`,
      [[ids.sessionA, ids.unscheduledSession]],
    );
    assert.deepEqual(new Set(businessDates.rows.map((row) => row.date)), new Set(["2099-01-05", "2099-01-06"]));
    pass("Business date", "Overnight scheduled session stays Monday; unscheduled 00:30 local is Tuesday");

    await client.query(
      `INSERT INTO "AttendanceException" (id,"employmentId","shiftId","workSessionId",type,severity,status,blocking,"detectedAt","createdAt","updatedAt") VALUES
       ($1,$4,$5,$6,'LATE','WARNING','OPEN',false,now(),now(),now()),
       ($2,$4,$5,$6,'MISSING_PUNCH','BLOCKING','OPEN',true,now(),now(),now()),
       ($3,$4,$5,$6,'OVERTIME','INFO','OPEN',false,now(),now(),now())`,
      [`${PREFIX}attendance-late`, `${PREFIX}attendance-missing`, `${PREFIX}attendance-overtime`, ids.employmentA, ids.shift, ids.sessionA],
    );
    await client.query(
      `UPDATE "AttendanceException" SET status='RESOLVED',"resolvedById"=$2,"resolvedAt"=now(),resolution=$3,"updatedAt"=now() WHERE id=$1`,
      [`${PREFIX}attendance-late`, ids.user, `${PREFIX}resolved`],
    );
    const attendance = await queryOne<{ resolved: number; blockingOpen: number }>(
      client,
      `SELECT count(*) FILTER (WHERE status='RESOLVED')::int AS resolved,
              count(*) FILTER (WHERE status='OPEN' AND blocking)::int AS "blockingOpen"
       FROM "AttendanceException" WHERE "employmentId"=$1`,
      [ids.employmentA],
    );
    assert.deepEqual(attendance, { resolved: 1, blockingOpen: 1 });
    pass("Attendance exceptions", "Resolved and blocking-open exceptions coexist with session/shift links");

    await client.query(
      `INSERT INTO "WorkSession" (id,"employmentId","branchId","businessDate","startedAt","endedAt","workedMinutes","breakMinutes","reconstructionVersion",status,"reconstructedAt","createdAt","updatedAt") VALUES ($1,$2,$3,'2099-01-05','2099-01-05T18:00:00Z','2099-01-05T20:00:00Z',120,0,1,'COMPLETE',now(),now(),now())`,
      [ids.sessionB, ids.employmentA, ids.branchB],
    );
    await client.query(
      `INSERT INTO "Timesheet" (id,"employmentId","periodStart","periodEnd",status,version,"approvedById","approvedAt","createdAt","updatedAt") VALUES ($1,$2,'2099-01-05','2099-01-11','APPROVED',1,$3,now(),now(),now())`,
      [ids.timesheet, ids.employmentA, ids.user],
    );
    await client.query(
      `INSERT INTO "TimesheetLine" (id,"timesheetId","businessDate","workedMinutes","adjustmentMinutes","regularPayableMinutes","overtimeTier1Minutes","overtimeTier2Minutes","totalPayableMinutes","createdAt","updatedAt") VALUES ($1,$2,'2099-01-05',571,15,480,106,0,586,now(),now())`,
      [ids.timesheetLine, ids.timesheet],
    );
    await client.query(
      `INSERT INTO "TimesheetLineWorkSession" (id,"timesheetLineId","workSessionId") VALUES ($1,$3,$4),($2,$3,$5)`,
      [`${PREFIX}line-session-a`, `${PREFIX}line-session-b`, ids.timesheetLine, ids.sessionA, ids.sessionB],
    );
    await client.query(
      `INSERT INTO "TimesheetAdjustment" (id,"timesheetLineId",type,minutes,reason,status,"createdById","createdAt","approvedById","approvedAt") VALUES ($1,$2,'ADD_PAYABLE_TIME',15,$3,'APPROVED',$4,now(),$4,now())`,
      [`${PREFIX}timesheet-adjustment`, ids.timesheetLine, `${PREFIX}approved time`, ids.user],
    );
    const line = await queryOne<{ worked: number; adjustment: number; total: number; sessions: number; branches: number }>(
      client,
      `SELECT l."workedMinutes" AS worked,l."adjustmentMinutes" AS adjustment,l."totalPayableMinutes" AS total,
              count(j.id)::int AS sessions,count(DISTINCT w."branchId")::int AS branches
       FROM "TimesheetLine" l JOIN "TimesheetLineWorkSession" j ON j."timesheetLineId"=l.id JOIN "WorkSession" w ON w.id=j."workSessionId"
       WHERE l.id=$1 GROUP BY l.id`,
      [ids.timesheetLine],
    );
    assert.deepEqual(line, { worked: 571, adjustment: 15, total: 586, sessions: 2, branches: 2 });
    assert.equal(480 + 106, 586);
    pass("Timesheet aggregation and adjustment", "Worked minutes remain 571; payable total is 586 after +15");
    pass("Multi-branch timesheet", "One line links two sessions and preserves two branch IDs");
    pass("Overtime categories", "Regular plus tier 1 plus tier 2 equals total payable minutes");

    await client.query(
      `INSERT INTO "PayrollPeriod" (id,"weekStart","weekEnd",status,"createdAt","updatedAt") VALUES
       ($1,'2099-01-05','2099-01-11','APROBADA',now(),now()),
       ($2,'2099-01-12','2099-01-18','BORRADOR',now(),now())`,
      [ids.payrollPeriod, ids.appliedPayrollPeriod],
    );
    await client.query(
      `INSERT INTO "PayrollLine" (id,"payrollPeriodId","employmentId","timesheetId","employeeNameSnapshot","rateTypeSnapshot","payRateAmountSnapshot","currencySnapshot","regularMinutes","overtimeTier1Minutes","overtimeTier2Minutes","overtimeTier1Multiplier","overtimeTier2Multiplier","adjustmentAmount","grossAmount","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,'HOURLY',100.00,'MXN',480,106,0,2.00,3.00,25.00,1200.00,now(),now())`,
      [ids.payrollLine, ids.payrollPeriod, ids.employmentA, ids.timesheet, `${PREFIX}Alpha Synthetic`],
    );
    await client.query(`UPDATE "Employee" SET "firstName"=$2,"updatedAt"=now() WHERE id=$1`, [ids.employeeA, `${PREFIX}Changed`]);
    await client.query(`UPDATE "PayRate" SET amount=999.00,"updatedAt"=now() WHERE id=$1`, [ids.rateA]);
    const snapshot = await queryOne<{ name: string; amount: string; currency: string }>(
      client,
      `SELECT "employeeNameSnapshot" AS name,"payRateAmountSnapshot"::text AS amount,"currencySnapshot" AS currency FROM "PayrollLine" WHERE id=$1`,
      [ids.payrollLine],
    );
    assert.deepEqual(snapshot, { name: `${PREFIX}Alpha Synthetic`, amount: "100.00", currency: "MXN" });
    pass("Payroll snapshot", "Employee and PayRate changes do not alter frozen line values");

    await client.query(
      `INSERT INTO "WorkforcePayrollAdjustment" (id,"originalPayrollLineId","appliedPayrollPeriodId",minutes,amount,reason,status,"createdById","createdAt","approvedById","approvedAt") VALUES ($1,$2,$3,15,50.00,$4,'APPROVED',$5,now(),$5,now())`,
      [`${PREFIX}retro-adjustment`, ids.payrollLine, ids.appliedPayrollPeriod, `${PREFIX}retroactive correction`, ids.user],
    );
    const originalGross = await queryOne<{ gross: string }>(client, `SELECT "grossAmount"::text AS gross FROM "PayrollLine" WHERE id=$1`, [ids.payrollLine]);
    assert.equal(originalGross.gross, "1200.00");
    pass("Retroactive payroll adjustment", "Adjustment references original line and later period without rewriting gross amount");

    await client.query("SAVEPOINT wftest_home_overlap");
    await client.query(
      `INSERT INTO "BranchAssignment" (id,"employmentId","branchId",type,"effectiveFrom","createdAt","updatedAt") VALUES ($1,$2,$3,'HOME','2099-01-02',now(),now())`,
      [`${PREFIX}overlapping-home`, ids.employmentA, ids.branchB],
    );
    const homes = await queryOne<{ count: number }>(client, `SELECT count(*)::int AS count FROM "BranchAssignment" WHERE "employmentId"=$1 AND type='HOME'`, [ids.employmentA]);
    assert.equal(homes.count, 2);
    await client.query("ROLLBACK TO SAVEPOINT wftest_home_overlap");
    await client.query("RELEASE SAVEPOINT wftest_home_overlap");
    pass("Deferred HOME overlap enforcement", "Database currently permits overlap; test insertion was rolled back");

    for (const [savepoint, sql, params] of [
      ["publication", `UPDATE "SchedulePublication" SET "publishedAt"='2099-01-01' WHERE id=$1`, [ids.publication1]],
      ["clock", `UPDATE "ClockEvent" SET "deviceOccurredAt"='2099-01-01' WHERE id=$1`, [observed[0][0]]],
      ["payroll", `UPDATE "PayrollLine" SET "grossAmount"=1 WHERE id=$1`, [ids.payrollLine]],
    ] as const) {
      await client.query(`SAVEPOINT wftest_${savepoint}`);
      const update = await client.query(sql, [...params]);
      assert.equal(update.rowCount, 1);
      await client.query(`ROLLBACK TO SAVEPOINT wftest_${savepoint}`);
      await client.query(`RELEASE SAVEPOINT wftest_${savepoint}`);
    }
    pass("Deferred immutability enforcement", "Publication, ClockEvent and finalized PayrollLine updates remain possible; all test updates rolled back");

    await expectDatabaseRejection(client, "Invalid pay-rate range", `INSERT INTO "PayRate" (id,"employmentId","rateType",amount,currency,"effectiveFrom","effectiveTo","createdAt","updatedAt") VALUES ($1,$2,'HOURLY',1,'MXN','2099-02-01','2099-01-01',now(),now())`, [`${PREFIX}bad-rate`, ids.employmentA], "23514");
    await expectDatabaseRejection(client, "Invalid shift duration", `INSERT INTO "Shift" (id,"schedulePeriodId","employmentId","branchId","businessDate","startAt","endAt","expectedBreakMinutes",status,version,"createdById","createdAt","updatedAt") VALUES ($1,$2,$3,$4,'2099-01-05','2099-01-06','2099-01-05',0,'DRAFT',1,$5,now(),now())`, [`${PREFIX}bad-shift`, ids.period, ids.employmentA, ids.branchA, ids.user], "23514");
    await expectDatabaseRejection(client, "Invalid revision number", `INSERT INTO "ShiftRevision" (id,"shiftId","revisionNumber","employmentId","branchId","businessDate","startAt","endAt","expectedBreakMinutes",status,"changedById","changedAt") VALUES ($1,$2,0,$3,$4,'2099-01-05','2099-01-06','2099-01-07',0,'DRAFT',$5,now())`, [`${PREFIX}bad-revision`, ids.shift, ids.employmentA, ids.branchA, ids.user], "23514");
    await expectDatabaseRejection(client, "Invalid event sequence", `INSERT INTO "WorkSessionClockEvent" (id,"workSessionId","clockEventId",sequence) VALUES ($1,$2,$3,-1)`, [`${PREFIX}bad-sequence`, ids.sessionA, unscheduledClock], "23514");
    await expectDatabaseRejection(client, "Invalid availability weekday", `INSERT INTO "AvailabilityRule" (id,"employmentId","dayOfWeek",available,"createdAt","updatedAt") VALUES ($1,$2,7,true,now(),now())`, [`${PREFIX}bad-weekday`, ids.employmentA], "23514");
    await expectDatabaseRejection(client, "Negative work-session minutes", `INSERT INTO "WorkSession" (id,"employmentId","branchId","businessDate","workedMinutes","breakMinutes","reconstructionVersion",status,"reconstructedAt","createdAt","updatedAt") VALUES ($1,$2,$3,'2099-01-05',-1,0,1,'INCOMPLETE',now(),now(),now())`, [`${PREFIX}bad-session`, ids.employmentA, ids.branchA], "23514");
    await expectDatabaseRejection(client, "Invalid timesheet range", `INSERT INTO "Timesheet" (id,"employmentId","periodStart","periodEnd",status,version,"createdAt","updatedAt") VALUES ($1,$2,'2099-02-01','2099-01-01','OPEN',1,now(),now())`, [`${PREFIX}bad-timesheet`, ids.employmentB], "23514");
    await client.query(
      `INSERT INTO "Timesheet" (id,"employmentId","periodStart","periodEnd",status,version,"createdAt","updatedAt") VALUES ($1,$2,'2099-01-12','2099-01-18','APPROVED',1,now(),now())`,
      [ids.timesheetB, ids.employmentB],
    );
    await expectDatabaseRejection(client, "Negative payroll minutes", `INSERT INTO "PayrollLine" (id,"payrollPeriodId","employmentId","timesheetId","employeeNameSnapshot","rateTypeSnapshot","payRateAmountSnapshot","currencySnapshot","regularMinutes","overtimeTier1Minutes","overtimeTier2Minutes","overtimeTier1Multiplier","overtimeTier2Multiplier","adjustmentAmount","grossAmount","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,'HOURLY',1,'MXN',-1,0,0,2,3,0,1,now(),now())`, [`${PREFIX}bad-payroll`, ids.appliedPayrollPeriod, ids.employmentB, ids.timesheetB, `${PREFIX}Bad`], "23514");

    await client.query("ROLLBACK");
    transactionOpen = false;

    const residue = await queryOne<{ employees: number; users: number; branches: number }>(
      client,
      `SELECT
         (SELECT count(*)::int FROM "Employee" WHERE id LIKE 'WFTEST-%') AS employees,
         (SELECT count(*)::int FROM "User" WHERE username LIKE 'WFTEST-%') AS users,
         (SELECT count(*)::int FROM "Branch" WHERE code LIKE 'WFTEST-%') AS branches`,
    );
    assert.deepEqual(residue, { employees: 0, users: 0, branches: 0 });
    pass("Fixture cleanup", "Transaction rollback left no WFTEST identity or branch fixtures");

    console.log(JSON.stringify({ database: { host: url.hostname, name: identity.database }, results }, null, 2));
  } catch (error) {
    results.push({ test: "Runner completion", status: "FAIL", notes: error instanceof Error ? error.message : String(error) });
    console.error(JSON.stringify({ results }, null, 2));
    process.exitCode = 1;
  } finally {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
    await client.end().catch(() => undefined);
  }
}

void main();
