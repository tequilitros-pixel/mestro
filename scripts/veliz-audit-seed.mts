import { Client } from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
const url=process.env.DATABASE_URL!;
if(new URL(url).hostname !== '127.0.0.1' || !url.endsWith('/veliz_audit')) throw Error('LOCAL_TEST_DATABASE_REQUIRED');
const owner=new Client({connectionString:url});await owner.connect();
await owner.query("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'maestro_runtime') THEN CREATE ROLE maestro_runtime LOGIN PASSWORD 'veliz-local-only' NOSUPERUSER NOBYPASSRLS; END IF; END $$");
await owner.query('GRANT USAGE ON SCHEMA public TO maestro_runtime');
await owner.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO maestro_runtime');
await owner.query('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO maestro_runtime');
await owner.end();
const db=new PrismaClient({adapter:new PrismaPg({connectionString:url})});
if (!(await db.branch.findUnique({where:{id:'veliz'}}))) {
for(const [id,role] of [['qa-admin','ADMIN'],['qa-manager','GERENTE'],['qa-other','ENCARGADO'],['qa-operator','OPERATOR']] as const){
 await db.user.create({data:{id,name:id,username:id,password:await bcrypt.hash('local-qa-only',10),role}});
 await db.userSession.create({data:{userId:id,tokenHash:createHash('sha256').update('local-'+id).digest('hex'),expiresAt:new Date(Date.now()+86400000)}});
}
await db.branch.createMany({data:[{id:'veliz',code:'VELIZ',name:'Veliz (prueba aislada)'},{id:'other',code:'OTRA',name:'Otra sucursal de prueba'}]});
await db.userBranch.createMany({data:[{userId:'qa-manager',branchId:'veliz'},{userId:'qa-manager',branchId:'other'},{userId:'qa-other',branchId:'other'}]});
for(const userId of ['qa-manager','qa-other']) await db.modulePermission.createMany({data:['/pos','/pos/sales','/cash-cuts/daily','/cash-cuts/dashboard','/cash-cuts/safe'].map(moduleKey=>({userId,moduleKey}))});
await db.cashCut.create({data:{id:'veliz-historical',code:'CC-VELIZ-2026-09-25-01',branchId:'veliz',responsibleId:'qa-manager',createdById:'qa-manager',date:new Date('2026-09-25Z'),status:'CERRADO',startingFund:563,cashCounted:563,cashExpected:563,nextFund:563,difference:0,totalSales:0,totalInflows:0,totalOutflows:0,envelopeAmount:0,openedAt:new Date('2026-09-25T15:59Z'),closedAt:new Date('2026-09-25T23:59Z')}});
}
await db.inventoryProduct.create({data:{id:'qa-ice',code:'QA-ICE',name:'Insumo de prueba',category:'QA',unit:'G',inventoryBaseUnit:'G',itemType:'CONSUMABLE'}});
await db.inventoryBalance.create({data:{branchId:'veliz',inventoryProductId:'qa-ice',quantity:10000,unit:'G'}});
await db.inventoryEntry.create({data:{branchId:'veliz',productId:'qa-ice',type:'COMPRA',quantity:10000}});
await db.posCategory.create({data:{id:'qa-cat',name:'Pruebas aisladas',slug:'qa'}});
await db.posProduct.create({data:{id:'qa-product',name:'Producto de prueba',categoryId:'qa-cat',inventoryTracked:true}});
await db.posProductVariant.create({data:{id:'qa-variant',productId:'qa-product',name:'Unidad de prueba',price:30}});
await db.posVariantIngredient.create({data:{variantId:'qa-variant',inventoryProductId:'qa-ice',quantity:1000,unit:'G',unitStatus:'RESOLVED'}});
await db.rawMaterial.create({data:{id:'qa-water',name:'Agua de prueba',code:'QA-WATER',baseUnit:'L',currentStock:10,averageCost:2}});
await db.financialMovementCategory.createMany({data:[{id:'qa-income',name:'Entrada de prueba',code:'QA-INCOME',direction:'INCOME',scope:'CASH'},{id:'qa-expense',name:'Salida de prueba',code:'QA-EXPENSE',direction:'EXPENSE',scope:'CASH'}]});
await db.$disconnect();console.log('LOCAL_QA_DATA_READY; no production connection used');
