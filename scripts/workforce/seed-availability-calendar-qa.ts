import assert from "node:assert/strict";
import { Client } from "pg";

const HOST_PREFIX="ep-red-lake-ats4n9i7";
const id=(kind:string,n:number)=>`wfqa_${kind}_${String(n).padStart(2,"0")}`;
// PostgreSQL DATE receives an ISO civil date string. Passing a JavaScript Date
// here would allow the machine timezone to shift businessLocalDate by one day.
const day=(value:string)=>value;
// Prisma DateTime columns are timestamp-without-time-zone and are interpreted
// as UTC by Prisma. Raw pg fixtures therefore insert the UTC civil value.
const instant=(value:string)=>value.replace("T"," ").replace("Z","");

async function main(){
  const rawUrl=process.env.DATABASE_URL; assert.ok(rawUrl,"DATABASE_URL is required"); const url=new URL(rawUrl); assert.ok(url.hostname.startsWith(HOST_PREFIX),"refusing non-DEV endpoint"); assert.equal(url.pathname,"/neondb","refusing non-DEV database");
  const client=new Client({connectionString:rawUrl}); await client.connect();
  try {
    const branches=(await client.query(`SELECT id,name,COALESCE(timezone,'America/Mexico_City') timezone FROM "Branch" WHERE active=true ORDER BY (code LIKE 'QA-%') DESC,code LIMIT 2`)).rows; assert.equal(branches.length,2,"two branches required");
    const linkedEmployee=(await client.query(`SELECT 1 FROM "Employee" e JOIN "User" u ON u.id=e."userId" WHERE e.id=$1 AND u.active=true`,[id("employee",1)])).rows[0]; assert.ok(linkedEmployee,"linked WFQA employee/user required; run employment seed first");
    const actor=(await client.query(`SELECT id FROM "User" WHERE active=true AND name LIKE 'QA %' AND id NOT LIKE 'wfqa_auth_%' ORDER BY id LIMIT 1`)).rows[0]; assert.ok(actor,"stable synthetic QA actor required");
    await client.query("BEGIN");
    const shiftIds=[1,2,3,4].map((n)=>id("shift",n)); const periodIds=[1,2].map((n)=>id("period",n));
    await client.query(`DELETE FROM "SchedulePublicationShift" WHERE "shiftId"=ANY($1::text[])`,[shiftIds]);
    await client.query(`DELETE FROM "SchedulePublication" WHERE "schedulePeriodId"=ANY($1::text[])`,[periodIds]);
    await client.query(`DELETE FROM "ShiftRevision" WHERE "shiftId"=ANY($1::text[])`,[shiftIds]);
    await client.query(`DELETE FROM "Shift" WHERE id=ANY($1::text[])`,[shiftIds]);
    await client.query(`DELETE FROM "SchedulePeriod" WHERE id=ANY($1::text[])`,[periodIds]);
    await client.query(`DELETE FROM "AvailabilityException" WHERE id LIKE 'wfqa_availability_exception_%'`);
    await client.query(`DELETE FROM "AvailabilityRule" WHERE id LIKE 'wfqa_availability_rule_%'`);
    for(const [n,dow,available,start,end] of [[1,1,true,"09:00","18:00"],[2,2,true,"09:00","18:00"],[3,3,false,null,null],[4,4,true,"18:00","01:00"]] as const) await client.query(`INSERT INTO "AvailabilityRule" (id,"employmentId","dayOfWeek",available,"startTime","endTime","effectiveFrom","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,now(),now())`,[`wfqa_availability_rule_${n}`,id("employment",1),dow,available,start,end,day("2026-08-31")]);
    await client.query(`INSERT INTO "AvailabilityException" (id,"employmentId",date,type,"startTime","endTime",reason,"createdAt","updatedAt") VALUES ('wfqa_availability_exception_1',$1,$2,'AVAILABLE','12:00','20:00','WFQA date override',now(),now())`,[id("employment",1),day("2026-09-02")]);
    for(const [index,branch] of branches.entries()) await client.query(`INSERT INTO "SchedulePeriod" (id,"branchId","periodStart","periodEnd",status,version,"createdById","createdAt","updatedAt") VALUES ($1,$2,$3,$4,'PUBLISHED',1,$5,now(),now())`,[periodIds[index],branch.id,day("2026-08-31"),day("2026-09-06"),actor.id]);
    const shifts=[
      [1,0,"2026-09-01","2026-09-01T15:00:00Z","2026-09-01T23:00:00Z","PUBLISHED"],
      [2,1,"2026-09-05","2026-09-06T00:00:00Z","2026-09-06T07:00:00Z","PUBLISHED"],
      [3,0,"2026-09-03","2026-09-03T16:00:00Z","2026-09-04T00:00:00Z","PUBLISHED"],
      [4,0,"2026-09-04","2026-09-04T15:00:00Z","2026-09-04T23:00:00Z","DRAFT"],
    ] as const;
    for(const [n,branchIndex,businessDate,startAt,endAt,status] of shifts) await client.query(`INSERT INTO "Shift" (id,"schedulePeriodId","employmentId","branchId","businessDate","startAt","endAt","expectedBreakMinutes",status,version,"createdById","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,30,$8,1,$9,now(),now())`,[id("shift",n),periodIds[branchIndex],id("employment",1),branches[branchIndex].id,day(businessDate),instant(startAt),instant(endAt),status,actor.id]);
    const revisions=[
      [1,1,0,"2026-09-01","2026-09-01T15:00:00Z","2026-09-01T23:00:00Z","PUBLISHED","WFQA initial publication"],
      [2,1,1,"2026-09-05","2026-09-06T00:00:00Z","2026-09-06T07:00:00Z","PUBLISHED","WFQA overnight publication"],
      [3,1,0,"2026-09-03","2026-09-03T15:00:00Z","2026-09-03T23:00:00Z","PUBLISHED","WFQA initial publication"],
      [3,2,0,"2026-09-03","2026-09-03T16:00:00Z","2026-09-04T00:00:00Z","PUBLISHED","WFQA manager changed start time"],
    ] as const;
    for(const [shift,revision,branchIndex,businessDate,startAt,endAt,status,reason] of revisions) await client.query(`INSERT INTO "ShiftRevision" (id,"shiftId","revisionNumber","employmentId","branchId","businessDate","startAt","endAt","expectedBreakMinutes",status,reason,"changedById","changedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,30,$9,$10,$11,now())`,[`${id("revision",shift)}_${revision}`,id("shift",shift),revision,id("employment",1),branches[branchIndex].id,day(businessDate),instant(startAt),instant(endAt),status,reason,actor.id]);
    for(const [n,periodIndex] of [[1,0],[2,1]] as const) await client.query(`INSERT INTO "SchedulePublication" (id,"schedulePeriodId",version,"publishedById","publishedAt") VALUES ($1,$2,1,$3,$4)`,[id("publication",n),periodIds[periodIndex],actor.id,new Date(`2026-08-${n===1?"28":"29"}T12:00:00Z`)]);
    for(const [n,publication,revision] of [[1,1,1],[2,2,1],[3,1,2]] as const) await client.query(`INSERT INTO "SchedulePublicationShift" (id,"publicationId","shiftId","shiftRevisionId") VALUES ($1,$2,$3,$4)`,[id("publication_shift",n),id("publication",publication),id("shift",n),`${id("revision",n)}_${revision}`]);
    await client.query("COMMIT");
    console.log(JSON.stringify({environment:"verified DEV",availabilityRules:4,exceptions:1,publishedShifts:3,draftShifts:1,overnightShifts:1,changedPublishedShifts:1,userRowsTouched:0,branchRowsTouched:0},null,2));
  } catch(error){await client.query("ROLLBACK").catch(()=>undefined);throw error} finally {await client.end()}
}
main().catch((error)=>{console.error(error instanceof Error?error.message:error);process.exitCode=1});
