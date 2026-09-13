import 'server-only';
import {prisma} from '@/lib/prisma';
import {appendAuditEvent} from './audit';
import {readPos2RolloutConfig,isPos2ContextEnabled} from './certification/rollout';
// Pilot-only telemetry consumer. Financial effects already committed with the event.
export async function dispatchServerOutbox(branchId:string,limit=20){
 const rollout=readPos2RolloutConfig();const pos2Enabled=rollout.mode==='PILOT'&&isPos2ContextEnabled(rollout,branchId);const legacyPending=pos2Enabled?false:Boolean((await prisma.$queryRaw<Array<{exists:boolean}>>`SELECT EXISTS(SELECT 1 FROM "OutboxEvent" WHERE "status" IN ('PENDING','FAILED') AND "availableAt"<=NOW() AND "topic"='pos.sale.completed' AND "payload"->>'branchId'=${branchId}) AS "exists"`)[0]?.exists);if(!pos2Enabled&&!legacyPending)return {processed:0,...await serverOutboxStatus(branchId)};
 let processed=0;
 for(let i=0;i<Math.min(limit,20);i++){
 let claimedId:string|undefined;
 let didProcess:boolean;
 try{didProcess=await prisma.$transaction(async tx=>{
 const rows=await tx.$queryRaw<Array<{id:string}>>`SELECT e."id" FROM "OutboxEvent" e WHERE e."status" IN ('PENDING','FAILED') AND e."availableAt"<=NOW() AND ((e."payload"->>'branchId'=${branchId} AND (e."topic"='pos.sale.completed' OR ${pos2Enabled})) OR (${pos2Enabled} AND (EXISTS(SELECT 1 FROM "Pos2Sale" s WHERE s."id"=e."aggregateId" AND s."branchId"=${branchId}) OR EXISTS(SELECT 1 FROM "CashSession" c WHERE c."id"=e."aggregateId" AND c."branchId"=${branchId})))) ORDER BY e."createdAt" FOR UPDATE OF e SKIP LOCKED LIMIT 1`;
 if(!rows.length)return false;
 claimedId=rows[0].id;
 const event=await tx.outboxEvent.update({where:{id:rows[0].id},data:{status:'PROCESSING',attempts:{increment:1},lastError:null}});
 await appendAuditEvent(tx,{branchId,action:'POS2_OUTBOX_TELEMETRY_DELIVERED',entityType:'OutboxEvent',entityId:event.id,operationId:event.operationId??undefined,metadata:{consumer:'pos2-operational-telemetry-v1',topic:event.topic,aggregate:event.aggregate,aggregateId:event.aggregateId,payload:event.payload}});
 await tx.outboxEvent.update({where:{id:event.id},data:{status:'PROCESSED',processedAt:new Date()}});
 return true;
 });}catch(error){if(claimedId)await prisma.outboxEvent.updateMany({where:{id:claimedId,status:{in:['PENDING','FAILED']}},data:{status:'FAILED',attempts:{increment:1},lastError:'Telemetry delivery failed',availableAt:new Date(Date.now()+30000)}});throw error;}if(!didProcess)break;processed++;
 }
 return {processed,...await serverOutboxStatus(branchId)};
}
export async function serverOutboxStatus(branchId:string){
 const rows=await prisma.$queryRaw<Array<{status:string;count:bigint}>>`SELECT e."status",COUNT(*) AS count FROM "OutboxEvent" e WHERE (e."payload"->>'branchId'=${branchId} OR EXISTS(SELECT 1 FROM "Pos2Sale" s WHERE s."id"=e."aggregateId" AND s."branchId"=${branchId}) OR EXISTS(SELECT 1 FROM "CashSession" c WHERE c."id"=e."aggregateId" AND c."branchId"=${branchId})) GROUP BY e."status"`;
 return {pending:Number(rows.find(r=>r.status==='PENDING')?.count??0),failed:Number(rows.find(r=>r.status==='FAILED')?.count??0),processing:Number(rows.find(r=>r.status==='PROCESSING')?.count??0)};
}
