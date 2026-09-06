/*
 * Prueba END-TO-END del camino que usara MODO A:
 *   captura (formato real) -> canonizacion -> lib-comparar -> C
 *
 * Ejercita compararCapturaContraC(), la MISMA funcion que invoca el
 * ejecutor. No prueba funciones internas del comparador por
 * separado: si esta prueba pasa y el ejecutor falla, seria porque
 * la base difiere, no porque el camino sea otro.
 *
 * La captura fixture se SINTETIZA desde C invirtiendo lo que hara
 * PostgreSQL: tipos en minuscula, timestamp con "without time
 * zone", defaults con cast, metodo btree explicito. Asi la prueba
 * positiva solo pasa si las normalizaciones funcionan de verdad.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compararCapturaContraC, conteosObservados } from "./lib-comparar-modoa.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const C = JSON.parse(fs.readFileSync(path.join(ROOT, ".tmp-baseline/manifest-baseline-expected.json"), "utf-8"));

let fallos = 0;
const ok = (c, d) => { console.log(`  ${c ? "PASA" : "*** FALLA ***"}  ${d}`); if (!c) fallos++; };

/* ---- Sintesis de la captura, imitando lo que devuelve el catalogo ---- */
const comoPostgres = (tipo) => {
  let t = String(tipo).replace(/^"|"$/g, "").toLowerCase();
  t = t.replace(/^decimal/, "numeric");
  if (/^timestamp\(\d+\)$/.test(t)) t += " without time zone";
  return t;
};
const defaultComoPostgres = (def, tipo) => {
  if (def === null || def === undefined) return null;
  const s = String(def);
  if (/^'.*'$/.test(s) && /^"/.test(String(tipo))) return `${s}::${String(tipo).replace(/"/g, "")}`;
  return s;
};

function sintetizarCaptura(C) {
  const O = { esquema: "public", aplicacion: {}, interno_prisma: {}, enums: {}, secuencias: [] };
  O.aplicacion.tablas = [...C.heredado_de_A.tablas, ...C.agregado_por_B.tablas].sort();
  O.interno_prisma.tablas = [];

  O.aplicacion.columnas = {};
  for (const [t, cols] of Object.entries(C.heredado_de_A.columnas)) O.aplicacion.columnas[t] = cols;
  for (const [t, d] of Object.entries(C.agregado_por_B.estructura))
    O.aplicacion.columnas[t] = d.columnas.map((c) => ({
      nombre: c.nombre,
      tipo_sql: comoPostgres(c.tipo_sql),
      nullable: c.nullable,
      default_sql: defaultComoPostgres(c.default_sql, c.tipo_sql),
    }));

  O.aplicacion.constraints = { ...C.heredado_de_A.constraints };
  for (const [t, d] of Object.entries(C.agregado_por_B.estructura))
    O.aplicacion.constraints[t] = [...d.primary_keys, ...d.foreign_keys].map((x) => ({ constraint: x.nombre, tabla: t }));

  /* El catalogo muestra los CREATE INDEX y ademas un indice UNIQUE
   * de respaldo por cada PRIMARY KEY, con el mismo nombre que la
   * constraint. La sintesis los incluye porque PostgreSQL lo hara. */
  O.aplicacion.indices = { ...C.heredado_de_A.indices };
  for (const [t, d] of Object.entries(C.agregado_por_B.estructura))
    O.aplicacion.indices[t] = d.indices_efectivos.map((i) => ({
      indice: i.nombre, tabla: t, es_unico: i.unique, metodo: "btree",
      es_primaria: i.origen === "PRIMARY KEY",
      columnas: i.columnas.map((c) => ({ columna: c.columna, direccion_explicita: "ASC" })),
    }));

  const norm = (v) => (Array.isArray(v) ? v : Object.values(v ?? {}));
  for (const [k, v] of Object.entries({
    ...C.heredado_de_A.enums,
    ...C.agregado_por_B.enums,
    ...(C.modificado_por_B?.enums ?? {}),
  })) O.enums[k] = norm(v);

  O.aplicacion.rls = JSON.parse(JSON.stringify(C.heredado_de_A.rls));
  O.aplicacion.policies = JSON.parse(JSON.stringify(C.heredado_de_A.policies));
  O.aplicacion.funciones = [];
  O.aplicacion.triggers = [];
  return O;
}

const clon = (x) => JSON.parse(JSON.stringify(x));
const BASE = sintetizarCaptura(C);

console.log("POSITIVA — captura fiel del baseline");
{
  const { veredicto: v } = compararCapturaContraC(BASE, C);
  ok(v.diferencias.length === 0, `0 diferencias reales (${v.diferencias.length})`);
  ok(v.no_clasificables.length === 0, `0 NO_CLASIFICABLE (${v.no_clasificables.length})`);
  ok(v.revision_manual.length === 0, `0 REVISION_MANUAL (${v.revision_manual.length})`);
  ok(v.estado === "PASS", "veredicto PASS");
  if (v.diferencias.length) for (const d of v.diferencias.slice(0, 5))
    console.log(`      ${d.ruta}: esperado ${JSON.stringify(d.esperado)} vs ${JSON.stringify(d.observado)}`);

  const obs = conteosObservados(BASE);
  for (const [k, e] of Object.entries(C.conteos))
    ok(Number(obs[k]) === Number(e.C), `conteo ${k}: ${obs[k]} === ${e.C}`);

  const reglas = {};
  for (const n of v.normalizaciones_aplicadas) for (const r of n.reglas) reglas[r] = (reglas[r] ?? 0) + 1;
  console.log(`     normalizaciones aplicadas: ${JSON.stringify(reglas)}`);
  ok(Object.keys(reglas).length > 0, "las normalizaciones se ejercitaron de verdad");
}

/* ---- Negativas: una manipulacion por caso, camino completo ---- */
const negativa = (titulo, mutar, rutaEsperada) => {
  const O = clon(BASE);
  mutar(O);
  const { veredicto: v } = compararCapturaContraC(O, C);
  const total = v.diferencias.length + v.revision_manual.length + v.no_clasificables.length;
  const rutas = [...v.diferencias, ...v.revision_manual, ...v.no_clasificables].map((d) => d.ruta);
  const acierta = rutaEsperada ? rutas.some((r) => r.includes(rutaEsperada)) : true;
  ok(v.estado === "FAIL" && total > 0 && acierta,
     `${titulo} -> FAIL (${total} hallazgo(s)${rutaEsperada ? `, ruta ${rutas.find((r) => r.includes(rutaEsperada)) ?? "NO COINCIDE"}` : ""})`);
};

console.log("\nNEGATIVAS — el camino completo detecta cada diferencia");
const T = "EventAddedProduct";
negativa("tipo de columna DECIMAL(12,3) -> numeric(14,3)",
  (O) => { O.aplicacion.columnas[T].find((c) => c.nombre === "quantityOriginal").tipo_sql = "numeric(14,3)"; },
  "quantityOriginal.tipo");
negativa("nullability NOT NULL -> nullable",
  (O) => { O.aplicacion.columnas[T].find((c) => c.nombre === "eventId").nullable = true; },
  "eventId.nullable");
negativa("default distinto",
  (O) => { O.aplicacion.columnas[T].find((c) => c.nombre === "returnedQuantity").default_sql = "1"; },
  "returnedQuantity.default");
negativa("FK ausente (ON DELETE no verificable sin la constraint)",
  (O) => { O.aplicacion.constraints[T] = O.aplicacion.constraints[T].filter((c) => c.constraint !== "EventAddedProduct_eventId_fkey"); },
  "fk.EventAddedProduct_eventId_fkey");
negativa("indice: columna distinta",
  (O) => { O.aplicacion.indices[T].find((i) => i.indice === "EventAddedProduct_status_idx").columnas = [{ columna: "notes", direccion_explicita: "ASC" }]; },
  "columnas[0].columna");
negativa("indice: unique cambiado",
  (O) => { O.aplicacion.indices[T].find((i) => i.indice === "EventAddedProduct_eventId_idx").es_unico = true; },
  "unique");
negativa("indice ausente",
  (O) => { O.aplicacion.indices[T] = O.aplicacion.indices[T].filter((i) => i.indice !== "EventAddedProduct_productId_idx"); },
  "indice.EventAddedProduct_productId_idx");
negativa("indice de PK ausente (EventAddedProduct_pkey)",
  (O) => { O.aplicacion.indices[T] = O.aplicacion.indices[T].filter((i) => i.indice !== "EventAddedProduct_pkey"); },
  "indice.EventAddedProduct_pkey");
negativa("indice de PK con unique=false",
  (O) => { O.aplicacion.indices[T].find((i) => i.indice === "EventAddedProduct_pkey").es_unico = false; },
  "EventAddedProduct_pkey.unique");
negativa("indice de PK con columna distinta",
  (O) => { O.aplicacion.indices[T].find((i) => i.indice === "EventAddedProduct_pkey").columnas = [{ columna: "eventId", direccion_explicita: "ASC" }]; },
  "EventAddedProduct_pkey.columnas[0].columna");
negativa("orden de enum invertido",
  (O) => { O.enums.EventAddedStatus = [...O.enums.EventAddedStatus].reverse(); },
  "enum.EventAddedStatus");
negativa("tabla ausente",
  (O) => { O.aplicacion.tablas = O.aplicacion.tablas.filter((t) => t !== "EventAddedProductLog"); },
  "tabla.EventAddedProductLog");
negativa("RLS: force_rls desactivado",
  (O) => { O.aplicacion.rls[0].force_rls = false; },
  "force_rls");
negativa("RLS: tabla sin RLS",
  (O) => { O.aplicacion.rls = O.aplicacion.rls.slice(1); },
  "rls.");
negativa("policy: expresion USING alterada",
  (O) => { O.aplicacion.policies[0].using = "(1 = 0)"; },
  "using");
negativa("policy ausente",
  (O) => { O.aplicacion.policies = O.aplicacion.policies.slice(1); },
  "policy.");
/* Funciones y triggers inesperados NO los detecta el comparador
 * estructural (C no modela una seccion de funciones que comparar):
 * los detecta el chequeo de conteos de MODO A. Se prueba por esa
 * via, que es la real, en vez de exigirselo al comparador. */
{
  const O = clon(BASE); O.aplicacion.funciones = [{ nombre: "f_intrusa" }];
  const obs = conteosObservados(O);
  ok(Number(obs.funciones) !== Number(C.conteos.funciones.C),
     `funcion inesperada -> desajuste de conteo (${obs.funciones} vs ${C.conteos.funciones.C})`);
  const O2 = clon(BASE); O2.aplicacion.triggers = [{ nombre: "t_intruso" }];
  ok(Number(conteosObservados(O2).triggers) !== Number(C.conteos.triggers.C),
     "trigger inesperado -> desajuste de conteo");
  const O3 = clon(BASE); O3.secuencias = [{ nombre: "s_intrusa" }];
  ok(Number(conteosObservados(O3).secuencias) !== Number(C.conteos.secuencias.C),
     "secuencia inesperada -> desajuste de conteo");
}

console.log(`\n${"=".repeat(56)}\n${fallos === 0 ? "END-TO-END: TODAS LAS PRUEBAS PASAN" : fallos + " FALLOS"}\n${"=".repeat(56)}`);
process.exit(fallos ? 1 : 0);
