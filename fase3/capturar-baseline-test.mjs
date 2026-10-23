/*
 * ============================================================
 * CAPTURA DEL ESQUEMA DE  baseline_test   (NO produccion)
 * ============================================================
 * Derivado de capturar-manifiesto.mjs (congelado en
 *   aa2462afe19b9d695e955a5e03420a104beb8d827667eb24a799039ef21de65f).
 *
 * Las 13 consultas SQL son BYTE A BYTE identicas al instrumento
 * oficial: se copiaron sin alterar un solo caracter. Comparar dos
 * lecturas hechas con instrumentos distintos invalidaria el
 * resultado, porque una diferencia podria venir del instrumento y
 * no del esquema. fase3-pruebas-consultas.mjs lo demuestra.
 *
 * Difiere del oficial UNICAMENTE en:
 *   - origen de la URL          (BASELINE_TEST_URL, no DATABASE_URL)
 *   - guardas de identidad      (exige baseline_test; rechaza produccion)
 *   - ejecucion no interactiva  (sin frases de confirmacion)
 *   - ruta de salida            (fase3/)
 *   - mensajes propios de baseline_test
 *
 * ESTRICTAMENTE SOLO LECTURA: BEGIN READ ONLY / REPEATABLE READ,
 * ROLLBACK siempre. No emite DDL.
 * ============================================================
 */
import fs from "node:fs";
import crypto from "node:crypto";
import pg from "pg";
import { verificarPostCommit, verificarParametrosTLS, TLS_REQUERIDO } from "./lib-identidad.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* Rutas ancladas al ARCHIVO, no al cwd: el script debe funcionar
 * igual invocado desde la raiz del repo o desde fase3/. */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const R = (...p) => path.join(ROOT, ...p);
const F = (...p) => path.join(__dirname, ...p);


const SALIDA = R(".tmp-baseline/fase3/captura-baseline-test.json");
const SALIDA_TMP = SALIDA + ".tmp";
const ESQUEMA = "public";
const UNIVERSO = `n.nspname = '${ESQUEMA}' AND c.relkind = 'r'`;

const salir = async (codigo, msg) => {
  if (msg) console.error(msg);
  try { if (globalThis.__cliente) { await globalThis.__cliente.query("ROLLBACK"); globalThis.__cliente.release(); } } catch {}
  try { if (globalThis.__pool) await globalThis.__pool.end(); } catch {}
  process.exit(codigo);
};

const Q = {
  tablas: `SELECT c.relname AS tabla FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE ${UNIVERSO} ORDER BY c.relname`,
  columnas: `
    SELECT c.relname AS tabla, a.attname AS columna, a.attnum AS pos,
           format_type(a.atttypid, a.atttypmod) AS tipo, a.attnotnull AS not_null,
           pg_get_expr(d.adbin, d.adrelid) AS por_defecto, a.attidentity AS identidad
      FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
     WHERE ${UNIVERSO} AND a.attnum > 0 AND NOT a.attisdropped
     ORDER BY c.relname, a.attnum`,
  constraints: `
    SELECT c.relname AS tabla, con.conname AS nombre,
           CASE con.contype WHEN 'p' THEN 'PRIMARY KEY' WHEN 'u' THEN 'UNIQUE'
                            WHEN 'f' THEN 'FOREIGN KEY' WHEN 'c' THEN 'CHECK'
                            ELSE con.contype::text END AS tipo,
           pg_get_constraintdef(con.oid) AS definicion,
           CASE con.confupdtype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
                                WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL'
                                WHEN 'd' THEN 'SET DEFAULT' ELSE NULL END AS on_update,
           CASE con.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
                                WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL'
                                WHEN 'd' THEN 'SET DEFAULT' ELSE NULL END AS on_delete,
           cf.relname AS tabla_referida
      FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      LEFT JOIN pg_class cf ON cf.oid=con.confrelid
     WHERE ${UNIVERSO} ORDER BY c.relname, con.conname`,
  /* P4: por pg_index/pg_class, alineado al mismo universo. No pg_indexes. */
  indices: `
    SELECT c.relname AS tabla, ic.relname AS nombre,
           pg_get_indexdef(i.indexrelid) AS definicion,
           i.indisunique AS es_unico, i.indisprimary AS es_primaria
      FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid
      JOIN pg_class ic ON ic.oid=i.indexrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE ${UNIVERSO} ORDER BY c.relname, ic.relname`,
  enums: `
    SELECT t.typname AS nombre, e.enumlabel AS valor
      FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
      JOIN pg_enum e ON e.enumtypid=t.oid
     WHERE n.nspname=$1 AND t.typtype='e' ORDER BY t.typname, e.enumsortorder`,
  secuencias: `
    SELECT c.relname AS nombre, s.seqtypid::regtype::text AS tipo,
           s.seqstart::text AS inicio, s.seqincrement::text AS incremento
      FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname=$1 ORDER BY c.relname`,
  rls: `
    SELECT c.relname AS tabla, c.relrowsecurity AS enable_rls, c.relforcerowsecurity AS force_rls
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE ${UNIVERSO} AND (c.relrowsecurity OR c.relforcerowsecurity) ORDER BY c.relname`,
  policies: `
    SELECT c.relname AS tabla, p.polname AS nombre,
           p.polpermissive AS permissive, p.polcmd::text AS comando,
           COALESCE((SELECT string_agg(r.rolname, ', ' ORDER BY r.rolname)
                       FROM pg_roles r WHERE r.oid = ANY(p.polroles)), 'public') AS roles,
           pg_get_expr(p.polqual, p.polrelid) AS using_expr,
           pg_get_expr(p.polwithcheck, p.polrelid) AS with_check_expr
      FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE ${UNIVERSO} ORDER BY c.relname, p.polname`,
  /* Funciones de aplicacion en public. Se excluyen las que pertenecen
   * a una extension (pg_depend deptype 'e'), como las de plpgsql. */
  funciones: `
    SELECT n.nspname AS esquema, p.proname AS nombre,
           pg_get_function_identity_arguments(p.oid) AS argumentos,
           pg_get_function_result(p.oid) AS retorno,
           l.lanname AS lenguaje,
           CASE p.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE'
                              WHEN 'v' THEN 'VOLATILE' END AS volatilidad,
           p.prosecdef AS security_definer,
           CASE p.prokind WHEN 'f' THEN 'function' WHEN 'p' THEN 'procedure'
                          WHEN 'a' THEN 'aggregate' WHEN 'w' THEN 'window' END AS clase,
           pg_get_functiondef(p.oid) AS definicion
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_language l ON l.oid = p.prolang
     WHERE n.nspname = $1
       AND p.prokind IN ('f','p')
       AND NOT EXISTS (SELECT 1 FROM pg_depend d
                        WHERE d.classid = 'pg_proc'::regclass
                          AND d.objid = p.oid
                          AND d.objsubid = 0
                          AND d.refclassid = 'pg_extension'::regclass
                          AND d.deptype = 'e')
     ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)`,
  /* Triggers de usuario sobre tablas del mismo universo.
   * tgisinternal excluye los que Postgres crea para constraints. */
  triggers: `
    SELECT n.nspname AS esquema, c.relname AS tabla, t.tgname AS nombre,
           pg_get_triggerdef(t.oid) AS definicion,
           pf.proname AS funcion_asociada,
           np.nspname AS funcion_esquema,
           CASE t.tgenabled WHEN 'O' THEN 'ENABLED (origin)' WHEN 'D' THEN 'DISABLED'
                            WHEN 'R' THEN 'ENABLED (replica)' WHEN 'A' THEN 'ENABLED (always)'
                            END AS estado
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_proc pf ON pf.oid = t.tgfoid
      JOIN pg_namespace np ON np.oid = pf.pronamespace
     WHERE ${UNIVERSO} AND NOT t.tgisinternal
     ORDER BY c.relname, t.tgname`,
  extensiones: `SELECT e.extname AS nombre, n.nspname AS esquema
                  FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace ORDER BY e.extname`,
  relkinds: `SELECT c.relkind::text AS tipo, count(*)::int AS n
               FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname=$1 GROUP BY c.relkind ORDER BY c.relkind`,
  esquemas: `SELECT nspname AS esquema FROM pg_namespace
              WHERE nspname NOT IN ('pg_catalog','information_schema','pg_toast')
                AND nspname NOT LIKE 'pg_temp%' AND nspname NOT LIKE 'pg_toast_temp%'
              ORDER BY nspname`,
};

/* ================= Conexion a baseline_test ================= */
if (!process.env.BASELINE_TEST_URL)
  await salir(1, "ABORTADO: falta BASELINE_TEST_URL.\nEste script NUNCA usa DATABASE_URL: esa variable apunta a produccion.");

let url;
try { url = new URL(process.env.BASELINE_TEST_URL); }
catch { await salir(1, "ABORTADO: BASELINE_TEST_URL no es una URL valida."); }
const tlsParametros = verificarParametrosTLS(url);
if (!tlsParametros.ok) {
  await salir(1, `ABORTADO: BASELINE_TEST_URL no cumple TLS requerido (${tlsParametros.problemas.join("; ")}). Se requiere sslmode=${TLS_REQUERIDO.sslmode} y channel_binding=${TLS_REQUERIDO.channel_binding}.`);
}

const pool = new pg.Pool({ connectionString: process.env.BASELINE_TEST_URL, max: 1 });
globalThis.__pool = pool;
const c = await pool.connect().catch(async (e) => {
  await salir(1, `ABORTADO: no se pudo conectar (${e.code ?? e.message}).`);
});
globalThis.__cliente = c;

/* TLS verificado sobre el socket del cliente, igual que el oficial */
const socket = c.connection?.stream;
const tls = {
  cifrada: socket?.encrypted === true,
  certificadoAutorizado: socket?.authorized === true,
  protocolo: typeof socket?.getProtocol === "function" ? socket.getProtocol() : null,
};

/* ================= PERFIL POST_COMMIT (antes de capturar) ================= */
await c.query("BEGIN READ ONLY");
const veredicto = await verificarPostCommit(c, url);
if (!veredicto.ok) {
  await c.query("ROLLBACK");
  await salir(1, "ABORTADO: el entorno no cumple el perfil POST_COMMIT de baseline_test.\n" +
    veredicto.guardas.map((g) => `  ${g.ok ? "ok  " : "FALLA"}  ${g.nombre}: ${g.detalle}`).join("\n"));
}
console.log("Perfil POST_COMMIT verificado:");
for (const g of veredicto.guardas) console.log(`  ok    ${g.nombre}: ${g.detalle}`);
await c.query("ROLLBACK");

/* ================= Captura en un solo snapshot ================= */
const M = { esquema: ESQUEMA, parte: "captura_baseline_test", version_script: 6 };
try {
  await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const TABLAS_PRISMA = new Set(["_prisma_migrations"]);
  const filas = async (q, p) => (await c.query(q, p)).rows;

  const todas = await filas(Q.tablas);
  M.aplicacion = {}; M.interno_prisma = {};
  M.aplicacion.tablas = todas.filter((r) => !TABLAS_PRISMA.has(r.tabla ?? r.nombre)).map((r) => r.tabla ?? r.nombre);
  M.interno_prisma.tablas = todas.filter((r) => TABLAS_PRISMA.has(r.tabla ?? r.nombre)).map((r) => r.tabla ?? r.nombre);

  const agrupar = (rows, filtro) => {
    const o = {};
    for (const r of rows) {
      const t = r.tabla;
      if (filtro(t)) (o[t] ??= []).push(r);
    }
    return o;
  };
  /* La consulta congelada de indices entrega pg_get_indexdef(). Para
   * los indices simples, la definicion ya contiene sus columnas y
   * direccion; se descompone aqui sin alterar ninguna de las 13
   * consultas. Si una definicion usa una expresion no reconocible, se
   * conserva como [] en lugar de inventar columnas. */
  const columnasIndice = (definicion) => {
    const cuerpo = String(definicion ?? "").match(/\bUSING\s+\w+\s+\(([^)]+)\)(?:\s+WHERE\b.*)?$/i)?.[1];
    if (!cuerpo) return [];
    const columnas = cuerpo.split(",").map((raw) => {
      const m = raw.trim().match(/^(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_$]*))(?:\s+(ASC|DESC))?(?:\s+NULLS\s+(FIRST|LAST))?$/i);
      return m ? { columna: m[1] ?? m[2], direccion_explicita: m[3]?.toUpperCase() ?? null } : null;
    });
    return columnas.every(Boolean) ? columnas : [];
  };
  const cols = await filas(Q.columnas), cons = await filas(Q.constraints);
  const idx = (await filas(Q.indices)).map((r) => ({ ...r, columnas: columnasIndice(r.definicion) }));
  M.aplicacion.columnas    = agrupar(cols, (t) => !TABLAS_PRISMA.has(t));
  M.interno_prisma.columnas = agrupar(cols, (t) =>  TABLAS_PRISMA.has(t));
  M.aplicacion.constraints  = agrupar(cons, (t) => !TABLAS_PRISMA.has(t));
  M.interno_prisma.constraints = agrupar(cons, (t) => TABLAS_PRISMA.has(t));
  M.aplicacion.indices      = agrupar(idx, (t) => !TABLAS_PRISMA.has(t));
  M.interno_prisma.indices  = agrupar(idx, (t) =>  TABLAS_PRISMA.has(t));

  const enums = await filas(Q.enums, [ESQUEMA]);
  M.enums = {};
  for (const r of enums) (M.enums[r.enum_nombre ?? r.nombre] ??= []).push(r.valor);

  M.secuencias = await filas(Q.secuencias, [ESQUEMA]);
  M.aplicacion.rls = await filas(Q.rls);
  M.aplicacion.policies = await filas(Q.policies);
  M.aplicacion.funciones = await filas(Q.funciones, [ESQUEMA]);
  const trg = await filas(Q.triggers);
  M.aplicacion.triggers = trg.filter((r) => !TABLAS_PRISMA.has(r.tabla));
  M.interno_prisma.triggers = trg.filter((r) => TABLAS_PRISMA.has(r.tabla));
  M.extensiones = await filas(Q.extensiones);
  M.relkinds_en_public = await filas(Q.relkinds, [ESQUEMA]);
  M.esquemas_no_sistema = (await filas(Q.esquemas)).map((r) => r.esquema ?? r.nombre);

  await c.query("ROLLBACK");
} catch (e) {
  await salir(1, `ABORTADO durante la captura: ${e.message}`);
}

M.conteos = {
  tablas_aplicacion: M.aplicacion.tablas.length,
  tablas_internas_prisma: M.interno_prisma.tablas.length,
  tablas_todas: M.aplicacion.tablas.length + M.interno_prisma.tablas.length,
  enums: Object.keys(M.enums).length,
  rls: M.aplicacion.rls.length,
  policies: M.aplicacion.policies.length,
  funciones: M.aplicacion.funciones.length,
  triggers: M.aplicacion.triggers.length,
};
M.tls = tls;

const ordenar = (v) => Array.isArray(v) ? v.map(ordenar)
  : (v && typeof v === "object") ? Object.keys(v).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .reduce((o, k) => { o[k] = ordenar(v[k]); return o; }, {}) : v;

const json = JSON.stringify(ordenar(M), null, 2) + "\n";
fs.mkdirSync(R(".tmp-baseline/fase3"), { recursive: true });
fs.writeFileSync(SALIDA_TMP, json, "utf-8");
fs.renameSync(SALIDA_TMP, SALIDA);

console.log("\nCaptura de baseline_test completada.");
console.log(`  TLS: cifrada=${tls.cifrada} autorizado=${tls.certificadoAutorizado} ${tls.protocolo ?? ""}`);
for (const [k, v] of Object.entries(M.conteos)) console.log(`  ${k.padEnd(24)} ${v}`);
console.log(`  archivo: ${SALIDA}`);
console.log(`  sha256 : ${crypto.createHash("sha256").update(json).digest("hex")}`);
await salir(0, null);
