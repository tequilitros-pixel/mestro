/*
 * ============================================================
 * DIAGNOSTICO DEL ESTADO ACTUAL DE baseline_test
 * ============================================================
 * ESTRICTAMENTE SOLO LECTURA: BEGIN READ ONLY -> ROLLBACK.
 * No emite DDL. No borra. No limpia. No invoca Prisma.
 *
 * Escribe UNICAMENTE a una ruta diagnostica nueva:
 *   .tmp-baseline/diagnostico/estado-actual.json
 * para no sobrescribir ninguna evidencia previa.
 *
 * Objetivo: saber QUE hay ahora en baseline_test y si coincide
 * estructuralmente con C, sin atribuir el cambio a ningun proceso.
 * ============================================================
 */
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { verificarPostCommit, ENV_ESPERADO, shaTexto, endpointBase, verificarParametrosTLS } from "./lib-identidad.mjs";
import { compararCapturaContraC, conteosObservados } from "./lib-comparar-modoa.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SALIDA_DIR = path.join(ROOT, ".tmp-baseline/diagnostico");
const SALIDA = path.join(SALIDA_DIR, "estado-actual.json");
const C_PATH = path.join(ROOT, ".tmp-baseline/manifest-baseline-expected.json");
const C_SHA = "0e2f0bdd928cc070d883dcce690fb2c511cb884614ae5801edd34f2bbda525d6";
const L = "=".repeat(60);

if (process.env.BASELINE_TEST_URL === undefined) {
  console.error("ABORTADO: falta BASELINE_TEST_URL. Este script nunca usa DATABASE_URL.");
  process.exit(1);
}
const url = new URL(process.env.BASELINE_TEST_URL);
const tls = verificarParametrosTLS(url);
if (!tls.ok) { console.error("ABORTADO: precondicion TLS: " + tls.problemas.join(", ")); process.exit(1); }

const bytesC = fs.readFileSync(C_PATH);
const shaC = crypto.createHash("sha256").update(bytesC).digest("hex");
const C = JSON.parse(bytesC.toString("utf-8"));

const pool = new pg.Pool({ connectionString: process.env.BASELINE_TEST_URL, max: 1 });
let c = null, salida = 1;

try {
  c = await pool.connect();
  const s = c.connection?.stream;
  console.log(`\n${L}\n DIAGNOSTICO DEL ESTADO ACTUAL — solo lectura\n${L}`);
  console.log(`  TLS: cifrada=${s?.encrypted === true} autorizado=${s?.authorized === true} ${typeof s?.getProtocol === "function" ? s.getProtocol() : ""}`);
  console.log(`  C oficial: ${shaC.slice(0, 16)}... ${shaC === C_SHA ? "ok" : "*** NO ES EL OFICIAL ***"}`);

  await c.query("BEGIN READ ONLY");

  /* ---- 1. Identidad ---- */
  console.log("\n1. IDENTIDAD DEL ENTORNO");
  console.log(`  sha hostname     : ${shaTexto(url.hostname).slice(0, 16)}...`);
  console.log(`  sha endpoint base: ${shaTexto(endpointBase(url.hostname)).slice(0, 16)}...`);
  const r = await verificarPostCommit(c, url);
  for (const g of r.guardas) console.log(`  ${(g.estado ?? "?").padEnd(5)} ${g.nombre}: ${g.detalle}`);

  /* ---- 2. Estado estructural ---- */
  console.log("\n2. ESTADO ESTRUCTURAL ACTUAL");
  const est = (await c.query(`
    WITH t AS (SELECT c.oid, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname='public' AND c.relkind='r' AND c.relname <> '_prisma_migrations')
    SELECT (SELECT count(*) FROM t) AS tablas,
      (SELECT count(*) FROM pg_type ty JOIN pg_namespace n ON n.oid=ty.typnamespace WHERE n.nspname='public' AND ty.typtype='e') AS enums,
      (SELECT count(*) FROM pg_attribute a WHERE a.attrelid IN (SELECT oid FROM t) AND a.attnum > 0 AND NOT a.attisdropped) AS columnas,
      (SELECT count(*) FROM pg_class i JOIN pg_index x ON x.indexrelid=i.oid WHERE x.indrelid IN (SELECT oid FROM t)) AS indices,
      (SELECT count(*) FROM pg_constraint k WHERE k.conrelid IN (SELECT oid FROM t)) AS constraints,
      (SELECT count(*) FROM pg_class cc WHERE cc.oid IN (SELECT oid FROM t) AND cc.relrowsecurity) AS rls,
      (SELECT count(*) FROM pg_policy p WHERE p.polrelid IN (SELECT oid FROM t)) AS policies,
      (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid=pr.pronamespace WHERE n.nspname='public' AND pr.prokind IN ('f','p')
        AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=pr.oid AND d.objsubid=0
                          AND d.refclassid='pg_extension'::regclass AND d.deptype='e')) AS funciones,
      (SELECT count(*) FROM pg_trigger tg WHERE tg.tgrelid IN (SELECT oid FROM t) AND NOT tg.tgisinternal) AS triggers,
      (SELECT count(*) FROM pg_class cs JOIN pg_namespace n ON n.oid=cs.relnamespace WHERE n.nspname='public' AND cs.relkind='S') AS secuencias,
      (SELECT count(*) FROM pg_class pm JOIN pg_namespace n ON n.oid=pm.relnamespace
        WHERE n.nspname='public' AND pm.relkind='r' AND pm.relname='_prisma_migrations') AS tabla_prisma`)).rows[0];
  const esp = { tablas: 89, enums: 54, columnas: 1048, indices: 326, constraints: 265, rls: 3, policies: 3, funciones: 0, triggers: 0, secuencias: 0 };
  console.log(`  ${"objeto".padEnd(13)}${"observado".padStart(11)}${"C espera".padStart(11)}`);
  for (const [k, v] of Object.entries(esp))
    console.log(`  ${k.padEnd(13)}${String(est[k]).padStart(11)}${String(v).padStart(11)}  ${Number(est[k]) === v ? "ok" : "*** DISTINTO ***"}`);
  console.log(`  ${"_prisma_migrations".padEnd(13)}${String(est.tabla_prisma).padStart(11)}${"(aparte)".padStart(11)}`);

  /* ---- 3. Esquemas presentes ---- */
  const esq = (await c.query(
    `SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema' ORDER BY 1`)).rows.map((x) => x.nspname);
  console.log(`\n  esquemas no-sistema: ${esq.join(", ")}`);

  /* ---- 4. _prisma_migrations ---- */
  console.log("\n4. _prisma_migrations");
  if (Number(est.tabla_prisma) === 0) console.log("  la tabla NO existe.");
  else {
    const filas = (await c.query(
      `SELECT migration_name, started_at, finished_at, applied_steps_count, rolled_back_at
         FROM public."_prisma_migrations" ORDER BY started_at`)).rows;
    console.log(`  filas: ${filas.length}`);
    for (const f of filas)
      console.log(`    ${f.migration_name} | started=${f.started_at?.toISOString?.() ?? f.started_at} | finished=${f.finished_at?.toISOString?.() ?? f.finished_at} | steps=${f.applied_steps_count} | rolled_back=${f.rolled_back_at ?? "no"}`);
  }

  /* ---- 5. Captura completa para comparar contra C ---- */
  console.log("\n5. CAPTURA DEL ESTADO ACTUAL (para comparar contra C)");
  const O = { esquema: "public", parte: "diagnostico_estado_actual", aplicacion: {}, interno_prisma: {}, enums: {}, secuencias: [] };
  const filas = async (q, p) => (await c.query(q, p)).rows;
  const PRISMA = new Set(["_prisma_migrations"]);

  const todas = await filas(`SELECT c.relname AS tabla FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                              WHERE n.nspname='public' AND c.relkind='r' ORDER BY 1`);
  O.aplicacion.tablas = todas.map((x) => x.tabla).filter((t) => !PRISMA.has(t));
  O.interno_prisma.tablas = todas.map((x) => x.tabla).filter((t) => PRISMA.has(t));

  const cols = await filas(`SELECT c.relname AS tabla, a.attname AS nombre, format_type(a.atttypid, a.atttypmod) AS tipo_sql,
      NOT a.attnotnull AS nullable, pg_get_expr(d.adbin, d.adrelid) AS default_sql
      FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE n.nspname='public' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname, a.attnum`);
  O.aplicacion.columnas = {};
  for (const r2 of cols) if (!PRISMA.has(r2.tabla)) (O.aplicacion.columnas[r2.tabla] ??= []).push(r2);

  const idx = await filas(`SELECT c.relname AS tabla, i.relname AS indice, x.indisunique AS es_unico, x.indisprimary AS es_primaria,
      am.amname AS metodo, pg_get_indexdef(i.oid) AS definicion
      FROM pg_index x JOIN pg_class i ON i.oid=x.indexrelid JOIN pg_class c ON c.oid=x.indrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_am am ON am.oid=i.relam
      WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname, i.relname`);
  O.aplicacion.indices = {};
  for (const r2 of idx) if (!PRISMA.has(r2.tabla)) {
    const m = String(r2.definicion).match(/\(([^)]*)\)\s*$/);
    r2.columnas = m ? m[1].split(",").map((x) => {
      const t2 = x.trim().replace(/^"|"$/g, "").replace(/"\s*$/, "");
      const mm = t2.match(/^([\w]+)(?:\s+(ASC|DESC))?/i);
      return { columna: mm ? mm[1] : t2, direccion_explicita: mm && mm[2] ? mm[2].toUpperCase() : null };
    }) : [];
    (O.aplicacion.indices[r2.tabla] ??= []).push(r2);
  }

  const cons = await filas(`SELECT c.relname AS tabla, k.conname AS constraint, pg_get_constraintdef(k.oid) AS definicion
      FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r' ORDER BY 1,2`);
  O.aplicacion.constraints = {};
  for (const r2 of cons) if (!PRISMA.has(r2.tabla)) (O.aplicacion.constraints[r2.tabla] ??= []).push(r2);

  for (const r2 of await filas(`SELECT t.typname AS enum_nombre, e.enumlabel AS valor
      FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace
      WHERE n.nspname='public' ORDER BY t.typname, e.enumsortorder`))
    (O.enums[r2.enum_nombre] ??= []).push(r2.valor);

  O.aplicacion.rls = await filas(`SELECT c.relname AS tabla, c.relrowsecurity AS enable_rls, c.relforcerowsecurity AS force_rls
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity ORDER BY 1`);
  O.aplicacion.policies = await filas(`SELECT c.relname AS tabla, p.polname AS nombre,
      CASE p.polcmd WHEN '*' THEN '*' WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' END AS comando,
      p.polpermissive AS permissive,
      COALESCE((SELECT string_agg(r.rolname, ', ' ORDER BY r.rolname) FROM pg_roles r WHERE r.oid = ANY(p.polroles)), 'public') AS roles,
      pg_get_expr(p.polqual, p.polrelid) AS using, pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
      FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' ORDER BY c.relname, p.polname`);
  O.aplicacion.funciones = [];
  O.aplicacion.triggers = [];
  O.secuencias = await filas(`SELECT c.relname AS nombre FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='S'`);

  await c.query("ROLLBACK");
  console.log("  ROLLBACK ejecutado (ninguna escritura).");

  /* ---- 6. Comparacion contra C ---- */
  console.log("\n6. COMPARACION CONTRA C OFICIAL");
  const { veredicto: v } = compararCapturaContraC(O, C);
  const obs = conteosObservados(O);
  console.log(`  diferencias reales : ${v.diferencias.length}`);
  console.log(`  NO_CLASIFICABLE    : ${v.no_clasificables.length}`);
  console.log(`  REVISION_MANUAL    : ${v.revision_manual.length}`);
  console.log(`  veredicto          : ${v.estado}`);
  const muestra = (t, l) => { if (!l.length) return; console.log(`\n  ${t}:`);
    for (const d of l.slice(0, 25)) console.log(`    ${d.ruta}\n      esperado : ${JSON.stringify(d.esperado)}\n      observado: ${JSON.stringify(d.observado)}`);
    if (l.length > 25) console.log(`    ... y ${l.length - 25} mas`); };
  muestra("DIFERENCIAS", v.diferencias);
  muestra("REVISION MANUAL", v.revision_manual);
  muestra("NO CLASIFICABLES", v.no_clasificables);

  fs.mkdirSync(SALIDA_DIR, { recursive: true });
  const json = JSON.stringify(O, Object.keys(O).sort(), 2) + "\n";
  fs.writeFileSync(SALIDA, json, "utf-8");
  console.log(`\n  captura guardada en: ${path.relative(ROOT, SALIDA)}`);
  console.log(`  sha256: ${crypto.createHash("sha256").update(json).digest("hex")}`);
  console.log(`\n${L}\n DIAGNOSTICO COMPLETO — sin escrituras en la base\n${L}\n`);
  salida = 0;
} catch (e) {
  console.error(`\nERROR: ${e.message}`);
} finally {
  try { await c?.query("ROLLBACK"); } catch {}
  try { c?.release(); } catch {}
  try { await pool.end(); } catch {}
}
process.exit(salida);
