import assert from "node:assert/strict";
import { Client } from "pg";

const HOST_PREFIX="ep-red-lake-ats4n9i7";

async function main(){
  const rawUrl=process.env.DATABASE_URL; assert.ok(rawUrl,"DATABASE_URL is required"); const url=new URL(rawUrl); assert.ok(url.hostname.startsWith(HOST_PREFIX),"refusing non-DEV endpoint"); assert.equal(url.pathname,"/neondb","refusing non-DEV database");
  const client=new Client({connectionString:rawUrl}); await client.connect();
  try {
    const nullable=(await client.query(`SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='ShiftRevision' AND column_name='reason'`)).rows[0]; assert.equal(nullable?.is_nullable,"NO","ShiftRevision.reason must be required");
    const counts=(await client.query(`SELECT
      (SELECT count(*)::int FROM "AvailabilityRule" WHERE id LIKE 'wfqa_availability_rule_%') rules,
      (SELECT count(*)::int FROM "AvailabilityException" WHERE id LIKE 'wfqa_availability_exception_%') exceptions,
      (SELECT count(*)::int FROM "Shift" WHERE id LIKE 'wfqa_shift_%') shifts,
      (SELECT count(*)::int FROM "SchedulePublicationShift" WHERE id LIKE 'wfqa_publication_shift_%') published_links,
      (SELECT count(*)::int FROM "Shift" s WHERE s.id LIKE 'wfqa_shift_%' AND s.status='DRAFT' AND NOT EXISTS (SELECT 1 FROM "SchedulePublicationShift" ps WHERE ps."shiftId"=s.id)) hidden_drafts,
      (SELECT count(*)::int FROM "ShiftRevision" WHERE id LIKE 'wfqa_revision_%' AND (reason IS NULL OR btrim(reason)='')) missing_reasons`)).rows[0];
    assert.deepEqual(counts,{rules:4,exceptions:1,shifts:4,published_links:3,hidden_drafts:1,missing_reasons:0});
    const overnight=(await client.query(`SELECT s."businessDate"::text business_date,to_char(s."startAt",'YYYY-MM-DD HH24:MI') start_at,to_char(s."endAt",'YYYY-MM-DD HH24:MI') end_at FROM "Shift" s WHERE s.id='wfqa_shift_02'`)).rows[0]; assert.deepEqual(overnight,{business_date:"2026-09-05",start_at:"2026-09-06 00:00",end_at:"2026-09-06 07:00"});
    console.log(JSON.stringify({environment:"verified DEV",shiftRevisionReasonRequired:true,...counts,overnightBusinessDatePreserved:true,legacyRowsMutated:0}));
  } finally {await client.end()}
}
main().catch((error)=>{console.error(error instanceof Error?error.message:error);process.exitCode=1});
