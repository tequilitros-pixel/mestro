/*
 * Guardas de identidad de entorno para Fase 3.
 *
 * La identidad segura se evalúa una sola vez y los perfiles expresan
 * explícitamente el estado esperado de public:
 *   - verificarPreDDL: public vacío y sin tablas de A.
 *   - verificarPostCommit: baseline funcional ya construido.
 * Ningún perfil POST reutiliza guardas de vacío.
 */
import crypto from "node:crypto";

export const ENV_ESPERADO = {
  base: "baseline_test",
  esquemaGuardia: "baseline_guard",
  tablaMarcador: "environment_marker",
  columnaMarcador: "value",
  valorMarcador: "baseline_test_fase3",
  shaHostnameProduccion: "f62b1ec53384f3cc78a96e8f784218b8dcc3742fc79fcec019b1de0cc0e6060e",
  shaEndpointBaseProduccion: "666d0157e7e2a92bbcb12bc7d04c6760b7723944cf67a6a0ec5c1a60390d8d07",
};

export const POST_COMMIT_ESPERADO = { tablas: 89, enums: 54, policies: 3 };
export const TLS_REQUERIDO = { sslmode: "verify-full", channel_binding: "require" };
export const shaTexto = (texto) => crypto.createHash("sha256").update(String(texto)).digest("hex");

export function endpointBase(hostname) {
  const partes = String(hostname).split(".");
  partes[0] = partes[0].endsWith("-pooler")
    ? partes[0].slice(0, -"-pooler".length)
    : partes[0];
  return partes.join(".");
}

export function verificarParametrosTLS(url) {
  const problemas = [];
  for (const [clave, esperado] of Object.entries(TLS_REQUERIDO)) {
    const actual = url.searchParams.get(clave);
    if (actual === null) problemas.push(`falta ${clave} (debe ser ${esperado})`);
    else if (actual !== esperado) problemas.push(`${clave}=${actual}, se requiere ${esperado}`);
  }
  return { ok: problemas.length === 0, problemas };
}

function crearContexto(cliente) {
  const guardas = [];
  let secuencia = 0;
  let estadoCritico = null;
  const anotar = (nombre, estado, detalle) => {
    guardas.push({ nombre, estado, ok: estado === "PASS", detalle });
    return estado === "PASS";
  };
  const juzgar = (nombre, condicion, detalle) => anotar(nombre, condicion ? "PASS" : "FAIL", detalle);
  const estadoDe = (resultado) =>
    resultado.critico ? "NO_EVALUADA_POR_ESTADO_TRANSACCIONAL" : "ERROR";

  const consultar = async (sql, parametros) => {
    if (estadoCritico) return { ok: false, critico: true, error: estadoCritico };
    const savepoint = `guarda_sp_${++secuencia}`;
    try {
      await cliente.query(`SAVEPOINT ${savepoint}`);
    } catch (error) {
      return {
        ok: false,
        error: `no se pudo establecer el aislamiento (SAVEPOINT): ${error.message}. La consulta de esta guarda NO se ejecuto.`,
      };
    }

    let rows = null;
    let errorConsulta = null;
    try {
      rows = (await cliente.query(sql, parametros)).rows;
    } catch (error) {
      errorConsulta = error.message;
    }
    if (errorConsulta !== null) {
      try {
        await cliente.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      } catch (error) {
        estadoCritico = `no se pudo recuperar la transaccion tras un error (ROLLBACK TO SAVEPOINT ${savepoint}): ${error.message}`;
        return { ok: false, critico: true, error: estadoCritico };
      }
    }
    try {
      await cliente.query(`RELEASE SAVEPOINT ${savepoint}`);
    } catch (error) {
      estadoCritico = `no se pudo liberar el savepoint ${savepoint}: ${error.message}`;
      return { ok: false, critico: true, error: estadoCritico };
    }
    return errorConsulta === null ? { ok: true, rows } : { ok: false, error: errorConsulta };
  };

  return { guardas, anotar, juzgar, estadoDe, consultar };
}

/* Rutina compartida: las seis guardas de identidad, independientes de public. */
async function verificarIdentidadComun(cliente, url) {
  const contexto = crearContexto(cliente);
  const { anotar, juzgar, consultar, estadoDe } = contexto;
  const baseResultado = await consultar("SELECT current_database() AS db");
  if (!baseResultado.ok) {
    anotar("base_de_datos", estadoDe(baseResultado), `no se pudo leer current_database(): ${baseResultado.error}`);
    for (const nombre of ["nombre_sin_prod", "no_es_neondb", "hostname_no_produccion", "endpoint_base_no_produccion", "marcador_baseline_guard"]) {
      anotar(nombre, "ERROR", "no evaluada: no se pudo determinar el nombre de la base");
    }
    return contexto;
  }

  const base = baseResultado.rows[0].db;
  juzgar("base_de_datos", base === ENV_ESPERADO.base,
    base === ENV_ESPERADO.base
      ? `current_database() = ${JSON.stringify(base)}`
      : `current_database() = ${JSON.stringify(base)} (longitud ${base.length}), se esperaba ${JSON.stringify(ENV_ESPERADO.base)} (longitud ${ENV_ESPERADO.base.length})`);
  const prohibidos = ["prod", "production"].filter((nombre) => base.toLowerCase().includes(nombre));
  juzgar("nombre_sin_prod", prohibidos.length === 0,
    prohibidos.length ? `el nombre contiene ${prohibidos.join(", ")}` : "el nombre no contiene prod/production");
  juzgar("no_es_neondb", base !== "neondb", base === "neondb" ? "current_database() = neondb (PRODUCCION)" : "no es neondb");

  const host = url?.hostname ?? "";
  const shaHost = shaTexto(host);
  juzgar("hostname_no_produccion", shaHost !== ENV_ESPERADO.shaHostnameProduccion,
    shaHost === ENV_ESPERADO.shaHostnameProduccion
      ? "el hostname coincide EXACTAMENTE con el de PRODUCCION"
      : `hostname distinto al de produccion (sha ${shaHost.slice(0, 12)}...)`);
  const shaBase = shaTexto(endpointBase(host));
  juzgar("endpoint_base_no_produccion", shaBase !== ENV_ESPERADO.shaEndpointBaseProduccion,
    shaBase === ENV_ESPERADO.shaEndpointBaseProduccion
      ? "es la variante pooled/directa del endpoint de PRODUCCION"
      : `familia de endpoint distinta a la de produccion (sha ${shaBase.slice(0, 12)}...)`);

  const esperado = ENV_ESPERADO;
  const estructura = await consultar(
    `SELECT
      (SELECT count(*) FROM pg_namespace WHERE nspname = $1) AS hay_esquema,
      (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = $1 AND c.relname = $2 AND c.relkind = 'r') AS hay_tabla,
      (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2 AND column_name = $3) AS hay_columna`,
    [esperado.esquemaGuardia, esperado.tablaMarcador, esperado.columnaMarcador],
  );
  if (!estructura.ok) {
    anotar("marcador_baseline_guard", estadoDe(estructura), `no se pudo inspeccionar el catalogo: ${estructura.error}`);
    return contexto;
  }
  const { hay_esquema, hay_tabla, hay_columna } = estructura.rows[0];
  if (Number(hay_esquema) === 0) {
    juzgar("marcador_baseline_guard", false, `el esquema ${esperado.esquemaGuardia} no existe`);
  } else if (Number(hay_tabla) === 0) {
    juzgar("marcador_baseline_guard", false, `la tabla ${esperado.esquemaGuardia}.${esperado.tablaMarcador} no existe`);
  } else if (Number(hay_columna) === 0) {
    juzgar("marcador_baseline_guard", false, `la tabla ${esperado.esquemaGuardia}.${esperado.tablaMarcador} no tiene la columna oficial '${esperado.columnaMarcador}'`);
  } else {
    const valor = await consultar(`SELECT m.${esperado.columnaMarcador} AS valor FROM ${esperado.esquemaGuardia}.${esperado.tablaMarcador} m LIMIT 1`);
    if (!valor.ok) {
      anotar("marcador_baseline_guard", estadoDe(valor), `no se pudo leer el marcador: ${valor.error}`);
    } else {
      const marcador = valor.rows[0]?.valor ?? null;
      juzgar("marcador_baseline_guard", marcador === esperado.valorMarcador,
        marcador === null ? "la tabla del marcador existe pero no tiene ninguna fila"
          : marcador === esperado.valorMarcador ? `marcador correcto (${JSON.stringify(marcador)})`
            : `marcador incorrecto: ${JSON.stringify(marcador)}, se esperaba ${JSON.stringify(esperado.valorMarcador)}`);
    }
  }
  return contexto;
}

export async function verificarPreDDL(cliente, url, tablasProduccion) {
  const contexto = await verificarIdentidadComun(cliente, url);
  const { anotar, juzgar, consultar, estadoDe, guardas } = contexto;
  if (!Array.isArray(tablasProduccion)) {
    anotar("sin_tablas_de_produccion", "ERROR", "no evaluada: falta la lista oficial de tablas de A");
  } else {
    const tablas = await consultar(`SELECT c.relname AS tabla FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r'`);
    if (!tablas.ok) {
      anotar("sin_tablas_de_produccion", estadoDe(tablas), `no se pudo listar public: ${tablas.error}`);
    } else {
      const presentes = tablasProduccion.filter((tabla) => new Set(tablas.rows.map((fila) => fila.tabla)).has(tabla));
      juzgar("sin_tablas_de_produccion", presentes.length === 0,
        presentes.length ? `existen ${presentes.length} tabla(s) de produccion: ${presentes.slice(0, 5).join(", ")}` : "ninguna de las tablas de produccion existe en public");
    }
  }
  const publico = await consultar(`SELECT
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') AS tablas,
    (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype='e') AS enums,
    (SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public') AS policies`);
  if (!publico.ok) {
    anotar("public_vacio", estadoDe(publico), `no se pudo comprobar: ${publico.error}`);
  } else {
    const { tablas, enums, policies } = publico.rows[0];
    const vacio = Number(tablas) === 0 && Number(enums) === 0 && Number(policies) === 0;
    juzgar("public_vacio", vacio, vacio ? "public vacio (0 tablas, 0 enums, 0 policies)" : `public NO esta vacio: ${tablas} tablas, ${enums} enums, ${policies} policies`);
  }
  return { ok: guardas.every((guarda) => guarda.ok), guardas };
}

export async function verificarPostCommit(cliente, url) {
  const contexto = await verificarIdentidadComun(cliente, url);
  const { anotar, juzgar, consultar, estadoDe, guardas } = contexto;
  const estructura = await consultar(`SELECT
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname <> '_prisma_migrations') AS tablas_funcionales,
    (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype='e') AS enums,
    (SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public') AS policies`);
  if (!estructura.ok) {
    anotar("estructura_post_commit", estadoDe(estructura), `no se pudo comprobar el estado construido: ${estructura.error}`);
  } else {
    const { tablas_funcionales, enums, policies } = estructura.rows[0];
    const coincide = Number(tablas_funcionales) === POST_COMMIT_ESPERADO.tablas && Number(enums) === POST_COMMIT_ESPERADO.enums && Number(policies) === POST_COMMIT_ESPERADO.policies;
    juzgar("estructura_post_commit", coincide,
      `public construido: ${tablas_funcionales} tablas funcionales, ${enums} enums, ${policies} policies; se esperaban ${POST_COMMIT_ESPERADO.tablas}/${POST_COMMIT_ESPERADO.enums}/${POST_COMMIT_ESPERADO.policies}`);
  }
  return { ok: guardas.every((guarda) => guarda.ok), guardas };
}
