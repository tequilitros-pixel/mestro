/*
 * Pre-flight de Fase 3. SIN conexion, SIN DDL, SIN escritura.
 * Verifica que todo el instrumental esta congelado en sus hashes
 * oficiales antes de permitir cualquier paso posterior.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import { extraerConsultas, comparar } from "./fase3-pruebas-consultas.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* Rutas ancladas al ARCHIVO, no al cwd: el script debe funcionar
 * igual invocado desde la raiz del repo o desde fase3/. */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const R = (...p) => path.join(ROOT, ...p);
const F = (...p) => path.join(__dirname, ...p);


const OFICIALES = {
  [R(".tmp-baseline/manifest-production.json")]:         "a77609f4e294ffddd2265b5baa035c233fe5f1bc6f0b9203bcd1a11bc8caf315",
  [R(".tmp-baseline/manifest-proposed-additions.json")]: "7486541989ceeb35b2d9907b63e3714800280490f1d9cd81ef8a2d1b28d8f3bd",
  [R(".tmp-baseline/manifest-baseline-expected.json")]:  "0e2f0bdd928cc070d883dcce690fb2c511cb884614ae5801edd34f2bbda525d6",
  [R("capturar-manifiesto.mjs")]:                        "aa2462afe19b9d695e955a5e03420a104beb8d827667eb24a799039ef21de65f",
};
const BASELINE = R(".tmp-baseline/propuesta/00000000000000_baseline_current_schema/migration.sql");
/* Constructs que NO pueden ejecutarse dentro de un bloque transaccional. */
const NO_TRANSACCIONAL = {
  "CREATE INDEX CONCURRENTLY": /CREATE\s+INDEX\s+CONCURRENTLY/i,
  "DROP INDEX CONCURRENTLY": /DROP\s+INDEX\s+CONCURRENTLY/i,
  "VACUUM": /^\s*VACUUM\b/im,
  "CREATE DATABASE": /CREATE\s+DATABASE/i,
  "CREATE TABLESPACE": /CREATE\s+TABLESPACE/i,
  "ALTER SYSTEM": /ALTER\s+SYSTEM/i,
  "REINDEX CONCURRENTLY": /REINDEX[\s\S]{0,40}CONCURRENTLY/i,
};

const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
let fallos = 0;
const ok = (c, d) => { console.log(`  ${c ? "ok   " : "FALLA"}  ${d}`); if (!c) fallos++; };

console.log("PRE-FLIGHT FASE 3 — sin conexion, sin DDL\n");
/* Fail-closed: si falta un archivo obligatorio se reporta y se sale
 * limpiamente. Antes el flujo seguia hasta extraerConsultas() y
 * moria con un ENOENT crudo. */
const OBLIGATORIOS = [...Object.keys(OFICIALES), BASELINE, F("capturar-baseline-test.mjs")];
const ausentes = OBLIGATORIOS.filter((f) => !fs.existsSync(f));
if (ausentes.length) {
  console.log("0. Archivos obligatorios");
  for (const f of ausentes) console.log(`  FALLA  NO EXISTE: ${path.relative(ROOT, f)}`);
  console.log(`\n${"=".repeat(56)}\nPRE-FLIGHT: FAIL (${ausentes.length} archivo(s) ausente(s))\n${"=".repeat(56)}`);
  process.exit(1);
}

console.log(`raiz del proyecto: ${ROOT}\n`);
console.log("1. Hashes oficiales");
for (const [ruta, esperado] of Object.entries(OFICIALES)) {
  const real = sha(ruta);
  ok(real === esperado, `${path.basename(ruta)}: ${real === esperado ? real.slice(0, 16) + "..." : `\n         esperado ${esperado}\n         real     ${real}`}`);
}

console.log("\n2. Baseline SQL");
{
  const b = fs.readFileSync(BASELINE, "utf-8");
  const h = sha(BASELINE);
  console.log(`  ruta   : ${path.relative(ROOT, BASELINE)}`);
  console.log(`  sha256 : ${h}`);
  console.log(`  bytes  : ${Buffer.byteLength(b)}`);
  console.log(`  lineas : ${b.split("\n").length}`);
  console.log("  (este hash debe re-verificarse justo antes del DDL; si cambia -> ABORTA)");

  console.log("\n3. Constructs incompatibles con la estrategia transaccional");
  const hallados = Object.entries(NO_TRANSACCIONAL).filter(([, re]) => re.test(b)).map(([n]) => n);
  ok(hallados.length === 0, hallados.length ? `PRESENTES: ${hallados.join(", ")}` : `ninguno de los ${Object.keys(NO_TRANSACCIONAL).length} constructs vigilados`);
}

console.log("\n4. Igualdad de las 13 consultas (oficial vs baseline_test)");
const A = extraerConsultas(R("capturar-manifiesto.mjs"));
const B = extraerConsultas(F("capturar-baseline-test.mjs"));
const r = comparar(A, B);
ok(A.size === 13 && B.size === 13, `13 consultas en ambos (${A.size} / ${B.size})`);
ok(r.soloA.length === 0 && r.soloB.length === 0, "mismos nombres");
ok(r.distintas.length === 0, `byte a byte identicas (divergentes: ${r.distintas.join(", ") || "ninguna"})`);

console.log(`\n${"=".repeat(56)}\nPRE-FLIGHT: ${fallos === 0 ? "PASS" : "FAIL (" + fallos + ")"}\n${"=".repeat(56)}`);
process.exit(fallos ? 1 : 0);
