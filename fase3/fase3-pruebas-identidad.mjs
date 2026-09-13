/* Pruebas locales PRE_DDL / POST_COMMIT. Nunca abre una conexion. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ENV_ESPERADO,
  verificarParametrosTLS,
  verificarPostCommit,
  verificarPreDDL,
} from "./lib-identidad.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let fallos = 0;
const ok = (condicion, detalle) => {
  console.log(`  ${condicion ? "PASA" : "*** FALLA ***"}  ${detalle}`);
  if (!condicion) fallos++;
};
const TABLAS_A = ["User", "Branch", "InventoryProduct"];
const URL_TEST = new URL("postgresql://u@ep-fixture-distinto.c-9.us-east-1.aws.neon.tech/baseline_test?sslmode=verify-full&channel_binding=require");

function cliente({
  db = "baseline_test",
  tablasPublic = [],
  enums = 0,
  policies = 0,
  marcador = ENV_ESPERADO.valorMarcador,
  fallar = null,
} = {}) {
  const log = [];
  return {
    log,
    query: async (sql) => {
      const texto = String(sql).trim();
      log.push(texto);
      if (/^SAVEPOINT|^ROLLBACK TO SAVEPOINT|^RELEASE SAVEPOINT/.test(texto)) return { rows: [] };
      if (/current_database/.test(texto)) return { rows: [{ db }] };
      if (/hay_esquema/.test(texto)) return { rows: [{ hay_esquema: "1", hay_tabla: "1", hay_columna: "1" }] };
      if (new RegExp(ENV_ESPERADO.tablaMarcador).test(texto)) return { rows: [{ valor: marcador }] };
      if (/AS tablas_funcionales/.test(texto)) {
        if (fallar === "post") throw new Error("fallo post simulado");
        return { rows: [{ tablas_funcionales: String(tablasPublic.length), enums: String(enums), policies: String(policies) }] };
      }
      if (/SELECT c\.relname AS tabla/.test(texto)) {
        if (fallar === "tablas") throw new Error("fallo tablas simulado");
        return { rows: tablasPublic.map((tabla) => ({ tabla })) };
      }
      if (/AS tablas,/.test(texto)) {
        if (fallar === "public") throw new Error("fallo public simulado");
        return { rows: [{ tablas: String(tablasPublic.length), enums: String(enums), policies: String(policies) }] };
      }
      return { rows: [] };
    },
  };
}

const estado = (resultado, nombre) => resultado.guardas.find((guarda) => guarda.nombre === nombre)?.estado;
const tiene = (resultado, nombre) => resultado.guardas.some((guarda) => guarda.nombre === nombre);

console.log("PERFILES EXPLICITOS");
{
  // A. PRE_DDL sobre fixture vacío → PASS.
  const preVacio = await verificarPreDDL(cliente(), URL_TEST, TABLAS_A);
  ok(preVacio.ok, "A. PRE_DDL sobre fixture vacío -> PASS");
  ok(preVacio.guardas.length === 8, "PRE_DDL contiene exactamente 8 guardas");

  // B. PRE_DDL sobre baseline construido → FAIL.
  const preLleno = await verificarPreDDL(cliente({ tablasPublic: ["User", ...Array(88).fill("Otro")], enums: 54, policies: 3 }), URL_TEST, TABLAS_A);
  ok(!preLleno.ok, "B. PRE_DDL sobre baseline construido -> FAIL");
  ok(estado(preLleno, "sin_tablas_de_produccion") === "FAIL", "PRE_DDL detecta tablas de A");
  ok(estado(preLleno, "public_vacio") === "FAIL", "PRE_DDL exige public vacío");

  // C. POST_COMMIT sobre vacío → FAIL.
  const postVacio = await verificarPostCommit(cliente(), URL_TEST);
  ok(!postVacio.ok && estado(postVacio, "estructura_post_commit") === "FAIL", "C. POST_COMMIT sobre fixture vacío -> FAIL");

  // D. POST_COMMIT sobre 89/54/3 → PASS.
  const postLlenoCliente = cliente({ tablasPublic: Array(89).fill("Tabla"), enums: 54, policies: 3 });
  const postLleno = await verificarPostCommit(postLlenoCliente, URL_TEST);
  ok(postLleno.ok, "D. POST_COMMIT sobre 89/54/3 -> PASS");

  // E/F. El perfil POST no evalúa las consultas ni guardas PRE.
  ok(!tiene(postLleno, "public_vacio"), "E. POST_COMMIT jamás evalúa public_vacio");
  ok(!tiene(postLleno, "sin_tablas_de_produccion"), "F. POST_COMMIT jamás evalúa sin_tablas_de_produccion");
  ok(!postLlenoCliente.log.some((sql) => /SELECT c\.relname AS tabla/.test(sql)), "POST_COMMIT no lista tablas de A");
  ok(!postLlenoCliente.log.some((sql) => /AS tablas,/.test(sql)), "POST_COMMIT no ejecuta el conteo de public vacío");
}

console.log("\nIDENTIDAD COMPARTIDA Y TLS");
{
  const dbIncorrecta = await verificarPostCommit(cliente({ db: "neondb", tablasPublic: Array(89).fill("Tabla"), enums: 54, policies: 3 }), URL_TEST);
  ok(estado(dbIncorrecta, "base_de_datos") === "FAIL" && estado(dbIncorrecta, "no_es_neondb") === "FAIL", "ambos perfiles conservan la identidad segura compartida");
  ok(verificarParametrosTLS(new URL("postgresql://u@x/baseline_test?sslmode=require&channel_binding=require")).ok === false, "TLS inseguro -> FAIL local");
  ok(verificarParametrosTLS(URL_TEST).ok === true, "TLS requerido -> PASS local");
}

console.log("\nAUDITORIA DE LLAMADAS PRE/POST");
{
  const leer = (nombre) => fs.readFileSync(path.join(__dirname, nombre), "utf8");
  const capturador = leer("capturar-baseline-test.mjs");
  const modoA = leer("fase3-modo-a.mjs");
  const modoB = leer("fase3-modo-b.mjs");
  // G.
  ok(/verificarPostCommit/.test(capturador) && !/verificarPreDDL/.test(capturador), "G. capturador usa exclusivamente POST_COMMIT");
  // H.
  const preA = modoA.indexOf("guardasPreDDL");
  const beginA = modoA.indexOf('cliente.query("BEGIN")');
  const commitA = modoA.indexOf('cliente.query("COMMIT")');
  const postA = modoA.indexOf("guardasPostCommit");
  const capturaA = modoA.lastIndexOf("capturar-baseline-test.mjs");
  ok(preA >= 0 && preA < beginA && commitA < postA && postA < capturaA, "H. MODO A usa PRE antes de DDL y POST después de COMMIT");
  // I.
  const preB = modoB.indexOf("guardasPreDDL");
  const beginB = modoB.indexOf('cliente.query("BEGIN")');
  ok(preB >= 0 && preB < beginB && !/guardasPostCommit/.test(modoB), "I. MODO B usa PRE antes de BEGIN");

  const postScripts = ["capturar-baseline-test.mjs", "fase3-diagnostico-estado.mjs"];
  const postConPre = postScripts.filter((archivo) => {
    const contenido = leer(archivo);
    return /verificarPostCommit|guardasPostCommit/.test(contenido) && /verificarPreDDL|guardasPreDDL/.test(contenido);
  });
  ok(postConPre.length === 0, `ninguna llamada POST-COMMIT usa guardas PRE (${postConPre.join(", ") || "ninguna"})`);
}

console.log(`\n${"=".repeat(56)}\n${fallos === 0 ? "IDENTIDAD PRE/POST: TODAS LAS PRUEBAS PASAN" : `${fallos} FALLOS`}\n${"=".repeat(56)}`);
process.exit(fallos ? 1 : 0);
