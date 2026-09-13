import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { prisma, rawPrisma } from '@/lib/prisma';
import { withDatabaseActor } from '@/lib/database-context';
import { createEmployee, addBranchAssignment } from '@/lib/workforce/employment/service';
import { applyScheduleTemplate, createOrUpdateShift, deleteOrCancelShift, ensureSchedulePeriod, getGlobalScheduleBoard, publishSchedulePeriod } from '@/lib/workforce/scheduling/service';
import { getEmployeeCalendar } from '@/lib/workforce/calendar/service';

const url = new URL(process.env.MIGRATION_DATABASE_URL!);
assert.equal(url.hostname, 'ep-red-lake-ats4n9i7.c-9.us-east-1.aws.neon.tech', 'DEV only');
const owner = new PrismaClient({ adapter: new PrismaPg(new pg.Pool({connectionString:url.href})) });
const prefix = `monday_${randomUUID().slice(0,8)}`;
const week = new Date('2026-09-07T00:00:00Z');
let passed=0;
async function check(name:string, run:()=>Promise<void>){await run();console.log(`PASS ${++passed}: ${name}`);}
async function main(){
 const admin=await owner.user.create({data:{username:prefix+'_admin',name:'QA Horarios Admin',password:'!disabled',role:'ADMIN'}});
 const user=await owner.user.create({data:{username:prefix+'_employee',name:'QA Anguel',password:'!disabled',role:'OPERATOR'}});
 const actor={id:admin.id,role:'ADMIN',accessibleBranchIds:null};
 const employeeActor={id:user.id,role:'OPERATOR'};
 const branches=await Promise.all(['Barra','Centro'].map((name,i)=>owner.branch.create({data:{name:'QA '+name,code:prefix+'_'+i,timezone:'America/Mexico_City',geofenceEnabled:false}})));
 const [a,b]=branches;
 const result=await withDatabaseActor(actor,async()=>{
  const employees=[];
  for(const [i,name] of ['Anguel','Edgar','María'].entries()) employees.push(await createEmployee({displayName:'QA '+name,userId:i===0?user.id:undefined,employment:{status:'ACTIVE',dataConfidence:'KNOWN',startedAt:new Date('2026-01-01'),effectiveFrom:new Date('2026-01-01'),homeBranchId:i<2?a.id:undefined}}));
  const employments=await prisma.employment.findMany({where:{employeeId:{in:employees.map(x=>x.id)}}});
  const ids=employees.map(e=>employments.find(x=>x.employeeId===e.id)!.id);
  await check('BranchAssignment HOME and ALLOWED',async()=>{await addBranchAssignment({employmentId:ids[0],branchId:b.id,type:'ALLOWED',effectiveFrom:new Date('2026-01-01')});await addBranchAssignment({employmentId:ids[1],branchId:b.id,type:'ALLOWED',effectiveFrom:new Date('2026-01-01')});});
  const template=await prisma.scheduleTemplate.create({data:{name:'QA Horario Barra',branchId:a.id,createdById:admin.id,shifts:{create:[0,1,3,4,5].map(day=>({branchId:a.id,dayOfWeek:day,startTime:day>=4?'17:00':'10:00',endTime:day>=4?'01:00':'18:00',breakMinutes:0,type:'TURNO'}))}}});
  await prisma.branch.update({where:{id:a.id},data:{defaultScheduleTemplateId:template.id}});
  let periodId='';
  await check('bulk template creates ten DRAFT shifts atomically',async()=>{const r=await applyScheduleTemplate(actor,{templateId:template.id,employmentIds:ids.slice(0,2),weekStart:week});periodId=r.periodId;assert.equal(r.created,10);assert.equal(await prisma.shift.count({where:{schedulePeriodId:periodId,status:'DRAFT'}}),10);});
  await check('template conflict rolls back all writes',async()=>{await assert.rejects(applyScheduleTemplate(actor,{templateId:template.id,employmentIds:ids.slice(0,2),weekStart:week}),/ya tiene un turno/);assert.equal(await prisma.shift.count({where:{schedulePeriodId:periodId}}),10);});
  const periodB=await ensureSchedulePeriod(actor,b.id,week);
  await check('cross-branch overlap names employee, branch and times',async()=>{await assert.rejects(createOrUpdateShift(actor,{periodId:periodB.id,employmentId:ids[1],businessDate:week,startTime:'16:00',endTime:'22:00',expectedBreakMinutes:0}),/QA Edgar ya tiene un turno en QA Barra de 10:00 a 18:00/);});
  await check('individual edit leaves template and coworker untouched',async()=>{const shift=await prisma.shift.findFirstOrThrow({where:{schedulePeriodId:periodId,employmentId:ids[1],businessDate:new Date('2026-09-11')}});await createOrUpdateShift(actor,{periodId,shiftId:shift.id,expectedVersion:shift.version,employmentId:ids[1],businessDate:shift.businessDate,startTime:'19:00',endTime:'01:00',expectedBreakMinutes:0});assert.equal((await prisma.scheduleTemplateShift.findFirstOrThrow({where:{templateId:template.id,dayOfWeek:4}})).startTime,'17:00');});
  await check('create, move between branches, and delete shift',async()=>{const s=await createOrUpdateShift(actor,{periodId,employmentId:ids[0],businessDate:new Date('2026-09-09'),startTime:'10:00',endTime:'18:00',expectedBreakMinutes:0});const moved=await createOrUpdateShift(actor,{periodId,shiftId:s.id,expectedVersion:s.version,branchId:b.id,employmentId:ids[0],businessDate:s.businessDate,startTime:'10:00',endTime:'18:00',expectedBreakMinutes:0});assert.equal(moved.branchId,b.id);const temp=await createOrUpdateShift(actor,{periodId:periodB.id,employmentId:ids[1],businessDate:new Date('2026-09-09'),startTime:'10:00',endTime:'18:00',expectedBreakMinutes:0});assert.equal((await deleteOrCancelShift(actor,{shiftId:temp.id,expectedVersion:temp.version})).deleted,true);});
  await check('global board keeps unassigned employee and sums all branches',async()=>{const board=await getGlobalScheduleBoard(actor,null,week);assert.ok(board.employments.some(e=>e.id===ids[2]&&e.branchAssignments.length===0));assert.equal(board.hours.get(ids[0]),48);assert.equal(board.hours.get(ids[1]),38);});
  await check('employee cannot publish',async()=>{await assert.rejects(withDatabaseActor(employeeActor,()=>publishSchedulePeriod({...employeeActor,accessibleBranchIds:[]},periodId)));});
  await check('draft schedules hidden from employee',async()=>{const c=await withDatabaseActor(employeeActor,()=>getEmployeeCalendar(employeeActor,week,7));assert.equal(c.shifts.length,0);});
  await check('publish and repeated publish preserve SchedulePublication',async()=>{assert.equal((await publishSchedulePeriod(actor,periodId)).idempotent,false);assert.equal((await publishSchedulePeriod(actor,periodId)).idempotent,true);await publishSchedulePeriod(actor,periodB.id);});
  await check('employee sees published dates, hours and both branches',async()=>{const c=await withDatabaseActor(employeeActor,()=>getEmployeeCalendar(employeeActor,week,7));assert.equal(c.shifts.length,6);assert.deepEqual(new Set(c.shifts.map(s=>s.branchName)),new Set(['QA Barra','QA Centro']));});
  return {employees,employmentIds:ids,templateId:template.id,periodId};
 });
 const sessions:Record<string,string>={};
 for(const [key,id]of [['admin',admin.id],['employee',user.id]]){const token=randomUUID()+randomUUID();await owner.userSession.create({data:{userId:id,tokenHash:createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+86400000)}});sessions[key]=token;}
 writeFileSync('/tmp/maestro-monday-qa.json',JSON.stringify({prefix,adminId:admin.id,userId:user.id,branches, ...result,sessions}),{mode:0o600});
 console.log(`Scheduling integration: ${passed}/${passed} PASS. QA fixtures retained in DEV for browser checks.`);
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await owner.$disconnect();await rawPrisma.$disconnect();});
