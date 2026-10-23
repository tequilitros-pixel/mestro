import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const base='http://127.0.0.1:3107';
const url=process.env.DATABASE_URL!;
if(new URL(url).hostname!=='127.0.0.1'||!url.endsWith('/veliz_audit')) throw Error('LOCAL_TEST_DATABASE_REQUIRED');
const db=new PrismaClient({adapter:new PrismaPg({connectionString:url})});
const results:string[]=[];
async function request(path:string,body?:unknown,user='qa-admin'){
 const response=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(user?{Cookie:`maestro_session=local-${user}`}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});
 const text=await response.text();let data;try{data=JSON.parse(text)}catch{throw Error(path+' HTTP '+response.status+' '+text.slice(0,400))};return{status:response.status,data};
}
function pass(label:string){results.push(label);console.log('PASS '+label)}
const historical=await db.cashCut.findUniqueOrThrow({where:{id:'veliz-historical'}});
assert.equal((await request('/api/cash-cuts',undefined,'')).status,401);pass('API without session denied');
assert.equal((await request('/api/cash-cuts?branchId=veliz',undefined,'qa-other')).status,403);pass('Other branch denied');
const cutId=randomUUID();
let r=await request('/api/cash-cuts',{branchId:'veliz',date:'2026-09-26',startingFund:563,clientOperationId:cutId});assert.equal(r.status,201,JSON.stringify(r));pass('Open cut');
r=await request('/api/cash-cuts',{branchId:'veliz',date:'2026-09-26',startingFund:563,clientOperationId:cutId});assert.equal(r.data.id,cutId);assert.equal(await db.cashCut.count({where:{id:cutId}}),1);pass('Opening replay creates one cut');
const saleId=randomUUID();const body={branchId:'veliz',items:[{variantId:'qa-variant',quantity:1}],payments:[{method:'EFECTIVO',amount:30}],inventoryMode:'v2',clientOperationId:saleId};
const sold=await Promise.all([request('/api/pos/sales',body),request('/api/pos/sales',body)]);assert.ok(sold.every(x=>[200,201].includes(x.status)),JSON.stringify(sold));assert.equal(await db.posSale.count({where:{id:saleId}}),1);assert.equal((await db.inventoryBalance.findFirstOrThrow({where:{branchId:'veliz'}})).quantity.toNumber(),9000);assert.equal((await db.cashSalePayment.findFirstOrThrow({where:{cashCutId:cutId}})).amount,30);pass('Concurrent sale replay charges and consumes once');
r=await request('/api/pos/sales',{...body,items:[{variantId:'qa-variant',quantity:2}],payments:[{method:'EFECTIVO',amount:60}]});assert.equal(r.status,409);pass('Same operation with changed amount rejected');
r=await request('/api/pos/sales/'+saleId+'/cancel',{reason:'QA local',clientOperationId:randomUUID()},'qa-other');assert.equal(r.status,404);pass('Cancellation from other branch denied');
const cancelled=await Promise.all([request('/api/pos/sales/'+saleId+'/cancel',{reason:'QA local'}),request('/api/pos/sales/'+saleId+'/cancel',{reason:'QA local'})]);assert.ok(cancelled.every(x=>x.status===200),JSON.stringify(cancelled));assert.equal((await db.inventoryBalance.findFirstOrThrow({where:{branchId:'veliz'}})).quantity.toNumber(),10000);assert.equal((await db.cashSalePayment.findFirstOrThrow({where:{cashCutId:cutId}})).amount,0);assert.equal(await db.inventoryMovement.count({where:{sourceId:saleId,movementType:'SALE_REVERSAL'}}),1);pass('Concurrent cancellation returns stock and cash once');
const hugeId=randomUUID();r=await request('/api/pos/sales',{...body,clientOperationId:hugeId,items:[{variantId:'qa-variant',quantity:20}],payments:[{method:'EFECTIVO',amount:600}]});assert.equal(r.status,409);assert.equal(await db.posSale.count({where:{id:hugeId}}),0);pass('Insufficient stock rolls back sale and payment');
const finalId=randomUUID();r=await request('/api/pos/sales',{...body,clientOperationId:finalId});assert.equal(r.status,201,JSON.stringify(r));
r=await request(`/api/cash-cuts/${cutId}/entradas`,{type:'CAMBIO_RECIBIDO',categoryId:'qa-income',amount:20,clientOperationId:randomUUID()});assert.equal(r.status,201,JSON.stringify(r));
r=await request(`/api/cash-cuts/${cutId}/salidas`,{concept:'QA local',category:'OTRO',categoryId:'qa-expense',amount:10,clientOperationId:randomUUID()});assert.equal(r.status,201,JSON.stringify(r));pass('Income and expense registered atomically');
const closing={cashCounted:603,envelopeAmount:40,nextFund:563,clientOperationId:randomUUID()};
const closed=await Promise.all([request(`/api/cash-cuts/${cutId}/cerrar`,closing),request(`/api/cash-cuts/${cutId}/cerrar`,closing)]);assert.ok(closed.every(x=>x.status===200),JSON.stringify(closed));
const cut=await db.cashCut.findUniqueOrThrow({where:{id:cutId}});assert.equal(cut.cashExpected,603);assert.equal(cut.difference,0);assert.equal(cut.totalSales,30);assert.equal(cut.totalInflows,20);assert.equal(cut.totalOutflows,10);
const envelopes=await db.cashSafeEnvelope.findMany({where:{cashCutId:cutId},include:{movements:true}});assert.equal(envelopes.length,1);assert.equal(envelopes[0].status,'EN_CAJA_FUERTE');assert.equal(envelopes[0].currentBalance,40);assert.equal(envelopes[0].movements.filter(m=>m.type==='RECEPCION').length,1);pass('Concurrent close: balanced cut, one automatically received envelope');
r=await request('/api/cash-cuts/dashboard?branchId=veliz',undefined,'qa-manager');assert.equal(r.status,200);assert.equal(r.data.totalSafeBalance,40);assert.equal(r.data.safeBalances.length,1);pass('Dashboard includes envelope and respects selected branch for multi-branch manager');
r=await request('/api/pos/sales',{...body,clientOperationId:randomUUID()});assert.equal(r.status,400);pass('Sale with closed cut blocked');
r=await request(`/api/cash-cuts/${cutId}/entradas`,{type:'CAMBIO_RECIBIDO',categoryId:'qa-income',amount:20});assert.equal(r.status,403);pass('Movement with closed cut blocked');
assert.deepEqual(await db.cashCut.findUniqueOrThrow({where:{id:'veliz-historical'}}),historical);pass('Historical cut preserved');
console.log(JSON.stringify({passed:results.length,results},null,2));await db.$disconnect();
