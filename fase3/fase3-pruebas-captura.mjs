/*
 * Verifica que capturar-baseline-test.mjs no solo EJECUTA las 13
 * consultas, sino que el resultado de cada una llega efectivamente
 * al JSON. Una consulta ejecutada cuyo resultado se descarta seria
 * una perdida silenciosa: la comparacion contra C creeria que la
 * seccion esta vacia en la base.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, "capturar-baseline-test.mjs"), "utf8");
const cuerpo = src.slice(src.indexOf("Captura en un solo snapshot"));
const nombres = [...src.matchAll(/^\s{2}([a-z_]+):\s*`/gim)].map((m) => m[1]);

let fallos = 0;
const ok = (c, d) => { console.log(`  ${c ? "PASA" : "*** FALLA ***"}  ${d}`); if (!c) fallos++; };

/* Rastrea el destino del resultado de Q.<n>, cubriendo los tres
 * estilos de asignacion que usa el capturador:
 *   directo    M.x = await filas(Q.n)
 *   en linea   M.x = (await filas(Q.n)).map(...)
 *   via var    const v = await filas(Q.n) ... M.x = ...v...  (o un for sobre v) */
function destinoDe(n) {
  const directo = cuerpo.match(new RegExp(`(M\\.[\\w.]+)\\s*=\\s*\\(?await\\s+filas\\(Q\\.${n}\\b`));
  if (directo) return [directo[1]];
  /* Cubre tambien la declaracion multiple:
   *   const a = await filas(Q.x), b = await filas(Q.y), c = ... */
  const via = cuerpo.match(new RegExp(`(\\w+)\\s*=\\s*\\(?await\\s+filas\\(Q\\.${n}(?:,\\s*[^)]*)?\\)\\)?`));
  if (via) {
    const v = via[1];
    const asign = [...cuerpo.matchAll(new RegExp(`(M\\.[\\w.]+)\\s*=[^;\\n]*\\b${v}\\b`, "g"))].map((m) => m[1]);
    // bucle:  for (const r of <v>) (M.enums[...] ??= []).push(...)
    const bucle = cuerpo.match(new RegExp(`for\\s*\\([^)]*\\bof\\s+${v}\\s*\\)[^\\n]*?(M\\.[\\w.]+)`));
    const todos = [...asign, ...(bucle ? [bucle[1].split("[")[0]] : [])];
    return todos.length ? [...new Set(todos)] : null;
  }
  return null;
}

console.log("COBERTURA: las 13 consultas y su destino en el JSON");
ok(nombres.length === 13, `13 consultas definidas (${nombres.length})`);
console.log(`\n  ${"consulta".padEnd(13)} ejecuta  destino`);
const sinDestino = [];
for (const n of nombres) {
  const ejecuta = new RegExp(`Q\\.${n}\\b`).test(cuerpo);
  const dest = destinoDe(n);
  if (!ejecuta || !dest) sinDestino.push(n);
  console.log(`  ${n.padEnd(13)} ${ejecuta ? "SI " : "NO "}     ${dest ? dest.join(", ") : "*** DESCARTADO ***"}`);
}
ok(sinDestino.length === 0, `ninguna consulta se ejecuta y se descarta (${sinDestino.join(", ") || "ninguna"})`);

console.log("\nCOLECCIONES REQUERIDAS PARA COMPARAR CONTRA C");
const requeridas = {
  "tablas": /M\.aplicacion\.tablas\s*=/,
  "columnas": /M\.aplicacion\.columnas\s*=/,
  "constraints": /M\.aplicacion\.constraints\s*=/,
  "indices": /M\.aplicacion\.indices\s*=/,
  "enums": /M\.enums\s*=/,
  "secuencias": /M\.secuencias\s*=/,
  "rls": /M\.aplicacion\.rls\s*=/,
  "policies": /M\.aplicacion\.policies\s*=/,
  "funciones": /M\.aplicacion\.funciones\s*=/,
  "triggers": /M\.aplicacion\.triggers\s*=/,
};
for (const [n, re] of Object.entries(requeridas)) ok(re.test(cuerpo), `M contiene '${n}'`);

console.log("\nINTERNO PRISMA SEPARADO");
for (const n of ["tablas", "columnas", "constraints", "indices", "triggers"])
  ok(new RegExp(`M\\.interno_prisma\\.${n}\\s*=`).test(cuerpo), `interno_prisma.${n} se separa`);
ok(/TABLAS_PRISMA/.test(cuerpo), "la separacion usa el conjunto TABLAS_PRISMA");

console.log("\nSOLO LECTURA");
ok(/BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY/.test(src), "captura en REPEATABLE READ READ ONLY");
ok(/ROLLBACK/.test(src), "termina con ROLLBACK");
ok(!/\b(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE)\s+(TABLE|INDEX|TYPE|SCHEMA|POLICY|INTO|FROM)\b/i.test(src),
   "ninguna sentencia de escritura");
ok(!/process\.env\.DATABASE_URL/.test(src), "nunca accede a DATABASE_URL");

console.log("\nPARAMETROS DE CONSULTAS CONGELADAS");
for (const nombre of ["enums", "secuencias", "relkinds", "funciones"])
  ok(new RegExp(`filas\\(Q\\.${nombre},\\s*\\[ESQUEMA\\]\\)`).test(cuerpo), `Q.${nombre} recibe el parametro public`);
ok(/const columnasIndice\s*=/.test(cuerpo) && /columnas:\s*columnasIndice\(r\.definicion\)/.test(cuerpo),
   "Q.indices conserva y descompone columnas desde pg_get_indexdef");

console.log(`\n${"=".repeat(56)}\n${fallos === 0 ? "CAPTURADOR: TODAS LAS PRUEBAS PASAN" : fallos + " FALLOS"}\n${"=".repeat(56)}`);
process.exit(fallos ? 1 : 0);
