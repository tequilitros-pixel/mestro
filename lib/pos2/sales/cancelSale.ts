import "server-only";
import { Prisma, type SaleCancellationReasonCode } from "@prisma/client";
import { DomainError } from "@/lib/domain/errors";
import { Money } from "@/lib/domain/money";
import { executeIdempotent } from "@/lib/pos2/idempotency";
import { requireCapability, type CommandActor } from "@/lib/pos2/authorization";
import { requireActorBranch, requireActiveTerminal } from "@/lib/pos2/cash/guards";
import { applyInventoryBatchInTransaction } from "@/lib/pos2/inventory/applyMovements";
import { groupInventoryDeltas } from "@/lib/pos2/inventory/domain";
import { appendAuditEvent } from "@/lib/pos2/audit";
import { appendOutboxEvent } from "@/lib/pos2/outbox";
import { lockSale, requireCompensationSession } from "./compensationGuards";

type Fault="AFTER_DOCUMENT"|"AFTER_FIRST_INVENTORY"|"AFTER_CASH";
export async function cancelSale(input:{saleId:string;reasonCode:SaleCancellationReasonCode;reasonText?:string;cashSessionId?:string;paymentReferences?:Record<string,string>;terminalId:string;actor:CommandActor;operationId:string;faultInjectionForTest?:Fault}){
 const payload={saleId:input.saleId,reasonCode:input.reasonCode,reasonText:input.reasonText?.trim()||null,cashSessionId:input.cashSessionId??null,paymentReferences:input.paymentReferences??{}};
 return executeIdempotent({operationId:input.operationId,command:"CancelSale",payload,receiptContext:{actorId:input.actor.id},execute:async tx=>{
  const sale=await lockSale(tx,input.saleId);requireActorBranch(input.actor,sale.branchId);await requireCapability(tx,input.actor,"pos.sale.cancel",sale.branchId);await requireActiveTerminal(tx,{terminalId:input.terminalId,branchId:sale.branchId});
  if(sale.status==="CANCELLED"||sale.cancellation)throw new DomainError("SALE_ALREADY_CANCELLED",{saleId:sale.id});
  if(sale.status!=="COMPLETED"||sale.returns.length||sale.refunds.length)throw new DomainError("INVALID_STATE_TRANSITION",{saleId:sale.id,status:sale.status,reason:"compensations_exist"});
  const cashTotal=sale.payments.filter(p=>p.method==="CASH").reduce((sum,p)=>sum.add(Money.from(p.amount)),Money.zero());
  const session=cashTotal.equals(Money.zero())?null:await requireCompensationSession(tx,{sale,cashSessionId:input.cashSessionId,terminalId:input.terminalId});
  const cancellation=await tx.saleCancellation.create({data:{saleId:sale.id,reasonCode:input.reasonCode,reasonText:input.reasonText?.trim()||null,actorId:input.actor.id,terminalId:input.terminalId,cashSessionId:session?.id??null,operationId:input.operationId}});
  if(input.faultInjectionForTest==="AFTER_DOCUMENT"&&process.env.NODE_ENV!=="production")throw new Error("TEST_CANCEL_AFTER_DOCUMENT");
  for(const payment of sale.payments)await tx.paymentReversal.create({data:{cancellationId:cancellation.id,paymentId:payment.id,method:payment.method,amount:payment.amount,currency:payment.currency,reference:input.paymentReferences?.[payment.id]?.trim()||null}});
  const original=await tx.inventoryMovement.findMany({where:{sourceType:"SALE",sourceId:sale.id,movementType:"SALE_CONSUMPTION"}});
  const movements=original.length?groupInventoryDeltas(original.map(m=>({inventoryProductId:m.inventoryProductId,quantityDelta:m.quantityDelta.negated().toString(),unit:m.unit,movementType:"SALE_REVERSAL" as const,sourceType:"CANCELLATION" as const,sourceId:cancellation.id,sourceLineId:m.sourceLineId??undefined,reasonCode:"SALE_CANCELLED",metadata:{originalMovementId:m.id}}))):[];
  if(movements.length)await applyInventoryBatchInTransaction(tx,{branchId:sale.branchId,movements,actorId:input.actor.id,operationId:input.operationId,failAfterFirstMovementForTest:input.faultInjectionForTest==="AFTER_FIRST_INVENTORY"});
  if(session)await tx.cashMovement.create({data:{cashSessionId:session.id,branchId:sale.branchId,registerId:session.registerId,type:"SALE_CANCEL_REVERSAL",direction:"OUT",amount:cashTotal.toDecimal(),sourceType:"SALE_CANCELLATION",sourceId:cancellation.id,actorId:input.actor.id,operationId:input.operationId,metadata:{saleId:sale.id,originalCashSessionId:sale.cashSessionId}}});
  if(input.faultInjectionForTest==="AFTER_CASH"&&process.env.NODE_ENV!=="production")throw new Error("TEST_CANCEL_AFTER_CASH");
  await tx.pos2Sale.update({where:{id:sale.id},data:{status:"CANCELLED"}});
  await appendAuditEvent(tx,{actorId:input.actor.id,branchId:sale.branchId,terminalId:input.terminalId,action:"SALE_CANCELLED",entityType:"SaleCancellation",entityId:cancellation.id,operationId:input.operationId,metadata:{saleId:sale.id,cashAmount:cashTotal.toString(),inventoryMovements:movements.length}});
  await appendOutboxEvent(tx,{topic:"SALE_CANCELLED",aggregate:"Pos2Sale",aggregateId:sale.id,operationId:input.operationId,payload:{saleId:sale.id,cancellationId:cancellation.id}});
  return {type:"SaleCancellation",id:cancellation.id,saleId:sale.id,status:"CANCELLED",cashCompensated:cashTotal.toString(),inventoryMovements:movements.length} as Prisma.InputJsonObject;
 }});
}
