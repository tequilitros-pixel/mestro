import { timingSafeEqual } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { completeSale } from "@/lib/pos2/sales/completeSale";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function POST(request:Request){
 const expected=process.env.POS2_CERTIFICATION_SECRET,actual=request.headers.get('authorization')?.replace(/^Bearer /,'')??'';
 if(!expected||actual.length!==expected.length||!timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))return new Response(null,{status:403});
 const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
 const db=new PrismaClient({adapter:new PrismaPg(pool),transactionOptions:{timeout:5000},log:[{emit:'event',level:'query'}]});
 let queries:Array<{ms:number;query:string}>=[];
 db.$on('query',event=>queries.push({ms:event.duration,query:event.query.replace(/\s+/g,' ').slice(0,180)}));
 class RolledBack extends Error{constructor(public result:unknown){super('CERTIFICATION_ROLLBACK')}}
 try{
 const order=await db.pos2Order.findUniqueOrThrow({where:{id:'cmtq0e7y600009itwabl0bsbe'}});
 if(order.branchId!=='cmrwzvmjx00004ctwahlly9tb'||order.status!=='PAYMENT_PENDING')throw Error('Certification order mismatch');
 const user=await db.user.findUniqueOrThrow({where:{username:'adan'}});if(!user.active||user.role!=='ADMIN')throw Error('Certification actor mismatch');
 const runs=[];
 for(let i=0;i<3;i++){
 queries=[];const start=performance.now();let success=false,errorCode:string|null=null;
 const rollbackClient=new Proxy(db,{get(target,key){if(key==='$transaction')return (callback:(tx:unknown)=>Promise<unknown>)=>target.$transaction(async tx=>{const result=await callback(tx);throw new RolledBack(result)},{timeout:5000});return Reflect.get(target,key)}});
 try{await completeSale({client:rollbackClient as unknown as PrismaClient,orderId:order.id,expectedOrderVersion:order.version,cashSessionId:order.cashSessionId,terminalId:order.terminalId,actor:{id:user.id,role:user.role,branchIds:null},operationId:'01a0777d-13f4-7320-ad1c-127f0345f2fa',payments:[{method:'CASH',amount:'20.00',cashTendered:'20.00',reference:'CERTIFICACION VERCEL VELIZ'}]});}catch(e){if(e instanceof RolledBack)success=true;else errorCode=String((e as {code?:string}).code??'UNKNOWN');}
 runs.push({seconds:Number(((performance.now()-start)/1000).toFixed(3)),success,errorCode,queryCount:queries.length,slowest:[...queries].sort((a,b)=>b.ms-a.ms).slice(0,3)});
 }
 const persistedSales=await db.pos2Sale.count({where:{orderId:order.id}});
 return Response.json({region:process.env.VERCEL_REGION,timeoutMs:5000,runs,persistedSales},{headers:{'Cache-Control':'no-store'}});
 }finally{await db.$disconnect();await pool.end();}
}
