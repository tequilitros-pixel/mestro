/*
 * DIAGNOSTICO DE SOLO LECTURA — baseline_test
 *
 * Cada consulta va en su PROPIA transaccion READ ONLY, de modo que
 * un fallo no aborta las siguientes (el efecto cascada que invalido
 * las guardas 7 y 8 en la ejecucion anterior).
 *
 * NO emite DDL. NO normaliza nada: reporta el valor observado tal
 * cual, sin trim, para que la causa del FAIL sea evidente.
 * No imprime URL, contrasena ni hostname.
 */
import pg from "pg";

if (process.env.BASELINE_TEST_URL === undefined) {
  console.error("ABORTADO: falta BASELINE_TEST_URL. Este script nunca usa DATABASE_URL.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.BASELINE_TEST_URL, max: 1 });
const L = "=".repeat(58);

/* Ejecuta fn en su propia transaccion read-only, siempre con ROLLBACK. */
async function aislado(etiqueta, fn) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN READ ONLY");
    return await fn(c);
  } catch (e) {
    console.log(`  [${etiqueta}] ERROR: ${e.message}`);
    return null;
  } finally {
    try { await c.query("ROLLBACK"); } catch {}
    c.release();
  }
}

console.log(`\n${L}\n DIAGNOSTICO — solo lectura\n${L}`);

/* ---------- A. Nombre exacto de la base ---------- */
console.log("\nA. current_database()");
await aislado("A", async (c) => {
  const db = (await c.query("SELECT current_database() AS db")).rows[0].db;
  const esperado = "baseline_test";
  console.log(`  JSON.stringify(observado) : ${JSON.stringify(db)}`);
  console.log(`  longitud observada        : ${db.length}`);
  console.log(`  longitud de "baseline_test": ${esperado.length}`);
  console.log(`  comparacion estricta       : ${db === esperado ? "IGUAL" : "DISTINTO"}`);
  if (db !== esperado) {
    console.log("  codigos Unicode del valor observado:");
    console.log("    " + [...db].map((ch, i) => `[${i}] U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")} ${JSON.stringify(ch)}`).join("\n    "));
    console.log('  codigos Unicode de "baseline_test":');
    console.log("    " + [...esperado].map((ch, i) => `[${i}] U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")} ${JSON.stringify(ch)}`).join("\n    "));
  }
  return db;
});

/* ---------- B. Estructura del marcador ---------- */
console.log("\nB. baseline_guard.environment_marker");
await aislado("B", async (c) => {
  const esq = (await c.query(
    "SELECT nspname FROM pg_namespace WHERE nspname = 'baseline_guard'")).rows;
  console.log(`  esquema baseline_guard existe : ${esq.length > 0}`);

  const tab = (await c.query(
    `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'baseline_guard' AND c.relkind = 'r'`)).rows;
  console.log(`  tablas en baseline_guard      : ${tab.map((t) => t.relname).join(", ") || "(ninguna)"}`);

  const cols = (await c.query(
    `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema = 'baseline_guard' AND table_name = 'environment_marker'
      ORDER BY ordinal_position`)).rows;
  console.log(`  columnas de environment_marker:`);
  if (!cols.length) console.log("    (ninguna: la tabla no existe o no es accesible)");
  for (const x of cols) console.log(`    ${x.column_name}  ${x.data_type}  nullable=${x.is_nullable}`);
  console.log(`  columna oficial esperada      : value`);
  console.log(`  coincide con la especificacion: ${cols.some((x) => x.column_name === "value")}`);
  return cols;
});

/* ---------- C. Valor del marcador, leyendo la columna oficial ---------- */
console.log("\nC. valor del marcador (columna 'value')");
await aislado("C", async (c) => {
  const r = await c.query("SELECT value FROM baseline_guard.environment_marker");
  console.log(`  filas               : ${r.rows.length}`);
  for (const f of r.rows) console.log(`  JSON.stringify(value): ${JSON.stringify(f.value)}`);
  console.log(`  esperado             : ${JSON.stringify("baseline_test_fase3")}`);
  return r.rows;
});

/* ---------- D. Estado de public ---------- */
console.log("\nD. universo funcional en public");
await aislado("D", async (c) => {
  const r = (await c.query(
    `SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relkind='r') AS tablas,
            (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
              WHERE n.nspname='public' AND t.typtype='e') AS enums,
            (SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
              JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public') AS policies`)).rows[0];
  console.log(`  tablas en public  : ${r.tablas}`);
  console.log(`  enums en public   : ${r.enums}`);
  console.log(`  policies en public: ${r.policies}`);
  const nombres = (await c.query(
    `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r' ORDER BY 1 LIMIT 10`)).rows.map((x) => x.relname);
  console.log(`  primeras tablas   : ${nombres.join(", ") || "(ninguna)"}`);
  return r;
});

/* ---------- E. TLS y parametros de la URL ---------- */
console.log("\nE. TLS y parametros (sin revelar la URL)");
{
  const u = new URL(process.env.BASELINE_TEST_URL);
  console.log(`  sslmode         : ${u.searchParams.get("sslmode") ?? "(ausente)"}`);
  console.log(`  channel_binding : ${u.searchParams.get("channel_binding") ?? "(ausente)"}`);
  const c = await pool.connect();
  const s = c.connection?.stream;
  console.log(`  socket cifrado  : ${s?.encrypted === true}`);
  console.log(`  cert autorizado : ${s?.authorized === true}`);
  console.log(`  error de cert   : ${s?.authorizationError || "(ninguno)"}`);
  console.log(`  protocolo       : ${typeof s?.getProtocol === "function" ? s.getProtocol() : "(desconocido)"}`);
  c.release();
}

await pool.end();
console.log(`\n${L}\n DIAGNOSTICO COMPLETO — sin DDL, sin escrituras\n${L}\n`);
