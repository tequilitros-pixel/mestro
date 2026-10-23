import { generateClientOperationId } from "./canonical";
import { POS2_OFFLINE_SCHEMA_VERSION, type Pos2LocalDraft } from "./types";
export function cloneLocalOrderToNewOrder(source:Pos2LocalDraft,actorId:string){const now=new Date().toISOString();return{...source,schemaVersion:POS2_OFFLINE_SCHEMA_VERSION,localDraftId:generateClientOperationId(),serverOrderId:null,serverVersion:null,localRevision:0,actorId,state:"DRAFT" as const,lines:source.lines.map(line=>({...line,localLineId:generateClientOperationId()})),createdAt:now,updatedAt:now};}
