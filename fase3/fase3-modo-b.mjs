/*
 * ============================================================
 * FASE 3 — MODO B: fallo inyectado + ROLLBACK
 * ============================================================
 * Flujo:
 *   1 pre-flight local
 *   2 las 8 guardas de identidad
 *   3 public vacio
 *   4 hash del baseline re-verificado
 *   5 BEGIN
 *   6 aplicar el baseline COMPLETO
 *   7 fallo deliberado controlado
 *   8 ROLLBACK
 *   9 verificar que no queda residuo alguno
 *
 * ALCANCE DE LA CONCLUSION — importante:
 * Si este modo pasa, lo demostrado es exactamente:
 *   "El SQL del baseline es completamente reversible cuando se
 *    ejecuta dentro de una transaccion PostgreSQL explicita."
 * NO demuestra nada sobre Prisma: que `migrate deploy` envuelva
 * cada migracion en una transaccion es comportamiento de Prisma y
 * de su version instalada, y requiere una prueba propia.
 *
 * Este modo exige su PROPIO estado inicial vacio: no asume que
 * pueda correr despues del MODO A sobre la misma base llena.
 * No hace limpieza automatica.
 * ============================================================
 */
import pg from "pg";
import * as E from "./lib-ejecutor.mjs";

const { L, abortar, Abortar } = E;
/* Constructs que no pueden ejecutarse dentro de un bloque transaccional. */
const NO_TRANSACCIONAL = {
  "CREATE INDEX CONCURRENTLY": /CREATE\s+INDEX\s+CONCURRENTLY/i,
  "DROP INDEX CONCURRENTLY": /DROP\s+INDEX\s+CONCURRENTLY/i,
  "REINDEX CONCURRENTLY": /REINDEX[\s\S]{0,40}CONCURRENTLY/i,
  "VACUUM": /^\s*VACUUM\b/im,
  "CREATE DATABASE": /CREATE\s+DATABASE/i,
  "CREATE TABLESPACE": /CREATE\s+TABLESPACE/i,
  "ALTER SYSTEM": /ALTER\s+SYSTEM/i,
};
const MARCA_FALLO = "fallo inyectado por fase3-modo-b";

/* Conteo estructural del universo FUNCIONAL de public.
 * Excluye baseline_guard (infraestructura de seguridad previa) y
 * _prisma_migrations (interno de Prisma), que se reporta aparte.
 * La misma consulta se usa dentro y fuera de la transaccion: si
 * fueran distintas, la comparacion no seria concluyente. */
const SQL_ESTRUCTURA = `
  WITH t AS (
    SELECT c.oid, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> '_prisma_migrations')
  SELECT
    (SELECT count(*) FROM t)                                                     AS tablas,
    (SELECT count(*) FROM pg_type ty JOIN pg_namespace n ON n.oid = ty.typnamespace
      WHERE n.nspname = 'public' AND ty.typtype = 'e')                           AS enums,
    (SELECT count(*) FROM pg_class i JOIN pg_namespace n ON n.oid = i.relnamespace
      JOIN pg_index x ON x.indexrelid = i.oid
      WHERE n.nspname = 'public' AND i.relkind = 'i' AND x.indrelid IN (SELECT oid FROM t)) AS indices,
    (SELECT count(*) FROM pg_constraint k
      WHERE k.conrelid IN (SELECT oid FROM t))                                   AS constraints,
    (SELECT count(*) FROM pg_class c
      WHERE c.oid IN (SELECT oid FROM t) AND c.relrowsecurity)                   AS rls,
    (SELECT count(*) FROM pg_policy p WHERE p.polrelid IN (SELECT oid FROM t))   AS policies,
    (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
      WHERE n.nspname = 'public' AND pr.prokind IN ('f','p')
        AND NOT EXISTS (SELECT 1 FROM pg_depend d
                         WHERE d.classid = 'pg_proc'::regclass AND d.objid = pr.oid
                           AND d.objsubid = 0 AND d.refclassid = 'pg_extension'::regclass
                           AND d.deptype = 'e'))                                 AS funciones,
    (SELECT count(*) FROM pg_trigger tg
      WHERE tg.tgrelid IN (SELECT oid FROM t) AND NOT tg.tgisinternal)           AS triggers,
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'S')                            AS secuencias,
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND c.relname = '_prisma_migrations')                                    AS interno_prisma`;

/* Estado esperado tras aplicar el baseline completo, dentro de la tx. */
const ESPERADO_INTERMEDIO = {
  tablas: 89, enums: 54, indices: 326, constraints: 265,
  rls: 3, policies: 3, funciones: 0, triggers: 0, secuencias: 0,
};
const CLAVES = ["tablas", "enums", "indices", "constraints", "rls", "policies", "funciones", "triggers", "secuencias"];


let pool = null, cliente = null, salida = 1, enTransaccion = false;

try {
  console.log(`\n${L}\n FASE 3 — MODO B: fallo inyectado + ROLLBACK\n${L}\n`);

  console.log("1. PRE-FLIGHT LOCAL");
  E.preflightLocal();
  const A = JSON.parse((await import("node:fs")).readFileSync(E.RUTAS.A, "utf-8"));
  const nom = (x) => (typeof x === "string" ? x : (x.tabla ?? x.nombre));
  const tablasA = A.aplicacion.tablas.map(nom);
  const url = E.urlDeTest();

  console.log("\n2. IDENTIDAD DEL ENTORNO");
  pool = new pg.Pool({ connectionString: process.env.BASELINE_TEST_URL, max: 1 });
  cliente = await pool.connect();
  E.verificarSocket(cliente);
  await E.guardasPreDDL(cliente, url, tablasA);

  console.log("\n3. ESTADO INICIAL");
  await E.exigirPublicVacio(cliente, "public antes del DDL");

  console.log("\n4. BASELINE SQL (re-verificado antes del DDL)");
  const sql = E.leerBaselineVerificado("hash del baseline");

  const incompatibles = Object.entries(NO_TRANSACCIONAL).filter(([, re]) => re.test(sql)).map(([n]) => n);
  console.log(`   constructs no transaccionales: ${incompatibles.length ? "*** " + incompatibles.join(", ") + " ***" : "ninguno"}`);
  if (incompatibles.length)
    abortar(`el baseline contiene constructs que no pueden ejecutarse dentro de una transaccion: ${incompatibles.join(", ")}.\nLa estrategia de este modo no es aplicable.`);

  /* ---- 5-8. BEGIN -> baseline -> fallo -> ROLLBACK ---- */
  console.log("\n5. BEGIN");
  await cliente.query("BEGIN");
  enTransaccion = true;

  console.log("6. APLICANDO EL BASELINE COMPLETO (dentro de la transaccion)");
  const t0 = process.hrtime.bigint();
  await cliente.query(sql);
  console.log(`   aplicado en ${(Number(process.hrtime.bigint() - t0) / 1e6).toFixed(0)} ms`);

  /* Estado intermedio: no basta con "creo algunas tablas". Se exige
   * que el baseline haya llegado al estado COMPLETO esperado antes
   * de provocar el error; si no, la reversibilidad demostrada seria
   * la de un baseline aplicado a medias. */
  const dentro = (await cliente.query(SQL_ESTRUCTURA)).rows[0];
  console.log(`\n   ESTADO INTERMEDIO (dentro de la transaccion)`);
  console.log(`   ${"objeto".padEnd(14)}${"esperado".padStart(10)}${"observado".padStart(11)}`);
  const desajustes = [];
  for (const k of CLAVES) {
    const e = ESPERADO_INTERMEDIO[k], o = Number(dentro[k]);
    if (o !== e) desajustes.push(`${k}: esperado ${e}, observado ${o}`);
    console.log(`   ${k.padEnd(14)}${String(e).padStart(10)}${String(o).padStart(11)}  ${o === e ? "ok" : "*** DISTINTO ***"}`);
  }
  console.log(`   ${"_prisma_migrations".padEnd(14)}${"—".padStart(10)}${String(dentro.interno_prisma).padStart(11)}  (interno, fuera del universo funcional)`);
  if (Number(dentro.interno_prisma) !== 0)
    console.log("   AVISO: aparecio _prisma_migrations sin que este modo use Prisma. Se reporta aparte, no se oculta.");
  if (desajustes.length)
    abortar(`el baseline no alcanzo el estado esperado dentro de la transaccion:\n  ${desajustes.join("\n  ")}\n` +
            "La prueba de reversibilidad no seria concluyente sobre el baseline completo.");
  console.log("   El baseline alcanzo el estado completo esperado.");

  console.log("\n7. FALLO DELIBERADO");
  let falloOcurrio = false, mensajeFallo = "";
  try {
    await cliente.query(`DO $$ BEGIN RAISE EXCEPTION '${MARCA_FALLO}'; END $$`);
  } catch (e) {
    falloOcurrio = true;
    mensajeFallo = e.message;
  }
  console.log(`   fallo provocado: ${falloOcurrio ? "SI" : "NO"} — ${mensajeFallo || "(sin mensaje)"}`);
  if (!falloOcurrio) abortar("el fallo deliberado no se produjo; la prueba no seria valida.");
  if (!mensajeFallo.includes(MARCA_FALLO))
    abortar(`el error no es el inyectado por esta prueba: ${mensajeFallo}`);

  console.log("\n8. ROLLBACK");
  await cliente.query("ROLLBACK");
  enTransaccion = false;
  console.log("   ROLLBACK ejecutado.");

  /* ---- 9. Verificacion de residuos ----
   * MISMA consulta que el estado intermedio. Se exige cero en los
   * NUEVE conjuntos funcionales, no solo en tablas/enums/policies. */
  console.log("\n9. VERIFICACION DE RESIDUOS");
  const fuera = (await cliente.query(SQL_ESTRUCTURA)).rows[0];
  console.log(`   ${"objeto".padEnd(14)}${"en la tx".padStart(10)}${"tras ROLLBACK".padStart(15)}`);
  const residuos = [];
  for (const k of CLAVES) {
    const d = Number(dentro[k]), f = Number(fuera[k]);
    if (f !== 0) residuos.push(`${k}=${f}`);
    console.log(`   ${k.padEnd(14)}${String(d).padStart(10)}${String(f).padStart(15)}  ${f === 0 ? "ok" : "*** RESIDUO ***"}`);
  }
  console.log(`   ${"_prisma_migrations".padEnd(14)}${String(dentro.interno_prisma).padStart(10)}${String(fuera.interno_prisma).padStart(15)}  (interno, se reporta aparte)`);
  if (Number(fuera.interno_prisma) !== 0)
    console.log("   AVISO: _prisma_migrations persiste tras el ROLLBACK. No forma parte del universo funcional.");
  console.log("   baseline_guard: excluido de los conteos (infraestructura previa de seguridad).");

  const limpio = residuos.length === 0;

  console.log(`\n${L}\n MODO B: ${limpio ? "PASS" : "FAIL"}\n${L}`);
  if (limpio) {
    console.log("\n Condiciones verificadas:");
    console.log("   A. el estado intermedio demostro el baseline COMPLETO aplicado");
    console.log("   B. el fallo deliberado ocurrio");
    console.log("   C. el ROLLBACK se ejecuto");
    console.log("   D. los 9 conjuntos funcionales quedaron en cero");
    console.log("\n CONCLUSION (alcance exacto):");
    console.log("   El SQL del baseline es completamente reversible cuando se");
    console.log("   ejecuta dentro de una transaccion PostgreSQL explicita.");
    console.log("\n Lo que esta prueba NO demuestra:");
    console.log("   Nada sobre Prisma. Que `migrate deploy` envuelva cada");
    console.log("   migracion en una transaccion es comportamiento de Prisma y");
    console.log("   de su version instalada, y requiere una prueba propia.");
  } else {
    console.log(`\n Quedaron objetos funcionales tras el ROLLBACK: ${residuos.join(", ")}`);
    console.log(" El baseline NO es completamente reversible con esta estrategia.");
  }
  console.log("");
  salida = limpio ? 0 : 1;
} catch (e) {
  console.error(`\n${L}\n MODO B: ABORTADO\n${L}`);
  console.error(e instanceof Abortar ? e.message : `error inesperado: ${e.stack ?? e.message}`);
  salida = 1;
} finally {
  /* Si algo fallo con la transaccion abierta, revertir SIEMPRE:
   * nunca dejar el baseline a medio aplicar. */
  if (cliente && enTransaccion) {
    try { await cliente.query("ROLLBACK"); console.error("  ROLLBACK de seguridad ejecutado."); }
    catch (e) { console.error(`  *** no se pudo revertir: ${e.message} — revisa el estado de baseline_test ***`); }
  }
  try { cliente?.release(); } catch {}
  try { await pool?.end(); } catch {}
}
process.exit(salida);
