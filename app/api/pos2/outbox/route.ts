import {getCurrentCommandActor} from '@/lib/pos2/currentActor';
import {requireActorBranch} from '@/lib/pos2/cash/guards';
import {requireCapability} from '@/lib/pos2/authorization';
import {prisma} from '@/lib/prisma';
import {dispatchServerOutbox} from '@/lib/pos2/serverOutbox';
import {pos2ErrorResponse} from '@/lib/pos2/http';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:Request){try{const actor=await getCurrentCommandActor();const {branchId}=await request.json();if(typeof branchId!=='string')return new Response(null,{status:400});requireActorBranch(actor,branchId);await prisma.$transaction(tx=>requireCapability(tx,actor,'catalog.view',branchId));return Response.json(await dispatchServerOutbox(branchId),{headers:{'Cache-Control':'no-store'}});}catch(e){return pos2ErrorResponse(e)}}
