import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const url=process.env.DATABASE_URL!;
if(new URL(url).hostname!=='127.0.0.1'||!url.endsWith('/veliz_audit')) throw Error('LOCAL_TEST_DATABASE_REQUIRED');
const db=new PrismaClient({adapter:new PrismaPg({connectionString:url})});
const suffix=Date.now(); const batchId='qa-liquor-batch-'+suffix; const stepId=batchId+'-step'; const ingredientId=batchId+'-ingredient'; const rawId='qa-concurrent-'+suffix;
const waterBefore=(await db.rawMaterial.findUniqueOrThrow({where:{id:'qa-water'}})).currentStock;
if (!(await db.liquorProduct.findUnique({where:{id:'qa-liquor'}}))) {
await db.liquorProduct.create({data:{id:'qa-liquor',name:'Licor de prueba local',slug:'qa-local',prefix:'QA',defaultShelfLifeDays:365,requiresSerialNumber:true}});
await db.liquorRecipe.create({data:{id:'qa-recipe',name:'Receta de prueba local',version:1,productId:'qa-liquor',targetLiters:2,targetAlcohol:20}});
await db.liquorRecipeIngredient.create({data:{id:'qa-recipe-ingredient',recipeId:'qa-recipe',name:'Agua',rawMaterialId:'qa-water',quantity:2,unit:'L'}});
}
await db.liquorBatch.create({data:{id:batchId,code:batchId,sequence:(await db.liquorBatch.count())+1,productId:'qa-liquor',recipeId:'qa-recipe',status:'EN_ELABORACION',plannedLiters:2,createdById:'qa-admin'}});
await db.liquorBatchIngredient.create({data:{id:ingredientId,batchId,recipeIngredientId:'qa-recipe-ingredient',name:'Agua',baseQuantity:2,scaledQuantity:2,unit:'L'}});
await db.liquorBatchStep.create({data:{id:stepId,batchId,position:1,type:'INGREDIENT',title:'Agregar agua de prueba',actions:[],checks:[],completedActionIndexes:[],completedCheckIndexes:[],plannedQuantity:2,unit:'L',batchIngredientId:ingredientId}});
const headers={Cookie:'maestro_session=local-qa-admin'};
const page=await fetch('http://127.0.0.1:3107/liquors/batches/'+batchId,{headers});const html=await page.text();assert.equal(page.status,200,html.slice(0,200));

const {encodeReply}=createRequire(import.meta.url)('next/dist/compiled/react-server-dom-webpack/client.node');
const pagePath='/liquors/batches/'+batchId;
function actionId(name:string){const m=JSON.parse(readFileSync('.next/dev/server/server-reference-manifest.json','utf8')) as {node:Record<string,{exportedName:string}>};return Object.entries(m.node).find(([,v])=>v.exportedName===name)![0]}
function form(values:Record<string,string>){const f=new FormData();for(const [k,v] of Object.entries(values))f.set(k,v);return f}
async function action(name:string,args:unknown[],path=pagePath,user='qa-admin'){
 const body=await encodeReply(args);const response=await fetch('http://127.0.0.1:3107'+path,{method:'POST',headers:{Cookie:'maestro_session=local-'+user,Origin:'http://127.0.0.1:3107','Next-Action':actionId(name),Accept:'text/x-component'},body,redirect:'manual',signal:AbortSignal.timeout(45000)});return {status:response.status,text:await response.text()};
}
const stepForm=()=>form({batchId,stepId,actualQuantity:'2'});
const denied=await action('completeLiquorBatchStepAction',[stepForm()],pagePath,'qa-operator');assert.ok(denied.text.includes('PERMISSION_DENIED'));assert.equal(await db.rawMaterialMovement.count({where:{liquorBatchId:batchId}}),0);console.log('PASS Liquor action denies unauthorized role');
const steps=await Promise.all([action('completeLiquorBatchStepAction',[stepForm()]),action('completeLiquorBatchStepAction',[stepForm()])]);assert.ok(steps.every(r=>r.status===200),JSON.stringify(steps));assert.equal((await db.rawMaterial.findUniqueOrThrow({where:{id:'qa-water'}})).currentStock,waterBefore-2);assert.equal(await db.rawMaterialMovement.count({where:{liquorBatchId:batchId}}),1);assert.equal(await db.liquorBatchEvent.count({where:{batchId}}),1);console.log('PASS Concurrent step consumes once');
const finishForm=()=>form({batchId,actualLiters:'2',finalAlcohol:'20'});
await Promise.all([action('finishLiquorBatchAction',[finishForm()]),action('finishLiquorBatchAction',[finishForm()])]);assert.equal((await db.liquorBatch.findUniqueOrThrow({where:{id:batchId}})).status,'LISTO_PARA_EMBOTELLAR');assert.equal(await db.liquorBatchEvent.count({where:{batchId,type:'FIN_ELABORACION'}}),1);console.log('PASS Concurrent finish releases once');
await (await fetch('http://127.0.0.1:3107'+pagePath+'/bottling',{headers})).text();
const bottleInput={batchId,bottleSizeMl:1000,filledBottles:2,rejectedBottles:0};
await Promise.all([action('createLiquorBottlingAction',[bottleInput],pagePath+'/bottling'),action('createLiquorBottlingAction',[bottleInput],pagePath+'/bottling')]);
assert.equal(await db.liquorBottling.count({where:{batchId}}),1);assert.equal(await db.liquorBottle.count({where:{bottling:{batchId}}}),2);assert.equal((await db.liquorBatch.findUniqueOrThrow({where:{id:batchId}})).status,'TERMINADO');console.log('PASS Concurrent bottling cannot exceed volume; batch completes');
const original=await db.liquorBatch.findUniqueOrThrow({where:{id:batchId}});await action('finishLiquorBatchAction',[form({batchId,actualLiters:'50',finalAlcohol:'20'})]);assert.deepEqual(await db.liquorBatch.findUniqueOrThrow({where:{id:batchId}}),original);console.log('PASS Finished batch cannot reopen or change volume');
const rawPath='/liquors/raw-materials';await (await fetch('http://127.0.0.1:3107'+rawPath,{headers})).text();
await db.rawMaterial.create({data:{id:rawId,code:'QA-CONCURRENT-'+suffix,name:'Concurrencia local '+suffix,baseUnit:'L',currentStock:10,averageCost:2}});
const out=()=>form({rawMaterialId:rawId,type:'MERMA',amount:'6',notes:'Prueba aislada'});
await Promise.all([action('registerMovementAction',[out()],rawPath),action('registerMovementAction',[out()],rawPath)]);assert.equal((await db.rawMaterial.findUniqueOrThrow({where:{id:rawId}})).currentStock,4);assert.equal(await db.rawMaterialMovement.count({where:{rawMaterialId:rawId}}),1);console.log('PASS Concurrent raw material outflow rejects insufficient stock');
await Promise.all([action('registerMovementAction',[form({rawMaterialId:rawId,type:'COMPRA',amount:'5',unitCost:'4'})],rawPath),action('registerMovementAction',[form({rawMaterialId:rawId,type:'COMPRA',amount:'5',unitCost:'6'})],rawPath)]);const raw=await db.rawMaterial.findUniqueOrThrow({where:{id:rawId}});assert.equal(raw.currentStock,14);assert.ok(Math.abs(raw.averageCost!-58/14)<0.000001);console.log('PASS Concurrent purchases keep weighted cost and stock consistent');
await db.$disconnect();
