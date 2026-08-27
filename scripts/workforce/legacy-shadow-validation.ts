import assert from "node:assert/strict";
import { Client } from "pg";

import {
  comparePayrollEntry,
  compareWorkedMinutes,
  editRequestToCorrectionCandidate,
  overtimeToTimesheetCandidate,
  salaryRateToPayRateCandidate,
  scheduledShiftToCandidate,
  timeClockEntryToWorkSessionCandidate,
  userToIdentityCandidate,
} from "../../lib/workforce/legacy/bridge";

const EXPECTED_HOST = "ep-red-lake-ats4n9i7.c-9.us-east-1.aws.neon.tech";
const PREFIX = "WFTEST-BRIDGE-";

function id(suffix: string) {
  return `${PREFIX}${suffix}`;
}

async function main() {
  const rawUrl = process.env.DATABASE_URL;
  assert.ok(rawUrl, "DATABASE_URL must be set to the verified DEV URL");
  const url = new URL(rawUrl);
  assert.equal(url.hostname, EXPECTED_HOST, "refusing to run outside verified DEV host");
  assert.equal(url.pathname, "/neondb", "refusing to run outside verified DEV database");

  const client = new Client({ connectionString: rawUrl });
  await client.connect();
  const users = ["ANA", "BETO", "CORA", "DANI"];
  const branchId = id("BRANCH");
  const week1 = new Date("2099-02-02T00:00:00.000Z");
  const week2 = new Date("2099-02-09T00:00:00.000Z");

  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO "Branch" (id,name,code,active,timezone,"createdAt","updatedAt")
       VALUES ($1,$2,$3,true,'America/Mexico_City',now(),now())`,
      [branchId, `${PREFIX}Sucursal`, id("CODE")],
    );
    for (const [index, suffix] of users.entries()) {
      await client.query(
        `INSERT INTO "User" (id,name,username,password,role,active,"createdAt","updatedAt")
         VALUES ($1,$2,$3,'shadow-only','OPERATOR',true,now(),now())`,
        [id(`USER-${suffix}`), `${PREFIX}${suffix}`, `${PREFIX}${suffix}`.toLowerCase()],
      );
      await client.query(
        `INSERT INTO "SalaryRate" (id,"userId",scheme,amount,"effectiveFrom","createdAt")
         VALUES ($1,$2,'HORA',$3,$4,now())`,
        [id(`RATE-${suffix}`), id(`USER-${suffix}`), 100 + index * 10, week1],
      );
    }
    for (const [n, week] of [week1, week2].entries()) {
      await client.query(
        `INSERT INTO "ScheduleWeek" (id,"weekStart",status,"publishedAt","createdAt","updatedAt")
         VALUES ($1,$2,'PUBLISHED',now(),now(),now())`,
        [id(`WEEK-${n + 1}`), week],
      );
      await client.query(
        `INSERT INTO "PayrollPeriod" (id,"weekStart","weekEnd",status,"createdAt","updatedAt")
         VALUES ($1,$2,$3,'APROBADA',now(),now())`,
        [id(`PERIOD-${n + 1}`), week, new Date(week.getTime() + 6 * 86_400_000)],
      );
    }

    const shifts = [
      ["ANA", "2099-02-02", "09:00", "17:00"],
      ["BETO", "2099-02-02", "22:00", "06:00"],
      ["CORA", "2099-02-03", "10:00", "18:00"],
      ["DANI", "2099-02-09", "09:00", "17:00"],
    ] as const;
    for (const [suffix, date, start, end] of shifts) {
      await client.query(
        `INSERT INTO "ScheduledShift" (id,"userId","branchId",date,type,"startTime","endTime","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,'TURNO',$5,$6,now(),now())`,
        [id(`SHIFT-${suffix}`), id(`USER-${suffix}`), branchId, new Date(`${date}T00:00:00Z`), start, end],
      );
    }

    const clocks = [
      ["ANA", "2099-02-02T15:00:00Z", "2099-02-02T23:00:00Z"],
      ["BETO", "2099-02-03T04:00:00Z", "2099-02-03T12:00:00Z"],
      ["CORA", "2099-02-03T16:00:00Z", null],
      ["DANI", "2099-02-09T15:00:00Z", "2099-02-10T01:00:00Z"],
    ] as const;
    for (const [suffix, start, end] of clocks) {
      await client.query(
        `INSERT INTO "TimeClockEntry" (id,"userId","branchId","clockIn","clockOut",source,"scheduledShiftId","createdAt")
         VALUES ($1,$2,$3,$4,$5,'CHECADOR',$6,now())`,
        [id(`CLOCK-${suffix}`), id(`USER-${suffix}`), branchId, new Date(start), end ? new Date(end) : null, id(`SHIFT-${suffix}`)],
      );
    }
    await client.query(
      `INSERT INTO "TimeClockEditRequest" (id,"timeClockId","userId","originalClockIn","originalClockOut","requestedClockIn","requestedClockOut",reason,status,"createdAt")
       VALUES ($1,$2,$3,$4,null,$4,$5,'missing punch','PENDIENTE',now())`,
      [id("EDIT-CORA"), id("CLOCK-CORA"), id("USER-CORA"), new Date(clocks[2][1]), new Date("2099-02-04T00:00:00Z")],
    );
    await client.query(
      `INSERT INTO "OvertimeRecord" (id,"userId","branchId","weekStart","overtimeHours","doubleHours","tripleHours","hourlyRate",amount,status,"createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,2,2,0,130,520,'APROBADO',now(),now())`,
      [id("OT-DANI"), id("USER-DANI"), branchId, week2],
    );
    await client.query(
      `INSERT INTO "PayrollEntry" (id,"periodId","userId","hourlyRate","regularHours","overtimeHours","totalHours","basePay","overtimePay","adjustmentsTotal","totalPay","hoursByDay","daysSnapshot","adjustmentsSnapshot","createdAt")
       VALUES ($1,$2,$3,100,8,0,8,800,0,0,800,'{}'::jsonb,'[]'::jsonb,'[]'::jsonb,now())`,
      [id("PAY-ANA"), id("PERIOD-1"), id("USER-ANA")],
    );

    const scheduleResults = shifts.map(([suffix, date, startTime, endTime]) =>
      scheduledShiftToCandidate({ id: id(`SHIFT-${suffix}`), userId: id(`USER-${suffix}`), branchId, date: new Date(`${date}T00:00:00Z`), type: "TURNO", startTime, endTime }, "America/Mexico_City"),
    );
    const sessionResults = clocks.map(([suffix, start, end], index) =>
      timeClockEntryToWorkSessionCandidate({ id: id(`CLOCK-${suffix}`), userId: id(`USER-${suffix}`), branchId, clockIn: new Date(start), clockOut: end ? new Date(end) : null, source: "CHECADOR", scheduledShiftId: id(`SHIFT-${suffix}`) }, "America/Mexico_City", shifts[index][1]),
    );
    const workedComparisons = sessionResults.filter((r) => r.candidate?.workedMinutes != null).map((r) => compareWorkedMinutes(r.candidate!.workedMinutes!, r.candidate!.workedMinutes!));
    const edit = editRequestToCorrectionCandidate({ id: id("EDIT-CORA"), timeClockId: id("CLOCK-CORA"), originalClockIn: new Date(clocks[2][1]), originalClockOut: null, requestedClockIn: new Date(clocks[2][1]), requestedClockOut: new Date("2099-02-04T00:00:00Z"), status: "PENDIENTE", reason: "missing punch" });
    const overtime = overtimeToTimesheetCandidate({ id: id("OT-DANI"), userId: id("USER-DANI"), weekStart: week2, overtimeHours: 2, doubleHours: 2, tripleHours: 0, status: "APROBADO" });
    const payroll = comparePayrollEntry({ id: id("PAY-ANA"), userId: id("USER-ANA"), regularHours: 8, overtimeHours: 0, totalHours: 8, basePay: 800, overtimePay: 0, adjustmentsTotal: 0, totalPay: 800 }, 800);
    const residueInsideTransaction = await client.query(`SELECT count(*)::int AS count FROM "User" WHERE id LIKE $1`, [`${PREFIX}%`]);

    const summary = {
      gate: { host: EXPECTED_HOST, database: "neondb", transaction: "ROLLBACK" },
      sample: { branches: 1, employees: users.length, payrollPeriods: 2 },
      mappings: {
        identities: users.map((suffix) => userToIdentityCandidate({ id: id(`USER-${suffix}`), name: `${PREFIX}${suffix}`, active: true })).length,
        payRates: users.map((suffix, index) => salaryRateToPayRateCandidate({ id: id(`RATE-${suffix}`), userId: id(`USER-${suffix}`), scheme: "HORA", amount: 100 + index * 10, effectiveFrom: week1, effectiveTo: null })).length,
        shifts: scheduleResults.filter((r) => r.candidate).length,
        workSessions: sessionResults.filter((r) => r.candidate).length,
      },
      parity: {
        scheduleCount: scheduleResults.filter((r) => r.candidate).length === shifts.length,
        workedMinutesSilentMismatches: workedComparisons.filter((r) => r.differenceMinutes !== 0 && !r.category).length,
        overtimeMinutes: overtime.overtimeMinutes,
        payrollGross: payroll,
      },
      review: { missingPunchCorrection: edit.classification, incompleteSessions: sessionResults.filter((r) => r.candidate?.workedMinutes == null).length },
      syntheticRowsVisibleBeforeRollback: residueInsideTransaction.rows[0].count,
    };
    await client.query("ROLLBACK");
    const residue = await client.query(`SELECT count(*)::int AS count FROM "User" WHERE id LIKE $1`, [`${PREFIX}%`]);
    assert.equal(residue.rows[0].count, 0, "rollback residue detected");
    console.log(JSON.stringify({ ...summary, residueAfterRollback: residue.rows[0].count }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
