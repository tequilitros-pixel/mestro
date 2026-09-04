/*
 * Comparador canonico entre la captura de baseline_test y el
 * Manifiesto C oficial. Modulo PURO: sin I/O, sin red, testeable
 * con fixtures.
 *
 * Principio: se normaliza SOLO cuando la diferencia proviene de que
 * PostgreSQL escribe lo mismo de otra forma. Si la diferencia
 * pudiera cambiar el comportamiento de una consulta o de una
 * escritura, es REAL y se reporta.
 *
 * La lista de normalizaciones es CERRADA. Ante una representacion
 * no contemplada NO se inventa una regla: se marca NO_CLASIFICABLE
 * y el resultado global es FAIL. Nunca se relaja una regla para
 * hacer pasar una prueba.
 */

/* ---------------- Lista CERRADA de normalizaciones ---------------- */
export const NORMALIZACIONES = [
  { id: "N1", desc: "alias de tipo: DECIMAL <-> numeric (conservando precision y escala)" },
  { id: "N2", desc: "nombre de tipo en minusculas (TEXT <-> text)" },
  { id: "N3", desc: "metodo de indice implicito: null -> btree" },
  { id: "N4", desc: "direccion de indice implicita: null -> ASC" },
  { id: "N5", desc: "cast explicito anadido por PostgreSQL en un default ('X' -> 'X'::tipo)" },
  { id: "N6", desc: "TIMESTAMP(n) <-> timestamp(n) without time zone" },
  { id: "N7", desc: "tipo definido por el usuario entrecomillado: \"Enum\" y \"Enum\"[] (el sufijo [] se conserva)" },
];

const ALIAS_TIPO = { decimal: "numeric", "double precision": "double precision", int: "integer", int4: "integer", int8: "bigint", bool: "boolean" };

/* Normaliza un tipo SQL preservando SIEMPRE precision y escala.
 * DECIMAL(12,3) y DECIMAL(14,3) NUNCA colapsan al mismo valor. */
export function normalizarTipo(t) {
  if (t == null) return { valor: null, reglas: [] };
  const reglas = [];
  let s = String(t).trim().replace(/^"|"$/g, "");
  const bajo = s.toLowerCase();
  if (bajo !== s) reglas.push("N2");
  s = bajo;
  /* N6: PostgreSQL reporta "timestamp(3) without time zone"; el SQL
   * escribe "TIMESTAMP(3)". Mismo tipo. El sufijo se retira ANTES de
   * analizar la forma, porque de lo contrario no encaja en el patron.
   * "with time zone" es un tipo DISTINTO y no se toca. */
  if (/\bwithout time zone\b/.test(s)) { s = s.replace(/\s*without time zone\b/, ""); reglas.push("N6"); }
  /* N7: tipo definido por el usuario (un enum), que el catalogo y el
   * SQL escriben entrecomillado y puede llevar sufijo de array.
   * El nombre del enum NO se normaliza mas alla de las comillas, y
   * el sufijo [] se conserva: "UserRole" y "UserRole"[] son tipos
   * distintos y deben seguir siendolo. */
  const mu = s.match(/^"?([a-z_][a-z0-9_]*)"?(\[\])$/) || String(t).trim().match(/^"([A-Za-z_][A-Za-z0-9_]*)"(\[\])?$/);
  if (mu) {
    reglas.push("N7");
    return { valor: mu[1].toLowerCase() + (mu[2] ?? ""), reglas };
  }
  const m = s.match(/^([a-z ]+?)\s*(\(\s*\d+\s*(?:,\s*\d+\s*)?\))?(\[\])?$/);
  if (!m) return { valor: s, reglas, noClasificable: true };
  let base = m[1].trim();
  const args = (m[2] ?? "").replace(/\s+/g, "");
  if (ALIAS_TIPO[base] && ALIAS_TIPO[base] !== base) { base = ALIAS_TIPO[base]; reglas.push("N1"); }
  return { valor: base + args + (m[3] ?? ""), reglas };
}

/* Un default con cast anadido por PostgreSQL equivale al literal.
 * 'ACTIVO' == 'ACTIVO'::"EventAddedStatus". Pero 0 != 1. */
export function normalizarDefault(d) {
  if (d == null) return { valor: null, reglas: [] };
  const reglas = [];
  let s = String(d).trim();
  const sinCast = s.replace(/::\s*"?[A-Za-z_][A-Za-z0-9_ ]*"?(\[\])?$/, "").trim();
  if (sinCast !== s) { reglas.push("N5"); s = sinCast; }
  return { valor: s, reglas };
}

export const normalizarMetodo = (m) =>
  m == null ? { valor: "btree", reglas: ["N3"] } : { valor: String(m).toLowerCase(), reglas: [] };
export const normalizarDireccion = (d) =>
  d == null ? { valor: "ASC", reglas: ["N4"] } : { valor: String(d).toUpperCase(), reglas: [] };

/* ---------------- Motor de comparacion ---------------- */
export function crearComparacion() {
  const difs = [];
  const aplicadas = [];
  const registrar = (ruta, esperado, observado, reglas = [], clase = "DIFERENCIA") => {
    difs.push({ ruta, esperado, observado, reglas, clase });
  };
  const cmp = (ruta, esperado, observado, norm = null) => {
    let e = esperado, o = observado, reglas = [];
    if (norm) {
      const ne = norm(esperado), no = norm(observado);
      if (ne.noClasificable || no.noClasificable) {
        registrar(ruta, esperado, observado, [], "NO_CLASIFICABLE");
        return false;
      }
      e = ne.valor; o = no.valor;
      reglas = [...new Set([...ne.reglas, ...no.reglas])];
    }
    if (e === o) {
      if (reglas.length && JSON.stringify(esperado) !== JSON.stringify(observado))
        aplicadas.push({ ruta, reglas, esperado, observado });
      return true;
    }
    registrar(ruta, esperado, observado, reglas);
    return false;
  };
  return { difs, aplicadas, cmp, registrar };
}

/* Compara columnas: nombre, tipo, nullability, default. */
export function compararColumnas(K, esp, obs, tabla) {
  const byName = (a) => new Map(a.map((c) => [c.nombre ?? c.columna, c]));
  const E = byName(esp), O = byName(obs);
  for (const n of [...E.keys()].sort()) {
    const r = `${tabla}.${n}`;
    if (!O.has(n)) { K.registrar(`${r}`, "presente", "AUSENTE"); continue; }
    const e = E.get(n), o = O.get(n);
    K.cmp(`${r}.tipo`, e.tipo_sql ?? e.tipo, o.tipo_sql ?? o.tipo, normalizarTipo);
    const en = e.nullable ?? !e.not_null, on = o.nullable ?? !o.not_null;
    K.cmp(`${r}.nullable`, en, on);
    K.cmp(`${r}.default`, e.default_sql ?? e.por_defecto ?? null, o.default_sql ?? o.por_defecto ?? null, normalizarDefault);
  }
  for (const n of [...O.keys()].sort()) if (!E.has(n)) K.registrar(`${tabla}.${n}`, "AUSENTE", "presente");
}

/* Compara una FK campo a campo. CASCADE vs RESTRICT es diferencia real. */
export function compararFK(K, esp, obs, ruta) {
  K.cmp(`${ruta}.tabla_referenciada`, esp.tabla_referenciada, obs.tabla_referenciada);
  K.cmp(`${ruta}.columnas_locales`, JSON.stringify(esp.columnas_locales), JSON.stringify(obs.columnas_locales));
  K.cmp(`${ruta}.columnas_referenciadas`, JSON.stringify(esp.columnas_referenciadas), JSON.stringify(obs.columnas_referenciadas));
  K.cmp(`${ruta}.on_delete`, esp.on_delete, obs.on_delete);
  K.cmp(`${ruta}.on_update`, esp.on_update, obs.on_update);
}

/* Indices: unique, metodo (con N3), columnas EN ORDEN, direccion (N4). */
export function compararIndice(K, esp, obs, ruta) {
  K.cmp(`${ruta}.unique`, Boolean(esp.unique), Boolean(obs.unique));
  K.cmp(`${ruta}.metodo`, esp.metodo_explicito ?? esp.metodo ?? null, obs.metodo_explicito ?? obs.metodo ?? null, normalizarMetodo);
  const ce = esp.columnas ?? [], co = obs.columnas ?? [];
  if (ce.length !== co.length) {
    K.registrar(`${ruta}.columnas.longitud`, ce.length, co.length);
    return;
  }
  for (let i = 0; i < ce.length; i++) {
    K.cmp(`${ruta}.columnas[${i}].columna`, ce[i].columna, co[i].columna);
    K.cmp(`${ruta}.columnas[${i}].direccion`, ce[i].direccion_explicita ?? null, co[i].direccion_explicita ?? null, normalizarDireccion);
  }
}

/* Enums: el ORDEN es semantico. Mismo contenido en distinto orden = FAIL. */
export function compararEnums(K, esp, obs) {
  for (const n of Object.keys(esp).sort()) {
    if (!(n in obs)) { K.registrar(`enum.${n}`, "presente", "AUSENTE"); continue; }
    K.cmp(`enum.${n}.valores`, JSON.stringify(esp[n]), JSON.stringify(obs[n]));
  }
  for (const n of Object.keys(obs).sort()) if (!(n in esp)) K.registrar(`enum.${n}`, "AUSENTE", "presente");
}

/* RLS: enable y force por separado. */
export function compararRLS(K, esp, obs) {
  const idx = (a) => new Map(a.map((r) => [r.tabla, r]));
  const E = idx(esp), O = idx(obs);
  for (const t of [...E.keys()].sort()) {
    if (!O.has(t)) { K.registrar(`rls.${t}`, "presente", "AUSENTE"); continue; }
    K.cmp(`rls.${t}.enable_rls`, Boolean(E.get(t).enable_rls), Boolean(O.get(t).enable_rls));
    K.cmp(`rls.${t}.force_rls`, Boolean(E.get(t).force_rls), Boolean(O.get(t).force_rls));
  }
  for (const t of [...O.keys()].sort()) if (!E.has(t)) K.registrar(`rls.${t}`, "AUSENTE", "presente");
}

/*
 * Policies. La normalizacion de expresiones es CONSERVADORA: solo
 * colapsa espacios ENTRE tokens, nunca dentro de literales.
 * Si tras eso difieren, se clasifica REVISION_MANUAL en vez de
 * declarar PASS o inventar equivalencias.
 */
export function normalizarExpresion(x) {
  if (x == null) return null;
  /* Trocea preservando literales entre comillas simples intactos. */
  const partes = String(x).split(/('(?:[^']|'')*')/);
  return partes.map((p, i) => (i % 2 === 1 ? p : p.replace(/\s+/g, " ").trim())).join("").trim();
}

export function compararPolicies(K, esp, obs) {
  const clave = (p) => `${p.tabla}.${p.nombre}`;
  const E = new Map(esp.map((p) => [clave(p), p])), O = new Map(obs.map((p) => [clave(p), p]));
  for (const k of [...E.keys()].sort()) {
    if (!O.has(k)) { K.registrar(`policy.${k}`, "presente", "AUSENTE"); continue; }
    const e = E.get(k), o = O.get(k);
    K.cmp(`policy.${k}.comando`, e.comando, o.comando);
    K.cmp(`policy.${k}.roles`, e.roles, o.roles);
    K.cmp(`policy.${k}.permissive`, Boolean(e.permissive), Boolean(o.permissive));
    for (const campo of ["using", "with_check"]) {
      const ve = e[campo] ?? e[`${campo}_expr`] ?? null;
      const vo = o[campo] ?? o[`${campo}_expr`] ?? null;
      if (ve === vo) continue;
      const ne = normalizarExpresion(ve), no = normalizarExpresion(vo);
      if (ne === no) { K.aplicadas.push({ ruta: `policy.${k}.${campo}`, reglas: ["espaciado"], esperado: ve, observado: vo }); continue; }
      K.registrar(`policy.${k}.${campo}`, ve, vo, [], "REVISION_MANUAL");
    }
  }
  for (const k of [...O.keys()].sort()) if (!E.has(k)) K.registrar(`policy.${k}`, "AUSENTE", "presente");
}

/* Veredicto: PASS solo si no hay diferencias de ninguna clase. */
export function veredicto(K) {
  const reales = K.difs.filter((d) => d.clase === "DIFERENCIA");
  const manual = K.difs.filter((d) => d.clase === "REVISION_MANUAL");
  const noClas = K.difs.filter((d) => d.clase === "NO_CLASIFICABLE");
  return {
    estado: reales.length === 0 && manual.length === 0 && noClas.length === 0 ? "PASS" : "FAIL",
    diferencias: reales, revision_manual: manual, no_clasificables: noClas,
    normalizaciones_aplicadas: K.aplicadas,
  };
}
