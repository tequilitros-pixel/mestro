import assert from "node:assert/strict";
import { Client } from "pg";

const HOST_PREFIX = "ep-red-lake-ats4n9i7";
const PREFIX = "WFQA-";
const id = (kind: string, n: number) => `wfqa_${kind}_${String(n).padStart(2, "0")}`;

async function main() {
  const rawUrl = process.env.DATABASE_URL;
  assert.ok(rawUrl, "DATABASE_URL is required");
  const url = new URL(rawUrl);
  assert.ok(url.hostname.startsWith(HOST_PREFIX), "refusing to reset outside verified DEV");
  assert.equal(url.pathname, "/neondb", "refusing non-DEV database");
  const client = new Client({ connectionString: rawUrl });
  await client.connect();
  try {
    const branches = (await client.query(`SELECT id,name FROM "Branch" WHERE active=true ORDER BY (code LIKE 'QA-%') DESC, code LIMIT 2`)).rows;
    assert.equal(branches.length, 2, "QA seed requires two preserved branches");
    const qaUser = (await client.query(`SELECT id FROM "User" WHERE active=true AND (username LIKE 'wfqa-%' OR name LIKE 'QA %') ORDER BY (username='wfqa-operator') DESC,id LIMIT 1`)).rows[0];
    assert.ok(qaUser, "QA seed requires one existing synthetic User; it will not create or modify User");
    await client.query("BEGIN");
    const employees = (await client.query(`SELECT id FROM "Employee" WHERE "displayName" LIKE $1`, [`${PREFIX}%`])).rows.map((row) => row.id);
    if (employees.length) {
      const employments = (await client.query(`SELECT id FROM "Employment" WHERE "employeeId"=ANY($1::text[])`, [employees])).rows.map((row) => row.id);
      if (employments.length) {
        const shifts = (await client.query(`SELECT id,"schedulePeriodId" FROM "Shift" WHERE "employmentId"=ANY($1::text[]) AND id LIKE 'wfqa_shift_%'`, [employments])).rows;
        if (shifts.length) {
          const shiftIds = shifts.map((row) => row.id);
          const periodIds = [...new Set(shifts.map((row) => row.schedulePeriodId))];
          await client.query(`DELETE FROM "SchedulePublicationShift" WHERE "shiftId"=ANY($1::text[])`, [shiftIds]);
          await client.query(`DELETE FROM "SchedulePublication" WHERE "schedulePeriodId"=ANY($1::text[])`, [periodIds]);
          await client.query(`DELETE FROM "ShiftRevision" WHERE "shiftId"=ANY($1::text[])`, [shiftIds]);
          await client.query(`DELETE FROM "Shift" WHERE id=ANY($1::text[])`, [shiftIds]);
          await client.query(`DELETE FROM "SchedulePeriod" WHERE id=ANY($1::text[])`, [periodIds]);
        }
        await client.query(`DELETE FROM "AvailabilityException" WHERE "employmentId"=ANY($1::text[])`, [employments]);
        await client.query(`DELETE FROM "AvailabilityRule" WHERE "employmentId"=ANY($1::text[])`, [employments]);
        await client.query(`DELETE FROM "PayRate" WHERE "employmentId"=ANY($1::text[])`, [employments]);
        await client.query(`DELETE FROM "BranchAssignment" WHERE "employmentId"=ANY($1::text[])`, [employments]);
        await client.query(`DELETE FROM "Employment" WHERE id=ANY($1::text[])`, [employments]);
      }
      await client.query(`DELETE FROM "Employee" WHERE id=ANY($1::text[])`, [employees]);
    }
    const definitions = [
      { name: "WFQA-Alex Norte", status: "ACTIVE", linked: true },
      { name: "WFQA-Bela Multi", status: "ACTIVE", linked: false },
      { name: "WFQA-Cris Sin Login", status: "ACTIVE", linked: false },
      { name: "WFQA-Dani Diario", status: "ACTIVE", linked: false },
      { name: "WFQA-Eli Inactivo", status: "INACTIVE", linked: false },
      { name: "WFQA-Fer Terminado", status: "TERMINATED", linked: false },
    ] as const;
    for (const [index, definition] of definitions.entries()) {
      const n = index + 1;
      await client.query(`INSERT INTO "Employee" (id,"userId","employeeNumber","displayName","firstName","lastName",active,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,null,null,$5,now(),now())`, [id("employee", n), definition.linked ? qaUser.id : null, `${PREFIX}${String(n).padStart(3, "0")}`, definition.name, definition.status === "ACTIVE"]);
      const startedAt = new Date("2025-01-01T00:00:00Z");
      const endedAt = definition.status === "ACTIVE" ? null : new Date("2026-06-30T00:00:00Z");
      await client.query(`INSERT INTO "Employment" (id,"employeeId",status,"startedAt","endedAt","terminationReason","dataConfidence","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,'KNOWN',now(),now())`, [id("employment", n), id("employee", n), definition.status, startedAt, endedAt, definition.status === "TERMINATED" ? "WFQA scenario complete" : null]);
      await client.query(`INSERT INTO "BranchAssignment" (id,"employmentId","branchId",type,"effectiveFrom","createdAt","updatedAt") VALUES ($1,$2,$3,'HOME',$4,now(),now())`, [id("home", n), id("employment", n), branches[index % 2].id, startedAt]);
      const rateType = n === 4 ? "DAILY" : "HOURLY";
      await client.query(`INSERT INTO "PayRate" (id,"employmentId","rateType",amount,currency,"effectiveFrom","createdAt","updatedAt") VALUES ($1,$2,$3,$4,'MXN',$5,now(),now())`, [id("rate", n), id("employment", n), rateType, rateType === "DAILY" ? 800 : 100 + n * 10, startedAt]);
    }
    await client.query(`INSERT INTO "BranchAssignment" (id,"employmentId","branchId",type,"effectiveFrom","createdAt","updatedAt") VALUES ($1,$2,$3,'ALLOWED',$4,now(),now()),($5,$2,$6,'ALLOWED',$4,now(),now()),($7,$8,$6,'ALLOWED',$4,now(),now())`, [id("allowed", 1), id("employment", 2), branches[0].id, new Date("2025-01-01T00:00:00Z"), id("allowed", 2), branches[1].id, id("allowed", 3), id("employment", 1)]);
    await client.query(`UPDATE "PayRate" SET "effectiveTo"=$1 WHERE id=$2`, [new Date("2026-01-01T00:00:00Z"), id("rate", 1)]);
    await client.query(`INSERT INTO "PayRate" (id,"employmentId","rateType",amount,currency,"effectiveFrom","createdAt","updatedAt") VALUES ($1,$2,'HOURLY',145,'MXN',$3,now(),now())`, [id("rate", 7), id("employment", 1), new Date("2026-01-01T00:00:00Z")]);
    await client.query("COMMIT");
    console.log(JSON.stringify({ environment: "verified DEV", prefix: PREFIX, employees: 6, branches: branches.map((branch) => branch.name), userRowsTouched: 0, branchRowsTouched: 0, employmentRows: 6, homeAssignments: 6, allowedAssignments: 3, payRates: 7 }, null, 2));
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; } finally { await client.end(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
