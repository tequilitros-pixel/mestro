import { generateClientOperationId, normalizeMoney, normalizeQuantity } from "./canonical";
import { enqueuePos2Command, listCommands, saveDraft } from "./store";
import type { Pos2LocalDraft, Pos2LocalLine } from "./types";
const touch=(draft:Pos2LocalDraft,lines:Pos2LocalLine[]):Pos2LocalDraft=>({...draft,lines,localRevision:draft.localRevision+1,state:"SYNC_PENDING",updatedAt:new Date().toISOString(),estimatesOnly:true});
export function addLocalLine(draft:Pos2LocalDraft,input:Omit<Pos2LocalLine,"localLineId"|"quantity"|"estimatedUnitPrice">&{quantity:string|number;estimatedUnitPrice:string|number|null}){if(draft.state==="READY_TO_COMPLETE")throw new Error("DRAFT_FROZEN");const line:Pos2LocalLine={...input,localLineId:generateClientOperationId(),quantity:normalizeQuantity(input.quantity,input.unit),estimatedUnitPrice:input.estimatedUnitPrice===null?null:normalizeMoney(input.estimatedUnitPrice)};return touch(draft,[...draft.lines,line]);}
export function updateLocalLineQuantity(draft:Pos2LocalDraft,localLineId:string,quantity:string|number){const line=draft.lines.find(item=>item.localLineId===localLineId);if(!line)throw new Error("LOCAL_LINE_NOT_FOUND");return touch(draft,draft.lines.map(item=>item.localLineId===localLineId?{...item,quantity:normalizeQuantity(quantity,item.unit)}:item));}
export function removeLocalLine(draft:Pos2LocalDraft,localLineId:string){return touch(draft,draft.lines.filter(item=>item.localLineId!==localLineId));}
export function localEstimatedTotal(draft:Pos2LocalDraft){return draft.lines.reduce((sum,line)=>sum+(line.estimatedUnitPrice===null?0:Number(line.estimatedUnitPrice)*Number(line.quantity)),0).toFixed(2);}

export async function queueLocalDraft(draft:Pos2LocalDraft){
  const existing=(await listCommands()).filter(item=>item.localDraftId===draft.localDraftId);
  if(existing.length)return existing;
  const create=await enqueuePos2Command({commandType:"CreateOrder",localDraftId:draft.localDraftId,actorId:draft.actorId,terminalId:draft.terminalId,branchId:draft.branchId,payload:{registerId:draft.registerId,cashSessionId:draft.cashSessionId}});
  const commands=[create];let dependency=create.operationId;
  for(const line of draft.lines){const command=await enqueuePos2Command({commandType:"AddOrderLine",localDraftId:draft.localDraftId,actorId:draft.actorId,terminalId:draft.terminalId,branchId:draft.branchId,dependsOn:[dependency],payload:{quantity:line.quantity,...(line.variantId?{variantId:line.variantId}:{productId:line.productId})}});commands.push(command);dependency=command.operationId;}
  await saveDraft({...draft,state:"SYNC_PENDING",updatedAt:new Date().toISOString()});
  return commands;
}
