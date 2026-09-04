/*
 * ============================================================
 * FASE 3 — MODO A: reconstruccion correcta
 * ============================================================
 * Demuestra que el baseline construye exactamente el esquema
 * funcional representado por C, partiendo de una base vacia.
 *
 * Flujo:
 *   1 pre-flight local      hashes de A, C y baseline
 *   2 perfil PRE_DDL        las 8 guardas, en BEGIN READ ONLY / ROLLBACK
 *   3 hash del baseline     re-verificado justo antes del DDL
 *   4 public vacio          comprobado de nuevo
 *   5 aplicar baseline      unico DDL de este modo
 *   6 perfil POST_COMMIT    identidad + baseline construido
 *   7 capturar              capturar-baseline-test.mjs (13 consultas)
 *   8 comparar contra C     lib-comparar.mjs
 *   9 RLS / policies        campo a campo
 *  10 PASS/FAIL detallado
 *
 * NO invoca Prisma. NO ejecuta migrate deploy.
 * NO lee DATABASE_URL. NO limpia public automaticamente.
 * ============================================================
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import pg from "pg";
import * as E from "./lib-ejecutor.mjs";
import * as K from "./lib-comparar.mjs";
import { compararCapturaContraC, conteosObservados } from "./lib-comparar-modoa.mjs";

const { L, abortar, Abortar } = E;
const CAPTURA = E.R(".tmp-baseline/fase3/captura-baseline-test.json");
let pool = null, cliente = null, salida = 1, ddlAbierto = false;

try {
  console.log(`\n${L}\n FASE 3 — MODO A: reconstruccion correcta\n${L}\n`);

  /* ---- 1. Pre-flight local ---- */
  console.log("1. PRE-FLIGHT LOCAL");
  E.preflightLocal();
  const A = JSON.parse(fs.readFileSync(E.RUTAS.A, "utf-8"));
  const C = JSON.parse(fs.readFileSync(E.RUTAS.C, "utf-8"));
  const nom = (x) => (typeof x === "string" ? x : (x.tabla ?? x.nombre));
  const tablasA = A.aplicacion.tablas.map(nom);
  const url = E.urlDeTest();

  /* ---- 2. Guardas de identidad ---- */
  console.log("\n2. IDENTIDAD DEL ENTORNO");
  pool = new pg.Pool({ connectionString: process.env.BASELINE_TEST_URL, max: 1 });
  cliente = await pool.connect();
  E.verificarSocket(cliente);
  await E.guardasPreDDL(cliente, url, tablasA);

  /* ---- 3 y 4. Revalidacion INMEDIATAMENTE antes del BEGIN ----
   * Entre estas dos comprobaciones y el BEGIN no ocurre ninguna
   * operacion modificadora. */
  console.log("\n3. BASELINE SQL (re-verificado justo antes del DDL)");
  const sql = E.leerBaselineVerificado("hash del baseline");
  console.log("\n4. ESTADO INICIAL (re-comprobado justo antes del DDL)");
  await E.exigirPublicVacio(cliente, "public antes del BEGIN");

  /* ---- 5. Aplicar el baseline en transaccion EXPLICITA ----
   * No se depende de la semantica implicita de una consulta
   * multi-sentencia: BEGIN / baseline / COMMIT. Si algo falla,
   * ROLLBACK y se termina FAIL sin capturar ni comparar. */
  console.log("\n5. APLICANDO EL BASELINE (transaccion explicita)");
  console.log("   (unico DDL de este modo; sin Prisma, sin comandos de migracion)");
  const t0 = process.hrtime.bigint();
  await cliente.query("BEGIN");
  ddlAbierto = true;
  try {
    await cliente.query(sql);
  } catch (e) {
    await cliente.query("ROLLBACK");
    ddlAbierto = false;
    abortar(`el baseline fallo al aplicarse; se ejecuto ROLLBACK.\n  ${e.message}\n` +
            "No se ejecuta captura ni comparacion.");
  }
  await cliente.query("COMMIT");
  ddlAbierto = false;
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(`   BEGIN -> baseline -> COMMIT en ${ms.toFixed(0)} ms`);
  console.log("   El baseline completo fue aplicado y confirmado transaccionalmente");
  console.log("   antes de iniciar la captura de verificacion.");

  /* ---- 6. PERFIL POST_COMMIT: nunca exige public vacio ---- */
  console.log("\n6. ESTADO POST_COMMIT");
  await E.guardasPostCommit(cliente, url);

  /* ---- 7. Capturar con el instrumento de 13 consultas ---- */
  console.log("\n7. CAPTURA DEL RESULTADO");
  cliente.release(); cliente = null;
  await pool.end(); pool = null;
  try {
    /* Entorno MINIMO para el subproceso: se le pasa BASELINE_TEST_URL
     * y nada mas. DATABASE_URL no se propaga, aunque el capturador no
     * la use: no hay razon para que la variable de produccion cruce
     * este limite. */
    const entornoMinimo = { PATH: process.env.PATH, HOME: process.env.HOME,
      BASELINE_TEST_URL: process.env.BASELINE_TEST_URL };
    const out = execFileSync("node", [E.F("capturar-baseline-test.mjs")],
      { encoding: "utf-8", env: entornoMinimo, stdio: ["pipe", "pipe", "pipe"] });
    console.log(out.split("\n").filter((l) => l.trim()).map((l) => "   " + l.trim()).join("\n"));
  } catch (e) {
    abortar(`la captura fallo:\n${(e.stdout || "") + (e.stderr || "")}`);
  }
  if (!fs.existsSync(CAPTURA)) abortar("la captura no genero el archivo esperado.");
  const O = JSON.parse(fs.readFileSync(CAPTURA, "utf-8"));

  /* ---- 8 y 9. Comparacion estructural + RLS/policies ---- */
  console.log("\n8. COMPARACION ESTRUCTURAL CONTRA C");
  console.log("9. RLS Y POLICIES");
  const { cmp, veredicto: v } = compararCapturaContraC(O, C);
  console.log(`   RLS esperadas: ${C.heredado_de_A.rls.length} · observadas: ${(O.aplicacion?.rls ?? []).length}`);
  console.log(`   policies esperadas: ${C.heredado_de_A.policies.length} · observadas: ${(O.aplicacion?.policies ?? []).length}`);

  /* ---- 10. Veredicto ---- */
  const cont = C.conteos;
  const obs = conteosObservados(O);
  console.log(`\n10. CONTEOS\n   ${"seccion".padEnd(14)}${"esperado".padStart(9)}${"observado".padStart(11)}`);
  let desajuste = 0;
  for (const [k, e] of Object.entries(cont)) {
    const o = obs[k];
    const ok = Number(e.C) === Number(o);
    if (!ok) desajuste++;
    console.log(`   ${k.padEnd(14)}${String(e.C).padStart(9)}${String(o).padStart(11)}  ${ok ? "ok" : "*** DISTINTO ***"}`);
  }
  console.log(`   interno Prisma observado: ${(O.interno_prisma?.tablas ?? []).join(", ") || "(ninguno)"} (fuera del universo funcional)`);

  if (v.normalizaciones_aplicadas.length) {
    console.log(`\n   normalizaciones aplicadas: ${v.normalizaciones_aplicadas.length}`);
    const porRegla = {};
    for (const n of v.normalizaciones_aplicadas) for (const r of n.reglas) porRegla[r] = (porRegla[r] ?? 0) + 1;
    for (const [r, n] of Object.entries(porRegla)) console.log(`     ${r}: ${n}`);
  }
  const muestra = (titulo, lista) => {
    if (!lista.length) return;
    console.log(`\n   ${titulo}: ${lista.length}`);
    for (const d of lista.slice(0, 40))
      console.log(`     ${d.ruta}\n       esperado : ${JSON.stringify(d.esperado)}\n       observado: ${JSON.stringify(d.observado)}`);
    if (lista.length > 40) console.log(`     ... y ${lista.length - 40} mas`);
  };
  muestra("DIFERENCIAS", v.diferencias);
  muestra("REVISION MANUAL", v.revision_manual);
  muestra("NO CLASIFICABLES", v.no_clasificables);

  const pass = v.estado === "PASS" && desajuste === 0;
  console.log(`\n${L}\n MODO A: ${pass ? "PASS" : "FAIL"}`);
  if (!pass) console.log(` diferencias=${v.diferencias.length} revision_manual=${v.revision_manual.length} no_clasificables=${v.no_clasificables.length} conteos_distintos=${desajuste}`);
  console.log(`${L}\n`);
  salida = pass ? 0 : 1;
} catch (e) {
  console.error(`\n${L}\n MODO A: ABORTADO\n${L}`);
  console.error(e instanceof Abortar ? e.message : `error inesperado: ${e.stack ?? e.message}`);
  salida = 1;
} finally {
  /* Si algo interrumpio con la transaccion de DDL abierta, revertir:
   * nunca dejar el baseline a medio aplicar. */
  if (cliente && ddlAbierto) {
    try { await cliente.query("ROLLBACK"); console.error("  ROLLBACK de seguridad ejecutado (DDL sin confirmar)."); }
    catch (e) { console.error(`  *** no se pudo revertir: ${e.message} — revisa baseline_test ***`); }
  }
  try { cliente?.release(); } catch {}
  try { await pool?.end(); } catch {}
}
process.exit(salida);
