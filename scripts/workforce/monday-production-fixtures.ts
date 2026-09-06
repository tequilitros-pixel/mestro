import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import dotenv from 'dotenv';
// Only synthetic fixture provisioning/retirement uses this migration connection.
// Every production scheduling mutation is exercised through authenticated browser actions.
const env=dotenv.parse(readFileSync('.vercel/.env.production.local'));
const url=new URL(env.DATABASE_URL_UNPOOLED);
assert.equal(url.hostname,'ep-noisy-rain-at5phvb9.c-9.us-east-1.aws.neon.tech');url.searchParams.set('sslmode','verify-full');
const db=new PrismaClient({adapter:new PrismaPg(new pg.Pool({connectionString:url.href}))});
const file='/tmp/maestro-monday-production-qa.json';
async function main(){
 if(process.argv[2]==='retire'){
  const q=JSON.parse(readFileSync(file,'utf8'));assert.match(q.prefix,/^monday_prod_[a-f0-9]{8}$/);
  await db.$transaction(async tx=>{
   const users=await tx.user.findMany({where:{id:{in:[q.adminId,q.userId]}}});assert.equal(users.length,2);assert.ok(users.every(u=>u.username.startsWith(q.prefix)));
   await tx.userSession.deleteMany({where:{userId:{in:[q.adminId,q.userId]}}});
   await tx.user.updateMany({where:{id:{in:[q.adminId,q.userId]}},data:{active:false}});
   await tx.employee.updateMany({where:{id:{in:q.employees.map((e:{id:string})=>e.id)}},data:{active:false}});
   await tx.employment.updateMany({where:{id:{in:q.employmentIds}},data:{status:'INACTIVE'}});
   await tx.branch.updateMany({where:{id:{in:q.branches.map((b:{id:string})=>b.id)}},data:{active:false,geofenceEnabled:false,defaultScheduleTemplateId:null}});
   await tx.scheduleTemplate.updateMany({where:{branchId:{in:q.branches.map((b:{id:string})=>b.id)}},data:{active:false}});
  },{timeout:30000});
  const record={...q};delete record.sessions;writeFileSync('docs/workforce/monday-qa/production-fixtures.json',JSON.stringify({...record,retiredAt:new Date().toISOString(),historyRetained:true},null,2));console.log('Synthetic production fixtures retired; sessions revoked; publication history retained.');return;
 }
 assert.equal(process.argv[2],'seed');
 const prefix='monday_prod_'+randomUUID().slice(0,8);
 const data=await db.$transaction(async tx=>{
  const admin=await tx.user.create({data:{username:prefix+'_admin',name:'QA Horarios temporal',password:'!disabled-qa',role:'ADMIN'}});
  const user=await tx.user.create({data:{username:prefix+'_employee',name:'QA Horarios empleado',password:'!disabled-qa',role:'OPERATOR'}});
  const branches=[];for(const suffix of ['A','B'])branches.push(await tx.branch.create({data:{name:`QA Horarios ${prefix.slice(-8)} ${suffix}`,code:`QAM_${prefix.slice(-8)}_${suffix}`,timezone:'America/Mexico_City',geofenceEnabled:false}}));
  const employees=[];const employmentIds=[];
  for(const [i,name]of ['Uno','Dos','Tres'].entries()){
   const employee=await tx.employee.create({data:{displayName:`QA Horarios ${name}`,userId:i===0?user.id:undefined,employments:{create:{status:'ACTIVE',dataConfidence:'KNOWN',startedAt:new Date('2026-01-01'),branchAssignments:{create:{branchId:branches[0].id,type:'HOME',effectiveFrom:new Date('2026-01-01')}}}}},include:{employments:true}});employees.push({id:employee.id,name:employee.displayName});employmentIds.push(employee.employments[0].id);
  }
  const template=await tx.scheduleTemplate.create({data:{name:'QA Semana temporal',branchId:branches[0].id,createdById:admin.id,shifts:{create:{branchId:branches[0].id,dayOfWeek:0,type:'TURNO',startTime:'10:00',endTime:'18:00',breakMinutes:0}}}});
  await tx.branch.update({where:{id:branches[0].id},data:{defaultScheduleTemplateId:template.id}});
  const sessions:Record<string,string>={};for(const [key,id]of [['admin',admin.id],['employee',user.id]]){const token=randomUUID()+randomUUID();await tx.userSession.create({data:{userId:id,tokenHash:createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+3600000)}});sessions[key]=token;}
  return {prefix,adminId:admin.id,userId:user.id,branches,employees,employmentIds,templateId:template.id,sessions};
 },{timeout:30000});
 writeFileSync(file,JSON.stringify(data),{mode:0o600});console.log('Synthetic QA identities, branches and template provisioned. No shifts created.');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
