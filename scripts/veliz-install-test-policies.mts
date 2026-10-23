import { Client } from 'pg';
import { readFileSync } from 'node:fs';
const url=process.env.DATABASE_URL!;
if(new URL(url).hostname!=='127.0.0.1'||!url.endsWith('/veliz_audit'))throw Error('LOCAL_TEST_DATABASE_REQUIRED');
const db=new Client({connectionString:url});await db.connect();
const baseline=readFileSync('prisma/migrations/00000000000000_baseline_current_schema/migration.sql','utf8');
for(const [table,policy]of [['PosSale','pos_sale_branch_access'],['PosSaleItem','pos_sale_item_parent_access'],['PosSalePayment','pos_sale_payment_parent_access']])await db.query(`DROP POLICY IF EXISTS "${policy}" ON "${table}"`);
await db.query(baseline.slice(baseline.indexOf('ALTER TABLE "PosSale" ENABLE ROW LEVEL SECURITY;')));
await db.query(readFileSync('scripts/pos2/runtime-rls.sql','utf8'));
// The later legacy POS migration supersedes the historical POS2-only outbox policy.
await db.query(readFileSync('prisma/migrations/20260910160000_pos_legacy_outbox_rls/migration.sql','utf8'));
for(const [file,functionName,triggerName,table,end] of [
 ['20260831220000_pos2_phase3f_inventory_ledger','pos2_inventory_movement_immutable','InventoryMovement_immutable','InventoryMovement','INSERT INTO "Capability"'],
 ['20260830090000_pos2_phase3a_foundations','"prevent_audit_event_mutation"','AuditEvent_append_only','AuditEvent','ALTER TABLE "CapabilityGrant"'],
]){
 const sql=readFileSync(`prisma/migrations/${file}/migration.sql`,'utf8');const start=sql.indexOf('CREATE FUNCTION '+functionName);const stop=sql.indexOf(end,start);
 await db.query(`DROP TRIGGER IF EXISTS "${triggerName}" ON "${table}"`);
 await db.query(sql.slice(start,stop).replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'));
}
const rows=await db.query('SELECT tablename,policyname FROM pg_policies WHERE schemaname=\'public\' ORDER BY tablename');
console.log('LOCAL_POLICIES',rows.rowCount);
const role=await db.query("SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname='maestro_runtime'");console.log(role.rows);
await db.end();
