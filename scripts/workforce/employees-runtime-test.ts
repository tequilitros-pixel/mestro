import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {PrismaClient} from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {prisma,rawPrisma} from '@/lib/prisma';
import {withDatabaseActor} from '@/lib/database-context';
import {createEmployee,getEmployee,changeHomeBranch,changePayRate,changeEmploymentStatus,rehireEmployee,updateEmployeeProfile,changeJornada,addBranchAssignment,endAllowedBranch} from '@/lib/workforce/employment/service';
import {createOrUpdateShift,ensureSchedulePeriod} from '@/lib/workforce/scheduling/service';
const url=new URL(process.env.MIGRATION_DATABASE_URL!);assert.equal(url.hostname,'ep-red-lake-ats4n9i7.c-9.us-east-1.aws.neon.tech');
const owner=new PrismaClient({adapter:new PrismaPg({connectionString:url.href})});
const prefix='employees_'+randomUUID().slice(0,8);const d=(value:string)=>new Date(value+'T00:00:00Z');let count=0;
const check=async(name:string,run:()=>Promise<void>)=>{await run();console.log('PASS',++count,name);};
async function main(){
 const admin=await owner.user.create({data:{username:prefix+'_admin',name:'QA Empleados Admin',role:'ADMIN',password:'!disabled'}});
 const user=await owner.user.create({data:{username:prefix+'_user',name:'QA Empleados Usuario',role:'OPERATOR',password:'!disabled'}});
 const branches:Array<{id:string;name:string}>=[];for(const name of ['Principal','Permitida'])branches.push(await owner.branch.create({data:{name:'QA Empleados '+name,code:prefix+'_'+name,timezone:'America/Mexico_City',geofenceEnabled:false}}));
 const actor={id:admin.id,role:'ADMIN',accessibleBranchIds:null};
 const data=await withDatabaseActor(actor,async()=>{
  const blank=await createEmployee({displayName:'QA Empleado sin usuario',employment:{status:'ACTIVE',startedAt:null,dataConfidence:'LEGACY_UNKNOWN',effectiveFrom:d('2026-01-01')}});
  await check('employee without User preserves unknown start/pay/jornada',async()=>{const row=await getEmployee(blank.id);assert.equal(row!.userId,null);assert.equal(row!.employments[0].startedAt,null);assert.equal(row!.employments[0].payRates.length,0);assert.equal(row!.employments[0].jornadaPolicies.length,0);});
  const linked=await createEmployee({displayName:'QA Empleado vinculado',userId:user.id,employment:{status:'ACTIVE',startedAt:d('2026-01-01'),dataConfidence:'KNOWN',effectiveFrom:d('2026-01-01'),homeBranchId:branches[0].id,allowedBranchIds:[branches[1].id],jornadaType:'DAY',payRate:{rateType:'HOURLY',amount:50,currency:'MXN',effectiveFrom:d('2026-01-01')}}});
  const initial=(await getEmployee(linked.id))!;const employmentId=initial.employments[0].id;
  await check('linked User, HOME, ALLOWED, PayRate, jornada created atomically',async()=>{assert.equal(initial.userId,user.id);assert.equal(initial.employments[0].branchAssignments.length,2);assert.equal(Number(initial.employments[0].payRates[0].amount),50);assert.equal(initial.employments[0].jornadaPolicies[0].jornadaType,'DAY');});
  await check('edit visible name',async()=>{await updateEmployeeProfile({employeeId:linked.id,displayName:'QA Empleado editado'});assert.equal((await getEmployee(linked.id))!.displayName,'QA Empleado editado');});
  await check('HOME history preserved',async()=>{await changeHomeBranch({employmentId,branchId:branches[1].id,effectiveFrom:d('2026-02-01')});const rows=(await getEmployee(linked.id))!.employments[0].branchAssignments.filter(a=>a.type==='HOME');assert.equal(rows.length,2);assert.equal(rows.find(a=>a.branchId===branches[0].id)!.effectiveTo!.getTime(),d('2026-02-01').getTime());});
  await check('rate change retains old amount',async()=>{await changePayRate({employmentId,rateType:'HOURLY',amount:60,currency:'MXN',effectiveFrom:d('2026-02-01')});const rows=(await getEmployee(linked.id))!.employments[0].payRates;assert.equal(rows.length,2);assert.equal(Number(rows[1].amount),50);});
  await check('jornada history preserved',async()=>{await changeJornada({employmentId,jornadaType:'NIGHT',effectiveFrom:d('2026-02-01')});assert.equal((await getEmployee(linked.id))!.employments[0].jornadaPolicies.length,2);});
  await check('duplicate ALLOWED rejected',async()=>{await assert.rejects(addBranchAssignment({employmentId,branchId:branches[1].id,type:'ALLOWED',effectiveFrom:d('2026-02-01')}));});
  await check('end ALLOWED retains original assignment',async()=>{const a=initial.employments[0].branchAssignments.find(a=>a.type==='ALLOWED')!;await endAllowedBranch({employmentId,assignmentId:a.id,effectiveTo:d('2026-03-01')});assert.ok((await getEmployee(linked.id))!.employments[0].branchAssignments.find(row=>row.id===a.id)!.effectiveTo);});
  const period=await ensureSchedulePeriod(actor,branches[1].id,d('2026-02-02'));const shift=await createOrUpdateShift(actor,{periodId:period.id,employmentId,businessDate:d('2026-02-02'),startTime:'10:00',endTime:'18:00',expectedBreakMinutes:0});
  await check('termination requires reason and valid date',async()=>{await assert.rejects(changeEmploymentStatus({employmentId,status:'TERMINATED',effectiveAt:d('2026-04-01')}),/motivo/);await assert.rejects(changeEmploymentStatus({employmentId,status:'TERMINATED',effectiveAt:d('2025-01-01'),terminationReason:'QA'}),/anterior/);});
  await check('termination preserves shift, rates and assignments',async()=>{await changeEmploymentStatus({employmentId,status:'TERMINATED',effectiveAt:d('2026-04-01'),terminationReason:'Fin QA'});assert.ok(await prisma.shift.findUnique({where:{id:shift.id}}));const row=(await getEmployee(linked.id))!.employments[0];assert.equal(row.status,'TERMINATED');assert.equal(row.payRates.length,2);assert.equal(row.branchAssignments.length,3);});
  await check('terminated Employment cannot reopen or change rate',async()=>{await assert.rejects(changeEmploymentStatus({employmentId,status:'ACTIVE',effectiveAt:d('2026-05-01')}),/Recontratar/);await assert.rejects(changePayRate({employmentId,rateType:'HOURLY',amount:70,currency:'MXN',effectiveFrom:d('2026-05-01')}),/terminó/);});
  await check('rehire creates new Employment and keeps historical one closed',async()=>{const fresh=await rehireEmployee({employeeId:linked.id,startedAt:d('2026-05-01'),dataConfidence:'KNOWN'});assert.notEqual(fresh.id,employmentId);const rows=(await getEmployee(linked.id))!.employments;assert.equal(rows.length,2);assert.equal(rows.find(e=>e.id===employmentId)!.terminationReason,'Fin QA');});
  await check('duplicate rehire rejected',async()=>{await assert.rejects(rehireEmployee({employeeId:linked.id,startedAt:d('2026-06-01'),dataConfidence:'KNOWN'}));});
  return {employeeIds:[blank.id,linked.id]};
 });
 const sessions:Record<string,string>={};for(const [key,id]of [['admin',admin.id],['employee',user.id]]){const token=randomUUID()+randomUUID();await owner.userSession.create({data:{userId:id,tokenHash:createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+86400000)}});sessions[key]=token;}
 writeFileSync('/tmp/maestro-employees-qa.json',JSON.stringify({prefix,adminId:admin.id,userId:user.id,branches,...data,sessions}),{mode:0o600});console.log(`${count}/${count} service integration PASS`);
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await owner.$disconnect();await rawPrisma.$disconnect()});
