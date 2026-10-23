import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prisma, rawPrisma } from '@/lib/prisma';
import { withDatabaseActor } from '@/lib/database-context';
import { applyScheduleTemplate, createOrUpdateShift, getGlobalScheduleBoard, publishSchedulePeriod } from '@/lib/workforce/scheduling/service';
assert.equal(new URL(process.env.MIGRATION_DATABASE_URL!).hostname,'ep-red-lake-ats4n9i7.c-9.us-east-1.aws.neon.tech');
const qa=JSON.parse(readFileSync('/tmp/maestro-monday-qa.json','utf8'));
const actor={id:qa.adminId,role:'ADMIN',accessibleBranchIds:null};
async function main(){await withDatabaseActor(actor,async()=>{
 const branch=await prisma.branch.findUniqueOrThrow({where:{id:qa.uiBranchId}});
 if(!await prisma.shift.count({where:{employmentId:qa.employmentIds[2],businessDate:new Date('2026-09-21')}})){const applied=await applyScheduleTemplate(actor,{templateId:branch.defaultScheduleTemplateId!,employmentIds:[qa.employmentIds[2]],weekStart:new Date('2026-09-21')});assert.equal(applied.created,5);console.log('PASS single apply creates five drafts');}
 const shift=await prisma.shift.findFirstOrThrow({where:{schedulePeriodId:qa.periodId,employmentId:qa.employmentIds[0],businessDate:new Date('2026-09-07')}});
 await createOrUpdateShift(actor,{periodId:qa.periodId,shiftId:shift.id,expectedVersion:shift.version,employmentId:shift.employmentId,businessDate:shift.businessDate,startTime:'10:00',endTime:'17:00',expectedBreakMinutes:0,reason:'QA revisión posterior a publicar'});
 const board=await getGlobalScheduleBoard(actor,null,new Date('2026-09-07'));const pending=board.periods.find(p=>p.id===qa.periodId)!;assert.equal(pending.status,'DRAFT');assert.ok(pending.publications.length);console.log('PASS changes pending retains prior publication');
 const published=await publishSchedulePeriod(actor,qa.periodId);assert.equal(published.idempotent,false);assert.equal(await prisma.schedulePublication.count({where:{schedulePeriodId:qa.periodId}}),2);console.log('PASS explicit republication preserves both snapshots');
});}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>rawPrisma.$disconnect());
