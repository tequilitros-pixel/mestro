/*
 * Rutina comun a MODO A y MODO B: pre-flight local, verificacion
 * conectada de las 8 guardas, y re-verificacion del hash del
 * baseline inmediatamente antes del DDL.
 *
 * Existe una sola vez para que ambos modos compartan exactamente
 * las mismas barreras: si estuviera duplicada, podrian divergir.
 *
 * NUNCA lee DATABASE_URL. Solo BASELINE_TEST_URL.
 * No hace limpieza automatica de public. No usa produccion como
 * fallback bajo ninguna circunstancia.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verificarPreDDL, verificarPostCommit, verificarParametrosTLS, TLS_REQUERIDO, shaTexto, endpointBase } from "./lib-identidad.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");
export const R = (...p) => path.join(ROOT, ...p);
export const F = (...p) => path.join(__dirname, ...p);

export const RUTAS = {
  A: R(".tmp-baseline/manifest-production.json"),
  C: R(".tmp-baseline/manifest-baseline-expected.json"),
  baseline: R(".tmp-baseline/propuesta/00000000000000_baseline_current_schema/migration.sql"),
};
export const HASHES = {
  A: "a77609f4e294ffddd2265b5baa035c233fe5f1bc6f0b9203bcd1a11bc8caf315",
  C: "0e2f0bdd928cc070d883dcce690fb2c511cb884614ae5801edd34f2bbda525d6",
  baseline: "276d5657f16642600fe612898221a360da23a56afc44829d59fd62a44bedccf5",
};

export const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
export const shaArchivo = (p) => sha(fs.readFileSync(p));
export const L = "=".repeat(60);

export class Abortar extends Error {}
export const abortar = (msg) => { throw new Abortar(msg); };

/* ---------- 1. Pre-flight local (sin conexion) ---------- */
export function preflightLocal() {
  const faltan = Object.entries(RUTAS).filter(([, p]) => !fs.existsSync(p)).map(([k, p]) => `${k}: ${path.relative(ROOT, p)}`);
  if (faltan.length) abortar(`faltan archivos obligatorios:\n  ${faltan.join("\n  ")}`);

  const reales = {};
  for (const [k, p] of Object.entries(RUTAS)) {
    reales[k] = shaArchivo(p);
    if (reales[k] !== HASHES[k])
      abortar(`el hash de ${k} no es el oficial.\n  esperado: ${HASHES[k]}\n  real    : ${reales[k]}`);
  }
  console.log("  pre-flight local:");
  for (const [k, v] of Object.entries(reales)) console.log(`    ${k.padEnd(9)} ${v.slice(0, 16)}... ok`);
  return reales;
}

/* ---------- 2. URL: solo BASELINE_TEST_URL ---------- */
export function urlDeTest() {
  if (process.env.BASELINE_TEST_URL === undefined)
    abortar("falta BASELINE_TEST_URL.\nEste script NUNCA usa la variable de produccion.");
  let url;
  try { url = new URL(process.env.BASELINE_TEST_URL); }
  catch { abortar("BASELINE_TEST_URL no es una URL valida."); }

  const tls = verificarParametrosTLS(url);
  if (!tls.ok)
    abortar(`BASELINE_TEST_URL no cumple la precondicion TLS:\n  ${tls.problemas.join("\n  ")}\n` +
            `Requerido: ${Object.entries(TLS_REQUERIDO).map(([k, v]) => `${k}=${v}`).join(" y ")}\n` +
            "No se abrio ninguna conexion. Corrige la URL manualmente.");
  console.log(`  precondicion TLS: sslmode=${url.searchParams.get("sslmode")} channel_binding=${url.searchParams.get("channel_binding")}`);
  console.log(`  sha hostname    : ${shaTexto(url.hostname).slice(0, 16)}...`);
  console.log(`  sha endpoint    : ${shaTexto(endpointBase(url.hostname)).slice(0, 16)}...`);
  return url;
}

/* ---------- 3. TLS del socket ---------- */
export function verificarSocket(cliente) {
  const s = cliente.connection?.stream;
  const info = {
    cifrada: s?.encrypted === true,
    autorizado: s?.authorized === true,
    errorCert: s?.authorizationError || null,
    protocolo: typeof s?.getProtocol === "function" ? s.getProtocol() : null,
  };
  console.log(`  TLS: cifrada=${info.cifrada} autorizado=${info.autorizado} errorCert=${info.errorCert ?? "(ninguno)"} ${info.protocolo ?? ""}`);
  if (!info.cifrada || !info.autorizado || info.errorCert)
    abortar("la conexion TLS no esta cifrada o el certificado no esta autorizado.");
  return info;
}

/* ---------- 4. PERFIL PRE_DDL, dentro de BEGIN READ ONLY ---------- */
export async function guardasPreDDL(cliente, url, tablasA) {
  await cliente.query("BEGIN READ ONLY");
  let r;
  try {
    const modo = (await cliente.query("SHOW transaction_read_only")).rows[0];
    if (String(Object.values(modo)[0]).toLowerCase() !== "on")
      abortar("la transaccion de verificacion no es de solo lectura.");
    r = await verificarPreDDL(cliente, url, tablasA);
  } finally {
    await cliente.query("ROLLBACK");
  }

  console.log(`\n  LAS 8 GUARDAS\n  ${"-".repeat(56)}`);
  r.guardas.forEach((g, i) =>
    console.log(`  ${i + 1}. ${(g.estado ?? (g.ok ? "PASS" : "FAIL")).padEnd(5)} ${g.nombre}\n         ${g.detalle}`));
  console.log(`  ${"-".repeat(56)}`);
  console.log(`  ${r.guardas.filter((g) => g.ok).length}/${r.guardas.length} guardas superadas`);

  if (!r.ok) abortar("la identidad del entorno no esta verificada. NO se autoriza ningun DDL.");
  return r;
}

/* ---------- PERFIL POST_COMMIT, sin guardas de vacio ---------- */
export async function guardasPostCommit(cliente, url) {
  await cliente.query("BEGIN READ ONLY");
  let r;
  try {
    const modo = (await cliente.query("SHOW transaction_read_only")).rows[0];
    if (String(Object.values(modo)[0]).toLowerCase() !== "on")
      abortar("la transaccion de verificacion no es de solo lectura.");
    r = await verificarPostCommit(cliente, url);
  } finally {
    await cliente.query("ROLLBACK");
  }
  console.log(`\n  PERFIL POST_COMMIT\n  ${"-".repeat(56)}`);
  r.guardas.forEach((g, i) =>
    console.log(`  ${i + 1}. ${(g.estado ?? (g.ok ? "PASS" : "FAIL")).padEnd(5)} ${g.nombre}\n         ${g.detalle}`));
  console.log(`  ${"-".repeat(56)}`);
  console.log(`  ${r.guardas.filter((g) => g.ok).length}/${r.guardas.length} guardas superadas`);
  if (!r.ok) abortar("el estado POST_COMMIT no coincide con el baseline construido.");
  return r;
}

/* ---------- 5. public vacio, comprobado de nuevo ---------- */
export async function exigirPublicVacio(cliente, etiqueta) {
  await cliente.query("BEGIN READ ONLY");
  let f;
  try {
    f = (await cliente.query(
      `SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                WHERE n.nspname='public' AND c.relkind='r') AS tablas,
              (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
                WHERE n.nspname='public' AND t.typtype='e') AS enums,
              (SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
                JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public') AS policies`)).rows[0];
  } finally {
    await cliente.query("ROLLBACK");
  }
  const vacio = Number(f.tablas) === 0 && Number(f.enums) === 0 && Number(f.policies) === 0;
  console.log(`  ${etiqueta}: ${f.tablas} tablas, ${f.enums} enums, ${f.policies} policies -> ${vacio ? "VACIO" : "NO VACIO"}`);
  if (!vacio)
    abortar(`public NO esta vacio (${f.tablas} tablas, ${f.enums} enums, ${f.policies} policies).\n` +
            "Este modo exige su propio estado inicial vacio. NO se hace limpieza automatica:\n" +
            "vacia la base manualmente o usa un entorno limpio.");
  return f;
}

/* ---------- 6. Hash del baseline justo antes del DDL ---------- */
export function leerBaselineVerificado(etiqueta) {
  const bytes = fs.readFileSync(RUTAS.baseline);
  const h = sha(bytes);
  console.log(`  ${etiqueta}: ${h.slice(0, 16)}... ${h === HASHES.baseline ? "ok" : "*** DISTINTO ***"}`);
  if (h !== HASHES.baseline)
    abortar(`el baseline SQL cambio.\n  esperado: ${HASHES.baseline}\n  real    : ${h}`);
  return bytes.toString("utf-8");
}
