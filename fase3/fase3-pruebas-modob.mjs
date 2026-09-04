/*
 * Pruebas locales de MODO B. Sin base de datos: se audita el codigo
 * y se simula el ciclo BEGIN -> baseline -> intermedio -> fallo ->
 * ROLLBACK -> posterior con un cliente falso que imita PostgreSQL.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, "fase3-modo-b.mjs"), "utf8");
let fallos = 0;
const ok = (c, d) => { console.log(`  ${c ? "PASA" : "*** FALLA ***"}  ${d}`); if (!c) fallos++; };

console.log("ORDEN EXACTO DE OPERACIONES");
{
  const idx = (re) => src.split("\n").findIndex((l) => re.test(l));
  const begin = idx(/query\("BEGIN"\)/);
  const baseline = idx(/query\(sql\)/);
  const inter = idx(/const dentro = \(await cliente\.query\(SQL_ESTRUCTURA\)/);
  const fallo = idx(/RAISE EXCEPTION/);
  const roll = src.split("\n").findIndex((l, i) => i > fallo && /query\("ROLLBACK"\)/.test(l));
  const post = idx(/const fuera = \(await cliente\.query\(SQL_ESTRUCTURA\)/);
  ok(begin < baseline, "BEGIN antes del baseline");
  ok(baseline < inter, "baseline antes de la comprobacion intermedia");
  ok(inter < fallo, "comprobacion intermedia ANTES del RAISE EXCEPTION");
  ok(fallo < roll, "RAISE EXCEPTION antes del ROLLBACK");
  ok(roll < post, "ROLLBACK antes de la comprobacion posterior");
  const entre = src.split("\n").slice(fallo + 1, roll).filter((l) => /\.query\(/.test(l));
  ok(entre.length === 0, `sin consultas entre la excepcion y el ROLLBACK (${entre.length})`);
}

console.log("\nCOBERTURA DE LOS 9 CONJUNTOS FUNCIONALES");
{
  const claves = ["tablas", "enums", "indices", "constraints", "rls", "policies", "funciones", "triggers", "secuencias"];
  const m = src.match(/const CLAVES = \[([^\]]+)\]/);
  const declaradas = m ? m[1].split(",").map((x) => x.trim().replace(/"/g, "")) : [];
  for (const k of claves) {
    ok(new RegExp(`AS ${k}\\b`).test(src), `la consulta cuenta '${k}'`);
    ok(declaradas.includes(k), `'${k}' se verifica tras el ROLLBACK`);
  }
  ok(declaradas.length === 9, `9 conjuntos verificados (${declaradas.length})`);
}

console.log("\nESTADO INTERMEDIO ESPERADO");
{
  const m = src.match(/const ESPERADO_INTERMEDIO = \{([\s\S]*?)\}/);
  const esp = Object.fromEntries([...m[1].matchAll(/(\w+):\s*(\d+)/g)].map((x) => [x[1], Number(x[2])]));
  const debe = { tablas: 89, enums: 54, indices: 326, constraints: 265, rls: 3, policies: 3, funciones: 0, triggers: 0, secuencias: 0 };
  for (const [k, v] of Object.entries(debe)) ok(esp[k] === v, `intermedio ${k} = ${v} (declarado ${esp[k]})`);
}

console.log("\nEXCLUSIONES");
{
  ok(/relname <> '_prisma_migrations'/.test(src), "_prisma_migrations excluido del universo funcional");
  ok(/AS interno_prisma/.test(src), "_prisma_migrations se cuenta y reporta APARTE");
  ok(/no se oculta/.test(src) && /AVISO: aparecio _prisma_migrations/.test(src),
     "avisa explicitamente si aparece, sin ocultarlo");
  ok(/nspname = 'public'/.test(src) && !/baseline_guard/.test(src.replace(/baseline_guard.*infraestructura[^\n]*/g, "")),
     "baseline_guard fuera de los conteos (solo public)");
  ok(/NOT tg\.tgisinternal/.test(src), "triggers: excluye los internos de constraints");
  ok(/refclassid = 'pg_extension'::regclass/.test(src), "funciones: excluye las de extensiones");
}

console.log("\nSIMULACION DEL CICLO COMPLETO");
{
  /* Cliente falso: modela una base donde el baseline crea objetos
   * dentro de la tx y el ROLLBACK los revierte. */
  const crearCliente = ({ revierte = true, intermedioReal = null } = {}) => {
    let enTx = false, aplicado = false;
    const lleno = intermedioReal ?? { tablas: 89, enums: 54, indices: 326, constraints: 265,
      rls: 3, policies: 3, funciones: 0, triggers: 0, secuencias: 0, interno_prisma: 0 };
    const vacio = { tablas: 0, enums: 0, indices: 0, constraints: 0, rls: 0, policies: 0,
      funciones: 0, triggers: 0, secuencias: 0, interno_prisma: 0 };
    return { query: async (sql) => {
      const t = String(sql).trim();
      if (t === "BEGIN") { enTx = true; return { rows: [] }; }
      if (t === "ROLLBACK") { if (revierte) aplicado = false; enTx = false; return { rows: [] }; }
      if (/RAISE EXCEPTION/.test(t)) throw new Error(`fallo inyectado por fase3-modo-b`);
      if (/WITH t AS/.test(t)) return { rows: [aplicado ? lleno : vacio] };
      if (/CREATE TABLE/.test(t)) { aplicado = true; return { rows: [] }; }
      return { rows: [] };
    } };
  };

  /* Reproduce la logica del ejecutor sobre el cliente falso. */
  const ciclo = async (cli) => {
    const SQL = src.match(/const SQL_ESTRUCTURA = `([\s\S]*?)`;/)[1];
    const CLAVES = ["tablas", "enums", "indices", "constraints", "rls", "policies", "funciones", "triggers", "secuencias"];
    const ESP = { tablas: 89, enums: 54, indices: 326, constraints: 265, rls: 3, policies: 3, funciones: 0, triggers: 0, secuencias: 0 };
    await cli.query("BEGIN");
    await cli.query("CREATE TABLE x (i int);");
    const dentro = (await cli.query(SQL)).rows[0];
    const desaj = CLAVES.filter((k) => Number(dentro[k]) !== ESP[k]);
    if (desaj.length) return { estado: "ABORTA_INTERMEDIO", desaj };
    let fallo = false;
    try { await cli.query("DO $$ BEGIN RAISE EXCEPTION 'x'; END $$"); } catch { fallo = true; }
    await cli.query("ROLLBACK");
    const fuera = (await cli.query(SQL)).rows[0];
    const residuos = CLAVES.filter((k) => Number(fuera[k]) !== 0);
    return { estado: fallo && !residuos.length ? "PASS" : "FAIL", dentro, fuera, residuos };
  };

  const r1 = await ciclo(crearCliente());
  ok(r1.estado === "PASS", "ciclo nominal -> PASS");
  ok(Number(r1.dentro.tablas) === 89 && Number(r1.dentro.constraints) === 265, "intermedio: 89 tablas, 265 constraints");
  ok(Object.keys(r1.fuera).filter((k) => k !== "interno_prisma").every((k) => Number(r1.fuera[k]) === 0),
     "posterior: los 9 conjuntos en cero");

  const r2 = await ciclo(crearCliente({ revierte: false }));
  ok(r2.estado === "FAIL" && r2.residuos.length > 0, `ROLLBACK que no revierte -> FAIL (residuos: ${r2.residuos.join(", ")})`);

  const r3 = await ciclo(crearCliente({ intermedioReal: { tablas: 40, enums: 54, indices: 326, constraints: 265,
    rls: 3, policies: 3, funciones: 0, triggers: 0, secuencias: 0, interno_prisma: 0 } }));
  ok(r3.estado === "ABORTA_INTERMEDIO", `baseline incompleto -> aborta antes del fallo (${r3.desaj.join(", ")})`);

  const r4 = await ciclo(crearCliente({ intermedioReal: { tablas: 89, enums: 54, indices: 326, constraints: 265,
    rls: 3, policies: 3, funciones: 1, triggers: 0, secuencias: 0, interno_prisma: 0 } }));
  ok(r4.estado === "ABORTA_INTERMEDIO" && r4.desaj.includes("funciones"), "funcion inesperada en el intermedio -> aborta");
}

console.log("\nCONCLUSION ACOTADA");
{
  ok(/completamente reversible cuando se/.test(src), "declara reversibilidad transaccional");
  ok(/Nada sobre Prisma/.test(src), "no generaliza a Prisma");
  ok(/A\. el estado intermedio|B\. el fallo deliberado|C\. el ROLLBACK|D\. los 9 conjuntos/.test(src),
     "enumera las condiciones A-D del PASS");
}

console.log(`\n${"=".repeat(56)}\n${fallos === 0 ? "MODO B: TODAS LAS PRUEBAS PASAN" : fallos + " FALLOS"}\n${"=".repeat(56)}`);
process.exit(fallos ? 1 : 0);
