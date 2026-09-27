import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const url=process.env.DATABASE_URL!;if(new URL(url).hostname!=='127.0.0.1'||!url.endsWith('/veliz_audit'))throw Error('LOCAL_TEST_DATABASE_REQUIRED');
const db=new PrismaClient({adapter:new PrismaPg({connectionString:url})});
async function post(path:string,body:unknown){const r=await fetch('http://127.0.0.1:3107'+path,{method:'POST',headers:{Cookie:'maestro_session=local-qa-admin','Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});return{status:r.status,data:await r.json()}}
async function open(){const id=randomUUID();const r=await post('/api/cash-cuts',{branchId:'veliz',date:'2026-09-26',startingFund:0,clientOperationId:id});assert.equal(r.status,201);return id}
async function waitForLock(){for(let i=0;i<30;i++){const r=await observer.query("SELECT COUNT(*)::int n FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%CashCut%'");if(r.rows[0].n>0)return;await new Promise(r=>setTimeout(r,50))}throw Error('Expected blocked application query not observed')}
const locker=new Client({connectionString:url});const observer=new Client({connectionString:url});await locker.connect();await observer.connect();
await db.cashCut.updateMany({where:{branchId:'veliz',status:'ABIERTO'},data:{status:'CERRADO'}});
let cut=await open();await locker.query('BEGIN');await locker.query('SELECT id FROM "CashCut" WHERE id=$1 FOR UPDATE',[cut]);
const saleId=randomUUID();const pendingSale=post('/api/pos/sales',{branchId:'veliz',clientOperationId:saleId,items:[{variantId:'qa-variant',quantity:1}],payments:[{method:'EFECTIVO',amount:30}],inventoryMode:'v2'});await waitForLock();await locker.query('UPDATE "CashCut" SET status=\'CERRADO\' WHERE id=$1',[cut]);await locker.query('COMMIT');const sale=await pendingSale;assert.equal(sale.status,409,JSON.stringify(sale));assert.equal(await db.posSale.count({where:{id:saleId}}),0);console.log('PASS Sale waiting behind close is rejected without payment or inventory');
cut=await open();await locker.query('BEGIN');await locker.query('SELECT id FROM "CashCut" WHERE id=$1 FOR UPDATE',[cut]);
const closing=post(`/api/cash-cuts/${cut}/cerrar`,{cashCounted:30,envelopeAmount:30,nextFund:0,clientOperationId:randomUUID()});await waitForLock();await locker.query('INSERT INTO "CashSalePayment" (id,"cashCutId",method,amount,"updatedAt") VALUES ($1,$2,\'EFECTIVO\',30,NOW())',[randomUUID(),cut]);await locker.query('COMMIT');const result=await closing;assert.equal(result.status,200,JSON.stringify(result));const final=await db.cashCut.findUniqueOrThrow({where:{id:cut}});assert.equal(final.totalSales,30);assert.equal(final.cashExpected,30);assert.equal(final.difference,0);console.log('PASS Close waiting behind payment rereads totals after acquiring lock');
await locker.end();await observer.end();await db.$disconnect();
