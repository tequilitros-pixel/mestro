/*
 * Demuestra que las 13 consultas del capturador oficial y las del
 * capturador de baseline_test son BYTE A BYTE identicas.
 * Sin esto, una diferencia observada podria venir del instrumento
 * y no del esquema.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* Rutas ancladas al ARCHIVO, no al cwd: el script debe funcionar
 * igual invocado desde la raiz del repo o desde fase3/. */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const R = (...p) => path.join(ROOT, ...p);
const F = (...p) => path.join(__dirname, ...p);


const OFICIAL = R("capturar-manifiesto.mjs");
const TEST = F("capturar-baseline-test.mjs");

export function extraerConsultas(ruta) {
  const s = fs.readFileSync(ruta, "utf8");
  const out = new Map();
  const re = /^\s{2}([a-z_][a-z0-9_]*):\s*`/gim;
  let m;
  while ((m = re.exec(s)) !== null) {
    const ini = re.lastIndex;
    let i = ini;
    while (i < s.length) {
      if (s[i] === "\\") { i += 2; continue; }
      if (s[i] === "`") break;
      i++;
    }
    out.set(m[1], s.slice(ini, i));
  }
  return out;
}

export function comparar(a, b) {
  const identicas = [], distintas = [], soloA = [], soloB = [];
  for (const [k, v] of a) {
    if (!b.has(k)) soloA.push(k);
    else if (b.get(k) === v) identicas.push(k);
    else distintas.push(k);
  }
  for (const k of b.keys()) if (!a.has(k)) soloB.push(k);
  return { identicas, distintas, soloA, soloB };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let fallos = 0;
  const ok = (c, d) => { console.log(`  ${c ? "PASA" : "*** FALLA ***"}  ${d}`); if (!c) fallos++; };

  console.log("PRUEBA POSITIVA — oficial vs test");
  for (const f of [OFICIAL, TEST]) if (!fs.existsSync(f)) {
    console.error(`FAIL: no existe ${path.relative(ROOT, f)}`); process.exit(1);
  }
  const A = extraerConsultas(OFICIAL), B = extraerConsultas(TEST);
  const r = comparar(A, B);
  ok(A.size === 13, `oficial tiene 13 consultas (${A.size})`);
  ok(B.size === 13, `test tiene 13 consultas (${B.size})`);
  ok(r.soloA.length === 0 && r.soloB.length === 0, `mismos nombres (solo en oficial: ${r.soloA.length}, solo en test: ${r.soloB.length})`);
  ok(r.distintas.length === 0, `contenido byte a byte identico (distintas: ${r.distintas.join(", ") || "ninguna"})`);
  ok(r.identicas.length === 13, `13 de 13 identicas (${r.identicas.length})`);
  console.log(`     nombres: ${[...A.keys()].join(", ")}`);

  console.log("\nPRUEBA NEGATIVA — una consulta alterada en un fixture");
  const tmp = "/tmp/fixture-capturador-alterado.mjs";
  const orig = fs.readFileSync(TEST, "utf8");
  const alterado = orig.replace("ORDER BY c.relname, p.polname", "ORDER BY p.polname, c.relname");
  if (alterado === orig) { ok(false, "el fixture no pudo alterarse"); }
  else {
    fs.writeFileSync(tmp, alterado);
    const r2 = comparar(A, extraerConsultas(tmp));
    ok(r2.distintas.length > 0, `detecta la divergencia (distintas: ${r2.distintas.join(", ")})`);
    ok(r2.identicas.length === 12, `12 identicas, 1 alterada (${r2.identicas.length})`);
    fs.rmSync(tmp, { force: true });
  }
  console.log(`\n${fallos === 0 ? "PRUEBAS DE CONSULTAS: TODAS PASAN" : fallos + " FALLOS"}`);
  process.exit(fallos ? 1 : 0);
}
