import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { prisma } from '../lib/prisma';
import { withDatabaseActor } from '../lib/database-context';
import { executeIdempotent } from '../lib/pos2/idempotency';
import { generateOperationId } from '../lib/pos2/operationId';
import { reconcileWeeklyCountCutover } from '../lib/inventory/weeklyCountCutover';
import { recordManualInventoryMovement } from '../lib/inventory/manualMovements';
import { applyEventInventoryMovement } from '../lib/inventory/eventMovements';
import { transferInventory } from '../lib/pos2/inventory/transfer';
for(const url of [process.env.DATABASE_URL!,process.env.OWNER_DATABASE_URL!])if(new URL(url).hostname!=='127.0.0.1'||!url.endsWith('/veliz_audit'))throw Error('LOCAL_TEST_DATABASE_REQUIRED');
const owner=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.OWNER_DATABASE_URL!})});
const actor={id:'qa-admin',role:'ADMIN' as const,branchIds:null};
const run=<T,>(fn:()=>Promise<T>)=>withDatabaseActor(actor,fn);
const prefix='qa-count-'+Date.now();
const p=await owner.inventoryProduct.create({data:{id:prefix,code:prefix,name:'LOCAL count QA',category:'TEST',unit:'Pza',itemType:'CONSUMABLE',trackStock:true,inventoryBaseUnit:'UNIT'}});
const balance=async(productId=p.id,branchId='veliz')=>(await owner.inventoryBalance.findUniqueOrThrow({where:{branchId_inventoryProductId:{branchId,inventoryProductId:productId}}})).quantity.toNumber();
const close=(countId:string,operationId=generateOperationId(),failAfterProductId?:string)=>run(()=>executeIdempotent({operationId,command:'CloseInventoryCountV2',payload:{countId,failAfterProductId},receiptContext:{actorId:actor.id,branchId:'veliz'},execute:tx=>reconcileWeeklyCountCutover(tx,{countId,actorId:actor.id,operationId,failAfterProductId})}));
const count=async(tag:string,quantityCounted:number|null,countedAt:Date|null)=>owner.inventoryCount.create({data:{code:prefix+tag,branchId:'veliz',countDate:new Date(),items:{create:{productId:p.id,quantityCounted,countedAt}}}});
const pending=await count('pending',null,null);await assert.rejects(close(pending.id),/COUNT_ITEMS_PENDING/);assert.equal(await owner.inventoryBalance.count({where:{inventoryProductId:p.id}}),0);console.log('PASS Pending null count cannot initialize stock');
const unconfirmed=await count('unconfirmed',0,null);await assert.rejects(close(unconfirmed.id),/COUNT_ITEMS_PENDING/);console.log('PASS Zero without count confirmation remains pending');
const zero=await count('zero',0,new Date());const op=generateOperationId();await close(zero.id,op);assert.equal(await balance(),0);assert.equal(await owner.inventoryCountDeclaration.count({where:{countId:zero.id}}),1);console.log('PASS Explicit confirmed zero is authoritative and auditable');
assert.equal((await close(zero.id,op)).replayed,true);await assert.rejects(close(zero.id),/COUNT_ALREADY_CLOSED/);assert.equal(await owner.inventoryCountDeclaration.count({where:{countId:zero.id}}),1);console.log('PASS Count replay preserves one declaration and closed count cannot reopen');
const rollback=await count('rollback',12,new Date());await assert.rejects(close(rollback.id,generateOperationId(),p.id),/TEST_FAILURE/);assert.equal(await balance(),0);assert.equal((await owner.inventoryCount.findUniqueOrThrow({where:{id:rollback.id}})).status,'BORRADOR');assert.equal(await owner.inventoryCountDeclaration.count({where:{countId:rollback.id}}),0);console.log('PASS Failed count rolls back balance declaration and state');
const race=await count('race',10,new Date());const closes=await Promise.allSettled([close(race.id),close(race.id)]);assert.equal(closes.filter(x=>x.status==='fulfilled').length,1);assert.equal(await balance(),10);console.log('PASS Concurrent closures produce one correction');
await owner.inventoryBalance.create({data:{branchId:'other',inventoryProductId:p.id,quantity:0,unit:'UNIT'}});
const cap=await owner.capability.upsert({where:{key:'inventory.transfer'},create:{key:'inventory.transfer',description:'LOCAL QA'},update:{}});if(!await owner.capabilityGrant.findFirst({where:{capabilityId:cap.id,role:'ADMIN',scope:'GLOBAL'}}))await owner.capabilityGrant.create({data:{capabilityId:cap.id,role:'ADMIN',scope:'GLOBAL'}});
const transferId=generateOperationId();const transfer=()=>run(()=>transferInventory({fromBranchId:'veliz',toBranchId:'other',inventoryProductId:p.id,quantity:'3',unit:'UNIT',reason:'LOCAL QA',actor,operationId:transferId}));await Promise.all([transfer(),transfer()]);assert.equal(await balance(),7);assert.equal(await balance(p.id,'other'),3);console.log('PASS POS2 advisory transfer executes and replays one ledger pair');
for(const [tag,unit,base,factor,extra] of [ ['kg','KG','G',1000,{}],['liters','L','ML',1000,{}],['bag','BOLSA','G',5000,{handlingUnit:'BOLSA',contentPerUnit:5,contentUnit:'KG'}] ] as const){
 const product=await owner.inventoryProduct.create({data:{id:prefix+tag,code:prefix+tag,name:'LOCAL '+tag,category:'TEST',unit,itemType:'CONSUMABLE',trackStock:true,inventoryBaseUnit:base,...extra}});
 await owner.inventoryBalance.create({data:{branchId:'veliz',inventoryProductId:product.id,quantity:0,unit:base}});
 await run(()=>recordManualInventoryMovement({actorId:actor.id,operationId:generateOperationId(),productId:product.id,branchId:'veliz',type:'COMPRA',quantity:2,notes:'LOCAL QA'}));assert.equal(await balance(product.id),2*factor);console.log('PASS Capture '+unit+' converts to '+base+' without guessed stock');
 if(tag==='bag'){
  const event=await owner.serviceEvent.create({data:{code:prefix+'remnant',clientName:'LOCAL',location:'LOCAL',eventDate:new Date(),guestCount:1}});
  const item=await owner.serviceEventItem.create({data:{eventId:event.id,productId:product.id,productName:product.name,unit,handlingUnit:'BOLSA',contentPerUnit:5,contentUnit:'KG',itemType:'CONSUMABLE',plannedQuantity:1,sentQuantity:1,returnedQuantity:0,returnedOpenQuantity:1000}});
  await run(()=>prisma.$transaction(tx=>applyEventInventoryMovement(tx,{item,branchId:'veliz',actorId:actor.id,operationId:generateOperationId(),eventId:event.id,returning:true})));assert.equal(await balance(product.id),11000);const entry=await owner.inventoryEntry.findFirstOrThrow({where:{productId:product.id,type:'REGRESO_EVENTO'}});assert.equal(entry.quantity.toNumber(),0.2);console.log('PASS Open remnant credits base grams and retains fractional legacy presentation');
 }
}
const legacy=await owner.inventoryProduct.create({data:{id:prefix+'legacy',code:prefix+'legacy',name:'LOCAL legacy',category:'TEST',unit:'Pza',itemType:'CONSUMABLE',trackStock:true,inventoryBaseUnit:'UNIT'}});
const event=await owner.serviceEvent.create({data:{code:prefix+'legacy-event',clientName:'LOCAL',location:'LOCAL',eventDate:new Date(),guestCount:1}});
const item=await owner.serviceEventItem.create({data:{eventId:event.id,productId:legacy.id,productName:legacy.name,unit:'Pza',itemType:'CONSUMABLE',plannedQuantity:2,sentQuantity:2}});
await assert.rejects(run(()=>prisma.$transaction(tx=>applyEventInventoryMovement(tx,{item,branchId:'veliz',actorId:actor.id,operationId:generateOperationId(),eventId:event.id,returning:false}))),/Existencia insuficiente/);assert.equal(await owner.inventoryEntry.count({where:{productId:legacy.id}}),0);console.log('PASS Legacy event over-stock load rolls back without inventing a balance');
await run(()=>recordManualInventoryMovement({actorId:actor.id,operationId:generateOperationId(),productId:legacy.id,branchId:'veliz',type:'COMPRA',quantity:3,notes:'LOCAL QA'}));await run(()=>prisma.$transaction(tx=>applyEventInventoryMovement(tx,{item,branchId:'veliz',actorId:actor.id,operationId:generateOperationId(),eventId:event.id,returning:false})));assert.equal((await owner.inventoryEntry.aggregate({where:{productId:legacy.id},_sum:{quantity:true}}))._sum.quantity?.toNumber(),1);assert.equal(await owner.inventoryBalance.count({where:{inventoryProductId:legacy.id}}),0);console.log('PASS Legacy purchase and event retain existing ledger without fabricated cutover');
await owner.$disconnect();await prisma.$disconnect();
