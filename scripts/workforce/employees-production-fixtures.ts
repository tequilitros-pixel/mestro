import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import dotenv from 'dotenv';
import {PrismaClient} from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
// Migration credentials only provision/retire isolated QA identities. Employee mutations run through the UI.
const env=dotenv.parse(readFileSync('.vercel/.env.production.local'));
const url=new URL(env.DATABASE_URL_UNPOOLED);assert.equal(url.hostname,'ep-noisy-rain-at5phvb9.c-9.us-east-1.aws.neon.tech');url.searchParams.set('sslmode','verify-full');
const db=new PrismaClient({adapter:new PrismaPg({connectionString:url.href})});const file='/tmp/maestro-employees-production-qa.json';
async function main(){
 if(process.argv[2]==='retire'){
  const q=JSON.parse(readFileSync(file,'utf8'));assert.match(q.prefix,/^employees_prod_[a-f0-9]{8}$/);
  await db.$transaction(async tx=>{
   const users=await tx.user.findMany({where:{id:{in:[q.adminId,q.userId]}}});assert.ok(users.length===2&&users.every(u=>u.username.startsWith(q.prefix)));
   const employees=await tx.employee.findMany({where:{id:{in:q.employeeIds}}});assert.ok(employees.every(e=>e.displayName?.includes(q.prefix)));
   await tx.userSession.deleteMany({where:{userId:{in:[q.adminId,q.userId]}}});await tx.user.updateMany({where:{id:{in:[q.adminId,q.userId]}},data:{active:false}});
   await tx.employee.updateMany({where:{id:{in:q.employeeIds}},data:{active:false}});
   await tx.employment.updateMany({where:{employeeId:{in:q.employeeIds},status:{not:'TERMINATED'}},data:{status:'INACTIVE'}});
   await tx.branch.updateMany({where:{id:{in:q.branches.map((b:{id:string})=>b.id)}},data:{active:false,defaultScheduleTemplateId:null}});
   await tx.scheduleTemplate.updateMany({where:{branchId:{in:q.branches.map((b:{id:string})=>b.id)}},data:{active:false}});
  },{timeout:30000});
  const record={...q};delete record.sessions;mkdirSync('docs/workforce/employees-qa/production',{recursive:true});writeFileSync('docs/workforce/employees-qa/production/cleanup.json',JSON.stringify({...record,retiredAt:new Date().toISOString(),historyRetained:true},null,2));console.log('QA retired; sessions revoked; employee and scheduling history retained.');return;
 }
 assert.equal(process.argv[2],'seed');const prefix='employees_prod_'+randomUUID().slice(0,8);
 const q=await db.$transaction(async tx=>{
  const admin=await tx.user.create({data:{username:prefix+'_admin',name:'QA Empleados Admin',role:'ADMIN',password:'!disabled'}});const user=await tx.user.create({data:{username:prefix+'_user',name:'QA Empleados Usuario',role:'OPERATOR',password:'!disabled'}});
  const branches=[];for(const name of ['Principal','Permitida'])branches.push(await tx.branch.create({data:{name:`QA Empleados ${name}`,code:prefix+'_'+name,timezone:'America/Mexico_City',geofenceEnabled:false}}));
  const template=await tx.scheduleTemplate.create({data:{name:'QA Horario empleados',branchId:branches[0].id,createdById:admin.id,shifts:{create:{branchId:branches[0].id,dayOfWeek:0,type:'TURNO',startTime:'10:00',endTime:'18:00',breakMinutes:0}}}});await tx.branch.update({where:{id:branches[0].id},data:{defaultScheduleTemplateId:template.id}});
  const sessions:Record<string,string>={};for(const[key,id]of [['admin',admin.id],['employee',user.id]]){const token=randomUUID()+randomUUID();await tx.userSession.create({data:{userId:id,tokenHash:createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+3600000)}});sessions[key]=token;}
  return{prefix,adminId:admin.id,userId:user.id,branches,employeeIds:[],sessions};
 },{timeout:30000});writeFileSync(file,JSON.stringify(q),{mode:0o600});console.log('Isolated production QA identities and branches ready. No employees or shifts created.');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
