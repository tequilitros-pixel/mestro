import {getCurrentCommandActor} from '@/lib/pos2/currentActor';
import {requireActorBranch} from '@/lib/pos2/cash/guards';
import {requireCapability} from '@/lib/pos2/authorization';
import {prisma} from '@/lib/prisma';
import {dispatchServerOutbox} from '@/lib/pos2/serverOutbox';
import {pos2ErrorResponse} from '@/lib/pos2/http';
import {recordPos2OperationTrace, type Pos2OperationTrace} from '@/lib/pos2/operationTrace';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:Request){let actor:Awaited<ReturnType<typeof getCurrentCommandActor>>|undefined;let branchId:string|undefined;let trace:Pos2OperationTrace|undefined;try{actor=await getCurrentCommandActor();const body=await request.json();branchId=typeof body.branchId==='string'?body.branchId:undefined;trace={actor,branchId,operation:'OutboxSync',correlationId:request.headers.get('x-request-id')??request.headers.get('x-vercel-id')??undefined};await recordPos2OperationTrace({...trace,outcome:'ATTEMPTED'});if(!branchId)return new Response(null,{status:400});requireActorBranch(actor,branchId);await prisma.$transaction(tx=>requireCapability(tx,actor!,'catalog.view',branchId!));const result=await dispatchServerOutbox(branchId);await recordPos2OperationTrace({...trace,outcome:'SUCCESS'});return Response.json(result,{headers:{'Cache-Control':'no-store'}});}catch(e){if(actor&&trace)await recordPos2OperationTrace({...trace,outcome:'FAIL',error:e});return pos2ErrorResponse(e)}}
