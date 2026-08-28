import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import {
  addPayrollAdjustment, approvePayrollLine, calculatePayrollLine,
  createRetroactivePayrollAdjustment, getEmployeePayrollStatements, getPayrollBoard, markPayrollPaid,
} from "../../lib/workforce/payroll/service";

const HOST = "ep-red-lake-ats4n9i7";
const P = "wfpayrollqa";
const ids = { user:`${P}_user`, employee:`${P}_employee`, employment:`${P}_employment`, period:`${P}_period`, sheet:`${P}_sheet`, overtime:`${P}_overtime` };
const start = new Date("2030-06-03T00:00:00.000Z"), end = new Date("2030-06-09T00:00:00.000Z");
const actor = { id: ids.user, role: "ADMIN" };

async function cleanup() {
  const line = await prisma.payrollLine.findUnique({ where: { timesheetId: ids.sheet } });
  if (line) {
    await prisma.workforcePayrollAdjustment.deleteMany({ where: { originalPayrollLineId: line.id } });
    await prisma.workforcePayrollLineAdjustment.deleteMany({ where: { payrollLineId: line.id } });
    await prisma.workforcePayrollRateSegment.deleteMany({ where: { payrollLineId: line.id } });
    await prisma.payrollLine.delete({ where: { id: line.id } });
  }
  await prisma.workforceOvertimeLine.deleteMany({ where: { calculationId: ids.overtime } });
  await prisma.workforceOvertimeCalculation.deleteMany({ where: { id: ids.overtime } });
  await prisma.timesheetLine.deleteMany({ where: { timesheetId: ids.sheet } });
  await prisma.timesheet.deleteMany({ where: { id: ids.sheet } });
  await prisma.payRate.deleteMany({ where: { employmentId: ids.employment } });
  await prisma.employmentJornadaPolicy.deleteMany({ where: { employmentId: ids.employment } });
  await prisma.payrollPeriod.deleteMany({ where: { id: ids.period } });
  await prisma.employment.deleteMany({ where: { id: ids.employment } });
  await prisma.employee.deleteMany({ where: { id: ids.employee } });
  await prisma.user.deleteMany({ where: { id: ids.user } });
}

async function main() {
  const url = new URL(process.env.DATABASE_URL!); assert.ok(url.hostname.startsWith(HOST)); assert.equal(url.pathname,"/neondb");
  await cleanup();
  if (process.env.WF_PAYROLL_QA_CLEANUP_ONLY === "1") return;
  const legacyBefore = await prisma.payrollEntry.count();
  const policy = await prisma.workforcePolicyVersion.findFirstOrThrow({ where: { effectiveFrom: { lte: start } }, orderBy: { effectiveFrom: "desc" } });
  await prisma.user.create({ data:{ id:ids.user,name:"WFPAYROLLQA Admin",username:"wfpayrollqa",email:"wfpayrollqa@example.invalid",password:await bcrypt.hash(process.env.WF_PAYROLL_QA_PASSWORD ?? "disabled",4),role:"ADMIN",active:true } });
  await prisma.employee.create({ data:{ id:ids.employee,userId:ids.user,employeeNumber:"WFPAYROLLQA-001",displayName:"WFPAYROLLQA Employee" } });
  await prisma.employment.create({ data:{ id:ids.employment,employeeId:ids.employee,status:"ACTIVE",startedAt:new Date("2030-01-01") } });
  await prisma.payRate.createMany({ data:[
    { id:`${P}_rate_60`,employmentId:ids.employment,rateType:"HOURLY",amount:"60",currency:"MXN",effectiveFrom:start,effectiveTo:new Date("2030-06-05T23:59:59.999Z") },
    { id:`${P}_rate_65`,employmentId:ids.employment,rateType:"HOURLY",amount:"65",currency:"MXN",effectiveFrom:new Date("2030-06-06T00:00:00.000Z") },
  ] });
  await prisma.payrollPeriod.create({ data:{ id:ids.period,weekStart:start,weekEnd:end } });
  await prisma.timesheet.create({ data:{ id:ids.sheet,employmentId:ids.employment,payrollPeriodId:ids.period,periodStart:start,periodEnd:end,status:"APPROVED",version:2,baseWorkedMinutes:3000,effectiveMinutes:3000,sourceFingerprint:`${P}:source`,approvedSourceFingerprint:`${P}:source`,approvedBaseMinutes:3000,approvedAdjustmentMinutes:0,approvedEffectiveMinutes:3000,approvedAt:new Date(),approvedById:ids.user } });
  const minuteRows = [[480,120,0],[480,120,0],[480,120,0],[480,120,0],[480,60,60],[0,0,0],[0,0,0]];
  for (let index=0;index<7;index++) await prisma.timesheetLine.create({ data:{ id:`${P}_line_${index}`,timesheetId:ids.sheet,businessDate:new Date(start.getTime()+index*86_400_000),workedMinutes:index<5?600:0,regularPayableMinutes:index<5?600:0,totalPayableMinutes:index<5?600:0,sourceFingerprint:`${P}:${index}` } });
  await prisma.workforceOvertimeCalculation.create({ data:{ id:ids.overtime,timesheetId:ids.sheet,timesheetVersion:2,timesheetApprovedAt:new Date(),approvedMinutes:3000,ordinaryMinutes:2400,doubleMinutes:540,tripleMinutes:60,weeklyDoubleLimitMinutes:540,policyVersion:policy.legalPolicyCode,workforcePolicyVersionId:policy.id,sourceFingerprint:`${P}:ot`,status:"FINAL",calculatedById:ids.user,lines:{create:minuteRows.map((row,index)=>({timesheetLineId:`${P}_line_${index}`,businessDate:new Date(start.getTime()+index*86_400_000),jornadaType:"DAY",ordinaryLimitMinutes:480,approvedMinutes:row[0]+row[1]+row[2],ordinaryMinutes:row[0],doubleMinutes:row[1],tripleMinutes:row[2],weeklyOvertimeBeforeMinutes:Math.min(index*120,540),remainingDoubleBeforeMinutes:Math.max(0,540-index*120),explanation:"WFPAYROLLQA deterministic"}))} } });
  await assert.rejects(()=>calculatePayrollLine({ ...actor,role:"OPERATOR" },ids.sheet),/No autorizado/);
  const calculated = await calculatePayrollLine(actor,ids.sheet); assert.equal(calculated.line?.status,"READY");
  await calculatePayrollLine(actor,ids.sheet); assert.equal(await prisma.payrollLine.count({where:{employmentId:ids.employment,payrollPeriodId:ids.period}}),1);
  assert.deepEqual({ordinary:calculated.line?.ordinaryPay.toFixed(2),double:calculated.line?.doublePay.toFixed(2),triple:calculated.line?.triplePay.toFixed(2),gross:calculated.line?.grossAmount.toFixed(2)}, {ordinary:"2480.00",double:"1110.00",triple:"195.00",gross:"3785.00"});
  const bonus=await prisma.workforcePayrollCategory.findFirstOrThrow({where:{name:"Bono",direction:"EARNING"}}), deduction=await prisma.workforcePayrollCategory.findFirstOrThrow({where:{name:"Anticipo / préstamo",direction:"DEDUCTION"}});
  const payrollLineId=calculated.line!.id;
  await assert.rejects(()=>addPayrollAdjustment(actor,{payrollLineId,categoryId:bonus.id,amount:"200",reason:"no",idempotencyKey:`${P}:bad-reason`}),/razón/);
  await addPayrollAdjustment(actor,{payrollLineId,categoryId:bonus.id,amount:"200",reason:"QA approved bonus",idempotencyKey:`${P}:bonus`});
  const duplicate=await addPayrollAdjustment(actor,{payrollLineId,categoryId:bonus.id,amount:"200",reason:"QA approved bonus",idempotencyKey:`${P}:bonus`}); assert.equal(duplicate.idempotent,true);
  await addPayrollAdjustment(actor,{payrollLineId,categoryId:deduction.id,amount:"100",reason:"QA authorized deduction",idempotencyKey:`${P}:deduction`});
  const ready=await prisma.payrollLine.findUniqueOrThrow({where:{id:payrollLineId}}); assert.equal(ready.operationalPayable.toFixed(2),"3885.00");
  if (process.env.WF_PAYROLL_QA_STAGE === "READY") {
    console.log(JSON.stringify({environment:"verified DEV",stage:"READY",week:"2030-06-03",payable:"3885.00"}));
    return;
  }
  await assert.rejects(()=>approvePayrollLine(actor,{payrollLineId,expectedVersion:ready.version-1,idempotencyKey:`${P}:stale`}),/STALE_VERSION/);
  const [approvedOne,approvedTwo]=await Promise.all([approvePayrollLine(actor,{payrollLineId,expectedVersion:ready.version,idempotencyKey:`${P}:approve`}),approvePayrollLine(actor,{payrollLineId,expectedVersion:ready.version,idempotencyKey:`${P}:approve`})]);
  assert.equal(Number(approvedOne.idempotent)+Number(approvedTwo.idempotent),1);
  const frozen=await prisma.payrollLine.findUniqueOrThrow({where:{id:payrollLineId}}); assert.equal(frozen.status,"APPROVED"); assert.equal((await prisma.timesheet.findUniqueOrThrow({where:{id:ids.sheet}})).status,"LOCKED");
  await prisma.timesheet.update({where:{id:ids.sheet},data:{requiresAdjustment:true}});
  const flaggedBoard=await getPayrollBoard(start); assert.ok(flaggedBoard.rows[0].facts.blockers.includes("RETROACTIVE_REVIEW_REQUIRED"));
  const retro=await createRetroactivePayrollAdjustment(actor,{originalPayrollLineId:payrollLineId,appliedPayrollPeriodId:ids.period,amount:"25",minutes:15,reason:"QA legitimate post-approval correction",idempotencyKey:`${P}:retro`}); assert.equal(retro.adjustment.status,"PENDING");
  assert.equal((await prisma.payrollLine.findUniqueOrThrow({where:{id:payrollLineId}})).operationalPayable.toFixed(2),"3885.00");
  const paid=await markPayrollPaid(actor,{payrollLineId,expectedVersion:frozen.version,idempotencyKey:`${P}:paid`,reference:"QA-REF"}); assert.equal(paid.line.status,"PAID");
  const paidAgain=await markPayrollPaid(actor,{payrollLineId,expectedVersion:frozen.version,idempotencyKey:`${P}:paid`,reference:"QA-REF"}); assert.equal(paidAgain.idempotent,true);
  await assert.rejects(()=>addPayrollAdjustment(actor,{payrollLineId,categoryId:bonus.id,amount:"1",reason:"QA forbidden paid edit",idempotencyKey:`${P}:paid-edit`}),/congelado/);
  assert.equal((await getEmployeePayrollStatements(ids.user)).length,1);
  assert.equal(await prisma.payrollEntry.count(),legacyBefore);
  console.log(JSON.stringify({environment:"verified DEV",midweekRates:true,ordinaryPay:"2480.00",doublePay:"1110.00",triplePay:"195.00",earnings:"200.00",deductions:"100.00",payable:"3885.00",approvalIdempotent:true,timesheetLocked:true,frozenAfterRetro:true,paid:true,employeeOwnStatement:true,legacyWrites:0}));
  if(process.env.WF_PAYROLL_QA_KEEP!=="1") await cleanup();
}
main().catch(async(error)=>{console.error(error);try{await cleanup();}catch{}process.exitCode=1;}).finally(()=>prisma.$disconnect());
