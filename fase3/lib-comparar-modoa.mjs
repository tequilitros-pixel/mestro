/*
 * Preparacion de datos + comparacion que usa MODO A.
 *
 * Vive aqui, y no dentro del ejecutor, para que las pruebas
 * end-to-end ejerciten EXACTAMENTE el mismo camino que correra
 * contra la base real: captura -> canonizacion -> lib-comparar -> C.
 * Si esta logica estuviera duplicada en la prueba, la prueba podria
 * pasar mientras el ejecutor falla.
 *
 * Modulo puro: sin I/O, sin red.
 */
import * as K from "./lib-comparar.mjs";

/* O = captura de baseline_test (formato de capturar-baseline-test.mjs)
 * C = manifiesto C oficial */
export function compararCapturaContraC(O, C) {
  /* ---- 7. Comparacion estructural contra C ---- */
  const cmp = K.crearComparacion();

  const espTablas = [...C.heredado_de_A.tablas, ...C.agregado_por_B.tablas].sort();
  const obsTablas = [...(O.aplicacion?.tablas ?? [])].sort();
  for (const t of espTablas) if (!obsTablas.includes(t)) cmp.registrar(`tabla.${t}`, "presente", "AUSENTE");
  for (const t of obsTablas) if (!espTablas.includes(t)) cmp.registrar(`tabla.${t}`, "AUSENTE", "presente");

  /* Columnas: las heredadas vienen de A; las nuevas, de B. */
  const colsEsp = { ...C.heredado_de_A.columnas };
  for (const [t, d] of Object.entries(C.agregado_por_B.estructura)) colsEsp[t] = d.columnas;
  for (const [t, esp] of Object.entries(colsEsp)) {
    const obs = O.aplicacion?.columnas?.[t];
    if (!obs) { cmp.registrar(`columnas.${t}`, "presente", "AUSENTE"); continue; }
    K.compararColumnas(cmp, esp, obs, t);
  }

  /* Enums: orden semantico incluido. */
  const enumsEsp = {
    ...C.heredado_de_A.enums,
    ...C.agregado_por_B.enums,
    ...(C.modificado_por_B?.enums ?? {}),
  };
  const norm = (v) => (Array.isArray(v) ? v : Object.values(v ?? {}));
  K.compararEnums(cmp,
    Object.fromEntries(Object.entries(enumsEsp).map(([k, v]) => [k, norm(v)])),
    Object.fromEntries(Object.entries(O.enums ?? {}).map(([k, v]) => [k, norm(v)])));

  /* Indices y constraints de las tablas nuevas, descompuestos. */
  for (const [t, d] of Object.entries(C.agregado_por_B.estructura)) {
    const obsIdx = O.aplicacion?.indices?.[t] ?? [];
    /* Se compara el conjunto EFECTIVO: los CREATE INDEX del SQL mas
     * los indices que PostgreSQL materializa por cada PRIMARY KEY.
     * El catalogo muestra ambos. */
    for (const esp of d.indices_efectivos) {
      const o = obsIdx.find((x) => (x.indice ?? x.nombre) === esp.nombre);
      if (!o) { cmp.registrar(`indice.${esp.nombre}`, "presente", "AUSENTE"); continue; }
      K.compararIndice(cmp, esp, { unique: o.es_unico ?? o.unique, metodo_explicito: o.metodo ?? null,
        columnas: (o.columnas ?? []).map((c) => (typeof c === "string" ? { columna: c, direccion_explicita: null } : c)) },
        `indice.${esp.nombre}`);
    }
    const obsCon = (O.aplicacion?.constraints?.[t] ?? []).map((x) => x.constraint ?? x.nombre);
    for (const pk of d.primary_keys) if (!obsCon.includes(pk.nombre)) cmp.registrar(`pk.${pk.nombre}`, "presente", "AUSENTE");
    for (const fk of d.foreign_keys) if (!obsCon.includes(fk.nombre)) cmp.registrar(`fk.${fk.nombre}`, "presente", "AUSENTE");
  }

  /* ---- 8. RLS y policies ---- */
  K.compararRLS(cmp, C.heredado_de_A.rls, O.aplicacion?.rls ?? []);
  K.compararPolicies(cmp, C.heredado_de_A.policies, O.aplicacion?.policies ?? []);


  return { cmp, veredicto: K.veredicto(cmp) };
}

/* Conteos observados en la captura, en el mismo formato que C.conteos */
export function conteosObservados(O) {
  const sumar = (d) => Object.values(d ?? {}).reduce((s, x) => s + x.length, 0);
  return {
    tablas: (O.aplicacion?.tablas ?? []).length,
    enums: Object.keys(O.enums ?? {}).length,
    columnas: sumar(O.aplicacion?.columnas),
    indices: sumar(O.aplicacion?.indices),
    constraints: sumar(O.aplicacion?.constraints),
    rls: (O.aplicacion?.rls ?? []).length,
    policies: (O.aplicacion?.policies ?? []).length,
    funciones: (O.aplicacion?.funciones ?? []).length,
    triggers: (O.aplicacion?.triggers ?? []).length,
    secuencias: (O.secuencias ?? []).length,
  };
}
