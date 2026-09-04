import "server-only";
import { Prisma } from "@prisma/client";
import { DomainError } from "@/lib/domain/errors";
import { lockCashSession, requireActiveTerminal } from "@/lib/pos2/cash/guards";
import { requirePos2ContextEnabled } from "@/lib/pos2/certification/rollout";

export async function lockSale(tx: Prisma.TransactionClient, saleId: string) {
  const rows=await tx.$queryRaw<Array<{id:string}>>`SELECT "id" FROM "Pos2Sale" WHERE "id"=${saleId} FOR UPDATE`;
  if(!rows[0])throw new DomainError("VALIDATION_ERROR",{field:"saleId"});
  const sale=await tx.pos2Sale.findUniqueOrThrow({where:{id:saleId},include:{lines:true,payments:true,cancellation:true,returns:{include:{lines:true}},refunds:{include:{allocations:true}}}});
  requirePos2ContextEnabled(sale.branchId,sale.registerId);
  return sale;
}

export async function requireCompensationSession(tx:Prisma.TransactionClient,input:{sale:{branchId:string;cashSessionId:string};cashSessionId?:string;terminalId:string}){
  if(!input.cashSessionId)throw new DomainError("CASH_SESSION_NOT_OPEN",{field:"cashSessionId"});
  await requireActiveTerminal(tx,{terminalId:input.terminalId,branchId:input.sale.branchId});
  const original=await tx.cashSession.findUniqueOrThrow({where:{id:input.sale.cashSessionId},select:{status:true}});
  if(original.status==="OPEN"&&input.cashSessionId!==input.sale.cashSessionId)throw new DomainError("CASH_SESSION_NOT_OPEN",{reason:"original_session_still_open"});
  const session=await lockCashSession(tx,input.cashSessionId);
  if(session.status!=="OPEN"||session.branchId!==input.sale.branchId)throw new DomainError("CASH_SESSION_NOT_OPEN",{cashSessionId:session.id});
  return session;
}
