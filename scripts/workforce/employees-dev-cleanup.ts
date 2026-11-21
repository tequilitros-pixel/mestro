import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {PrismaClient} from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
const url=new URL(process.env.MIGRATION_DATABASE_URL!);assert.equal(url.hostname,'ep-red-lake-ats4n9i7.c-9.us-east-1.aws.neon.tech');
const db=new PrismaClient({adapter:new PrismaPg({connectionString:url.href})});
async function main(){const q=JSON.parse(readFileSync('/tmp/maestro-employees-qa.json','utf8'));assert.match(q.prefix,/^employees_[a-f0-9]{8}$/);
const history=await db.$transaction(async tx=>{
 const users=await tx.user.findMany({where:{id:{in:[q.adminId,q.userId]}}});assert.ok(users.length===2&&users.every(u=>u.username.startsWith(q.prefix)));
 const employees=await tx.employee.findMany({where:{id:{in:q.employeeIds}},include:{employments:{include:{_count:{select:{shifts:true,payRates:true,branchAssignments:true,jornadaPolicies:true}}}}}});assert.ok(employees.every(e=>e.displayName?.startsWith('QA ')));
 await tx.userSession.deleteMany({where:{userId:{in:[q.adminId,q.userId]}}});await tx.user.updateMany({where:{id:{in:[q.adminId,q.userId]}},data:{active:false}});await tx.employee.updateMany({where:{id:{in:q.employeeIds}},data:{active:false}});await tx.employment.updateMany({where:{employeeId:{in:q.employeeIds},status:{not:'TERMINATED'}},data:{status:'INACTIVE'}});await tx.branch.updateMany({where:{id:{in:q.branches.map((b:{id:string})=>b.id)}},data:{active:false,defaultScheduleTemplateId:null}});await tx.scheduleTemplate.updateMany({where:{branchId:{in:q.branches.map((b:{id:string})=>b.id)}},data:{active:false}});
 return employees.map(e=>({id:e.id,employments:e.employments.map(job=>({id:job.id,status:job.status,endedAt:job.endedAt,terminationReason:job.terminationReason,retained:job._count}))}));
},{timeout:30000});writeFileSync('docs/workforce/employees-qa/dev-cleanup.json',JSON.stringify({retiredAt:new Date().toISOString(),history},null,2));console.log('DEV QA retired, sessions revoked and historical records preserved.');}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
