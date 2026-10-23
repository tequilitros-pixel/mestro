/* Pruebas locales de los ejecutores. Sin base de datos: se ejercita
 * lib-ejecutor con clientes falsos y se auditan los dos modos. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as E from "./lib-ejecutor.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let fallos = 0;
const ok = (c, d) => { console.log(`  ${c ? "PASA" : "*** FALLA ***"}  ${d}`); if (!c) fallos++; };
const cap = async (fn) => { try { await fn(); return null; } catch (e) { return e.message; } };

console.log("PRE-FLIGHT LOCAL");
{
  const m = await cap(async () => E.preflightLocal());
  ok(m === null, "con los artefactos oficiales presentes -> pasa");
  ok(E.HASHES.baseline === "276d5657f16642600fe612898221a360da23a56afc44829d59fd62a44bedccf5",
     "el hash del baseline exigido es el oficial");
}

console.log("\nURL: solo BASELINE_TEST_URL");
{
  const orig = process.env.BASELINE_TEST_URL;
  delete process.env.BASELINE_TEST_URL;
  let m = await cap(async () => E.urlDeTest());
  ok(m !== null && /falta BASELINE_TEST_URL/.test(m), "sin BASELINE_TEST_URL -> aborta");
  ok(!/fallback/i.test(m ?? ""), "no existe ningun fallback de URL");

  process.env.BASELINE_TEST_URL = "postgresql://u@ep-x.neon.tech/baseline_test?sslmode=require&channel_binding=require";
  m = await cap(async () => E.urlDeTest());
  ok(m !== null && /precondicion TLS/.test(m), "sslmode=require -> aborta antes de conectar");

  process.env.BASELINE_TEST_URL = "postgresql://u@ep-x.neon.tech/baseline_test?sslmode=verify-full";
  m = await cap(async () => E.urlDeTest());
  ok(m !== null && /channel_binding/.test(m), "falta channel_binding -> aborta");

  process.env.BASELINE_TEST_URL = "postgresql://u@ep-x.neon.tech/baseline_test?sslmode=verify-full&channel_binding=require";
  m = await cap(async () => E.urlDeTest());
  ok(m === null, "verify-full + channel_binding=require -> pasa");
  if (orig === undefined) delete process.env.BASELINE_TEST_URL; else process.env.BASELINE_TEST_URL = orig;
}

console.log("\nTLS DEL SOCKET");
{
  const soc = (o) => ({ connection: { stream: o } });
  ok((await cap(async () => E.verificarSocket(soc({ encrypted: true, authorized: true, getProtocol: () => "TLSv1.3" })))) === null,
     "cifrada + autorizado -> pasa");
  ok((await cap(async () => E.verificarSocket(soc({ encrypted: false, authorized: true })))) !== null, "sin cifrar -> aborta");
  ok((await cap(async () => E.verificarSocket(soc({ encrypted: true, authorized: false })))) !== null, "cert no autorizado -> aborta");
  ok((await cap(async () => E.verificarSocket(soc({ encrypted: true, authorized: true, authorizationError: "self signed" })))) !== null,
     "error de certificado -> aborta");
}

console.log("\npublic VACIO (exigido por cada modo)");
{
  const cli = (t, e, p) => ({ query: async (sql) => {
    if (/^BEGIN|^ROLLBACK/.test(sql.trim())) return { rows: [] };
    return { rows: [{ tablas: String(t), enums: String(e), policies: String(p) }] };
  } });
  ok((await cap(async () => E.exigirPublicVacio(cli(0, 0, 0), "test"))) === null, "0/0/0 -> pasa");
  const m = await cap(async () => E.exigirPublicVacio(cli(89, 54, 3), "test"));
  ok(m !== null && /NO esta vacio/.test(m), "base llena -> aborta");
  ok(/NO se hace limpieza automatica/.test(m ?? ""), "declara que NO limpia automaticamente");
  ok((await cap(async () => E.exigirPublicVacio(cli(0, 2, 0), "test"))) !== null, "enums residuales -> aborta");
}

console.log("\nHASH DEL BASELINE");
{
  ok((await cap(async () => E.leerBaselineVerificado("test"))) === null, "hash oficial -> pasa");
  const bak = E.HASHES.baseline;
  E.HASHES.baseline = "0".repeat(64);
  const m = await cap(async () => E.leerBaselineVerificado("test"));
  ok(m !== null && /el baseline SQL cambio/.test(m), "hash distinto -> aborta");
  E.HASHES.baseline = bak;
}

console.log("\nGUARDAS: sin 8/8 no hay DDL");
{
  const cli = (marcadorOk) => ({ query: async (sql) => {
    const t = sql.trim();
    if (/^BEGIN|^ROLLBACK|^SAVEPOINT|^RELEASE|^ROLLBACK TO/.test(t)) return { rows: [] };
    if (/transaction_read_only/.test(t)) return { rows: [{ transaction_read_only: "on" }] };
    if (/current_database/.test(t)) return { rows: [{ db: "baseline_test" }] };
    if (/hay_esquema/.test(t)) return { rows: [{ hay_esquema: "1", hay_tabla: "1", hay_columna: marcadorOk ? "1" : "0" }] };
    if (/environment_marker/.test(t)) return { rows: [{ valor: "baseline_test_fase3" }] };
    if (/relname AS tabla/.test(t)) return { rows: [] };
    if (/typtype='e'/.test(t)) return { rows: [{ tablas: "0", enums: "0", policies: "0" }] };
    return { rows: [] };
  } });
  const url = new URL("postgresql://u@ep-libre.neon.tech/baseline_test?sslmode=verify-full&channel_binding=require");
  ok((await cap(async () => E.guardasPreDDL(cli(true), url, ["User"]))) === null, "8/8 -> continua");
  const m = await cap(async () => E.guardasPreDDL(cli(false), url, ["User"]));
  ok(m !== null && /NO se autoriza ningun DDL/.test(m), "una guarda FAIL -> aborta antes del DDL");
}

console.log("\nAUDITORIA DE LOS DOS MODOS");
{
  const A = fs.readFileSync(path.join(__dirname, "fase3-modo-a.mjs"), "utf8");
  const B = fs.readFileSync(path.join(__dirname, "fase3-modo-b.mjs"), "utf8");
  for (const [n, src] of [["MODO A", A], ["MODO B", B]]) {
    ok(!/process\.env\.DATABASE_URL/.test(src), `${n}: nunca accede a process.env.DATABASE_URL`);
    ok(/BASELINE_TEST_URL/.test(src), `${n}: usa BASELINE_TEST_URL`);
    ok(!/\bprisma\b/i.test(src.replace(/_prisma_migrations|interno_prisma|interno Prisma|Prisma\b/g, "")),
       `${n}: no invoca Prisma`);
    /* El patron aparece en comentarios que declaran que NO se usa.
     * Lo que importa es que no haya INVOCACION: se auditan las
     * llamadas a execFileSync/spawn/exec y su primer argumento. */
    const invocaciones = [...src.matchAll(/(execFileSync|execSync|spawnSync|spawn|exec)\s*\(\s*"([^"]+)"/g)]
      .map((m) => m[2]);
    ok(!invocaciones.some((c) => /prisma|npx|npm|yarn|pnpm/i.test(c)),
       `${n}: no invoca prisma/npx/npm (procesos: ${invocaciones.join(", ") || "ninguno"})`);
    /* Se excluyen comentarios Y literales impresos: un console.log que
     * dice "sin migrate deploy" no es una invocacion. Lo que se audita
     * son sentencias ejecutables. */
    const ejecutable = src.split("\n")
      .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
      .filter((l) => !/^\s*console\.(log|error)\(/.test(l))
      .join("\n");
    ok(!/migrate\s+deploy|migrate\s+dev|db\s+push/.test(ejecutable),
       `${n}: ningun comando de migracion en codigo ejecutable`);
    ok(!/DROP\s+SCHEMA|DROP\s+TABLE|TRUNCATE/i.test(src), `${n}: no contiene limpieza destructiva`);
    ok(/E\.guardasPreDDL\(/.test(src), `${n}: invoca PRE_DDL antes del DDL`);
    ok(/leerBaselineVerificado/.test(src), `${n}: re-verifica el hash del baseline`);
    ok(/exigirPublicVacio/.test(src), `${n}: exige su propio estado inicial vacio`);
  }
  ok(/E\.guardasPostCommit\(/.test(A), "MODO A: invoca POST_COMMIT después del COMMIT");
  ok(!/E\.guardasPostCommit\(/.test(B), "MODO B: no usa POST_COMMIT");
  ok(/entornoMinimo/.test(A), "MODO A: pasa un entorno acotado al subproceso de captura");
  ok(!/DO \$\$ BEGIN RAISE EXCEPTION/.test(A), "MODO A: no inyecta fallos");
  ok(/DO \$\$ BEGIN RAISE EXCEPTION/.test(B), "MODO B: inyecta el fallo deliberado");
  ok(/ROLLBACK de seguridad/.test(B), "MODO B: revierte tambien ante error inesperado");
  ok(/no demuestra|NO demuestra/.test(B) && /Prisma/.test(B), "MODO B: acota la conclusion respecto a Prisma");
  ok(/ESPERADO_INTERMEDIO/.test(B) && /desajustes\.length/.test(B),
     "MODO B: exige el estado intermedio COMPLETO antes del fallo (no solo 'algunas tablas')");
  ok(/const CLAVES = \[[^\]]*"constraints"[^\]]*"rls"[^\]]*"triggers"/.test(B),
     "MODO B: verifica constraints, RLS y triggers tras el ROLLBACK");
}

console.log(`\n${"=".repeat(56)}\n${fallos === 0 ? "EJECUTORES: TODAS LAS PRUEBAS PASAN" : fallos + " FALLOS"}\n${"=".repeat(56)}`);
process.exit(fallos ? 1 : 0);
