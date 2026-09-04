/*
 * ============================================================
 * VERIFICACION CONECTADA DE IDENTIDAD  —  baseline_test
 * ============================================================
 * ESTRICTAMENTE SOLO LECTURA.
 *
 *   BEGIN READ ONLY  ->  8 guardas  ->  ROLLBACK  (siempre)
 *
 * El ROLLBACK se ejecuta tambien cuando una guarda falla y cuando
 * se lanza una excepcion: va en el bloque finally, no en el camino
 * feliz. PostgreSQL ademas rechazaria cualquier escritura dentro de
 * una transaccion READ ONLY, asi que hay dos barreras.
 *
 * NO emite DDL. NO invoca Prisma. NO aplica migraciones.
 * NO lee DATABASE_URL: esa variable apunta a produccion.
 *
 * No imprime URL, contrasena, usuario ni hostname completo. El
 * hostname solo aparece como digest SHA-256 truncado.
 * ============================================================
 */
import crypto from "node:crypto";
import pg from "pg";
import { verificarPreDDL, ENV_ESPERADO, shaTexto, endpointBase, verificarParametrosTLS, TLS_REQUERIDO } from "./lib-identidad.mjs";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const A_PATH = path.join(ROOT, ".tmp-baseline/manifest-production.json");
const A_SHA = "a77609f4e294ffddd2265b5baa035c233fe5f1bc6f0b9203bcd1a11bc8caf315";

const L = "=".repeat(58);
let salida = 1;

/* ---- Manifiesto A: fuente de las 87 tablas para la guarda 7 ---- */
if (!existsSync(A_PATH)) {
  console.error(`ABORTADO: no existe ${path.relative(ROOT, A_PATH)}`);
  process.exit(1);
}
const bytesA = readFileSync(A_PATH);
const shaA = crypto.createHash("sha256").update(bytesA).digest("hex");
if (shaA !== A_SHA) {
  console.error(`ABORTADO: el manifiesto A no es el oficial.\n  esperado ${A_SHA}\n  real     ${shaA}`);
  process.exit(1);
}
const A = JSON.parse(bytesA.toString("utf-8"));
const nom = (x) => (typeof x === "string" ? x : (x.tabla ?? x.nombre));
const TABLAS_A = A.aplicacion.tablas.map(nom);

/* ---- URL: exclusivamente BASELINE_TEST_URL ---- */
if (process.env.BASELINE_TEST_URL === undefined) {
  console.error("ABORTADO: falta BASELINE_TEST_URL.");
  console.error("Este script NUNCA usa DATABASE_URL: esa variable apunta a produccion.");
  process.exit(1);
}
let url;
try { url = new URL(process.env.BASELINE_TEST_URL); }
catch { console.error("ABORTADO: BASELINE_TEST_URL no es una URL valida."); process.exit(1); }

/* Precondicion TLS: se exige ANTES de abrir la conexion. La URL no
 * se altera automaticamente; si falta un parametro se aborta y lo
 * corrige el operador. */
const tlsParams = verificarParametrosTLS(url);
if (!tlsParams.ok) {
  console.error("\nABORTADO: BASELINE_TEST_URL no cumple la precondicion TLS.");
  for (const p of tlsParams.problemas) console.error(`  - ${p}`);
  console.error(`Requerido: ${Object.entries(TLS_REQUERIDO).map(([k, v]) => `${k}=${v}`).join(" y ")}`);
  console.error("No se abrio ninguna conexion. Corrige la URL manualmente.");
  process.exit(1);
}

console.log(`\n${L}\n VERIFICACION DE IDENTIDAD — baseline_test\n${L}`);
console.log(`  precondicion TLS : sslmode=${url.searchParams.get("sslmode")} channel_binding=${url.searchParams.get("channel_binding")}`);
console.log(`  manifiesto A     : ${shaA.slice(0, 16)}... (oficial)`);
console.log(`  tablas de A      : ${TABLAS_A.length}`);
console.log(`  sha hostname     : ${shaTexto(url.hostname).slice(0, 16)}...`);
console.log(`  sha endpoint base: ${shaTexto(endpointBase(url.hostname)).slice(0, 16)}...`);
console.log(`  marcador esperado: ${ENV_ESPERADO.esquemaGuardia}.${ENV_ESPERADO.tablaMarcador} = ${ENV_ESPERADO.valorMarcador}`);

const pool = new pg.Pool({ connectionString: process.env.BASELINE_TEST_URL, max: 1 });
let cliente = null;
let abierta = false;

try {
  cliente = await pool.connect();

  const s = cliente.connection?.stream;
  console.log(`  TLS              : cifrada=${s?.encrypted === true} autorizado=${s?.authorized === true} errorCert=${s?.authorizationError || "(ninguno)"} ${typeof s?.getProtocol === "function" ? s.getProtocol() : ""}`);
  if (s?.encrypted !== true || s?.authorized !== true) throw new Error("la conexion TLS no esta cifrada o el certificado no esta autorizado");

  await cliente.query("BEGIN READ ONLY");
  abierta = true;
  console.log("\n  BEGIN READ ONLY ejecutado.");

  /* Confirmacion de que la transaccion es de solo lectura, leyendo
   * el estado del servidor. No se intenta ninguna escritura de
   * prueba: este script no emite CREATE/ALTER/DROP/INSERT/UPDATE/
   * DELETE/TRUNCATE en ninguna circunstancia. */
  const modo = (await cliente.query("SHOW transaction_read_only")).rows[0];
  const readOnlyConfirmado = String(Object.values(modo)[0]).toLowerCase() === "on";
  console.log(`  transaction_read_only = ${Object.values(modo)[0]}`);
  if (!readOnlyConfirmado) throw new Error("la transaccion no es de solo lectura; se aborta por precaucion");

  const r = await verificarPreDDL(cliente, url, TABLAS_A);

  console.log(`\n  LAS 8 GUARDAS\n  ${"-".repeat(54)}`);
  r.guardas.forEach((g, i) => console.log(`  ${i + 1}. ${(g.estado ?? (g.ok ? "PASS" : "FAIL")).padEnd(5)} ${g.nombre}\n         ${g.detalle}`));
  const nErr = r.guardas.filter((g) => g.estado === "ERROR").length;
  if (nErr) console.log(`\n  ${nErr} guarda(s) en ERROR: no se pudieron comprobar (no equivale a FAIL estructural).`);

  console.log(`\n  ${"-".repeat(54)}`);
  console.log(`  Resultado: ${r.guardas.filter((g) => g.ok).length}/${r.guardas.length} guardas superadas`);

  if (r.ok) {
    console.log(`\n${L}\n IDENTIDAD VERIFICADA: el entorno es inequivocamente baseline_test\n${L}`);
    salida = 0;
  } else {
    console.log(`\n${L}\n IDENTIDAD NO VERIFICADA — NO se autoriza ningun DDL\n${L}`);
    salida = 1;
  }
} catch (e) {
  console.error(`\nABORTADO: ${e.message}`);
  salida = 1;
} finally {
  /* ROLLBACK SIEMPRE: guarda fallida, excepcion o exito. */
  if (cliente && abierta) {
    try { await cliente.query("ROLLBACK"); console.log("\n  ROLLBACK ejecutado."); }
    catch (e) { console.error(`  *** no se pudo hacer ROLLBACK: ${e.message} ***`); }
  }
  try { cliente?.release(); } catch {}
  try { await pool.end(); } catch {}
}

process.exit(salida);
