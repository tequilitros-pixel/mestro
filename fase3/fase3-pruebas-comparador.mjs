/* Casos positivos y negativos del comparador. Sin base de datos. */
import * as K from "./lib-comparar.mjs";

let fallos = 0;
const ok = (c, d) => { console.log(`  ${c ? "PASA" : "*** FALLA ***"}  ${d}`); if (!c) fallos++; };
const nuevo = () => K.crearComparacion();
const v = (c) => K.veredicto(c);

/* --- tipos --- */
console.log("TIPOS");
{ const c = nuevo(); c.cmp("t.tipo", "DECIMAL(12,3)", "numeric(12,3)", K.normalizarTipo);
  ok(v(c).estado === "PASS", "DECIMAL(12,3) == numeric(12,3)  [N1]"); }
{ const c = nuevo(); c.cmp("t.tipo", "TEXT", "text", K.normalizarTipo);
  ok(v(c).estado === "PASS", "TEXT == text  [N2]"); }
{ const c = nuevo(); c.cmp("t.tipo", "TIMESTAMP(3)", "timestamp(3) without time zone", K.normalizarTipo);
  ok(v(c).estado === "PASS", "TIMESTAMP(3) == timestamp(3) without time zone  [N6]"); }
{ const c = nuevo(); c.cmp("t.tipo", "DECIMAL(12,3)", "numeric(14,3)", K.normalizarTipo);
  const r = v(c); ok(r.estado === "FAIL" && r.diferencias[0].ruta === "t.tipo", "DECIMAL(12,3) != numeric(14,3) -> FAIL"); }
{ const c = nuevo(); c.cmp("t.tipo", "DECIMAL(12,4)", "numeric(12,2)", K.normalizarTipo);
  ok(v(c).estado === "FAIL", "escala distinta -> FAIL"); }

/* --- nullability --- */
console.log("\nNULLABILITY");
{ const c = nuevo(); K.compararColumnas(c, [{nombre:"x",tipo_sql:"TEXT",nullable:false,default_sql:null}],
                                            [{nombre:"x",tipo_sql:"text",nullable:false,default_sql:null}], "T");
  ok(v(c).estado === "PASS", "NOT NULL == NOT NULL"); }
{ const c = nuevo(); K.compararColumnas(c, [{nombre:"x",tipo_sql:"TEXT",nullable:false,default_sql:null}],
                                            [{nombre:"x",tipo_sql:"text",nullable:true,default_sql:null}], "T");
  const r = v(c); ok(r.estado === "FAIL" && r.diferencias.some(d=>d.ruta==="T.x.nullable"), "NOT NULL != nullable -> FAIL"); }

/* --- defaults --- */
console.log("\nDEFAULTS");
{ const c = nuevo(); c.cmp("d", "'ACTIVO'", `'ACTIVO'::"EventAddedStatus"`, K.normalizarDefault);
  ok(v(c).estado === "PASS", "'ACTIVO' == 'ACTIVO'::\"EventAddedStatus\"  [N5]"); }
{ const c = nuevo(); c.cmp("d", "0", "1", K.normalizarDefault);
  ok(v(c).estado === "FAIL", "default 0 != 1 -> FAIL"); }
{ const c = nuevo(); c.cmp("d", "'ACTIVO'", "'CANCELADO'", K.normalizarDefault);
  ok(v(c).estado === "FAIL", "default 'ACTIVO' != 'CANCELADO' -> FAIL"); }

/* --- FK --- */
console.log("\nFOREIGN KEYS");
const fk = (od) => ({tabla_referenciada:"User",columnas_locales:["addedById"],columnas_referenciadas:["id"],on_delete:od,on_update:"CASCADE"});
{ const c = nuevo(); K.compararFK(c, fk("RESTRICT"), fk("RESTRICT"), "fk1");
  ok(v(c).estado === "PASS", "RESTRICT == RESTRICT"); }
{ const c = nuevo(); K.compararFK(c, fk("CASCADE"), fk("RESTRICT"), "fk1");
  const r = v(c); ok(r.estado === "FAIL" && r.diferencias.some(d=>d.ruta==="fk1.on_delete"), "CASCADE != RESTRICT -> FAIL"); }

/* --- enums --- */
console.log("\nENUMS");
{ const c = nuevo(); K.compararEnums(c, {E:["A","B","C"]}, {E:["A","B","C"]});
  ok(v(c).estado === "PASS", "mismo orden == PASS"); }
{ const c = nuevo(); K.compararEnums(c, {E:["ACTIVO","CANCELADO"]}, {E:["CANCELADO","ACTIVO"]});
  ok(v(c).estado === "FAIL", "mismo contenido, distinto orden -> FAIL"); }

/* --- indices --- */
console.log("\nINDICES");
const ix = (cols, uniq=false, met=null) => ({unique:uniq,metodo_explicito:met,columnas:cols.map(x=>({columna:x,direccion_explicita:null}))});
{ const c = nuevo(); K.compararIndice(c, ix(["a"]), {...ix(["a"]), metodo_explicito:"btree"}, "i1");
  ok(v(c).estado === "PASS", "metodo implicito null == btree observado  [N3]"); }
{ const c = nuevo(); K.compararIndice(c, ix(["a","b"]), ix(["b","a"]), "i1");
  ok(v(c).estado === "FAIL", "columnas en distinto orden -> FAIL"); }
{ const c = nuevo(); K.compararIndice(c, ix(["a"],false), ix(["a"],true), "i1");
  const r = v(c); ok(r.estado === "FAIL" && r.diferencias.some(d=>d.ruta==="i1.unique"), "unique distinto -> FAIL"); }
{ const c = nuevo();
  const e = {unique:false,metodo_explicito:null,columnas:[{columna:"a",direccion_explicita:null}]};
  const o = {unique:false,metodo_explicito:"btree",columnas:[{columna:"a",direccion_explicita:"ASC"}]};
  K.compararIndice(c, e, o, "i1");
  ok(v(c).estado === "PASS", "direccion implicita null == ASC observado  [N4]"); }
{ const c = nuevo();
  const e = {unique:false,metodo_explicito:null,columnas:[{columna:"a",direccion_explicita:null}]};
  const o = {unique:false,metodo_explicito:"btree",columnas:[{columna:"a",direccion_explicita:"DESC"}]};
  K.compararIndice(c, e, o, "i1");
  ok(v(c).estado === "FAIL", "ASC implicito != DESC -> FAIL"); }

/* --- RLS --- */
console.log("\nRLS");
const rls = (e,f) => [{tabla:"PosSale",enable_rls:e,force_rls:f}];
{ const c = nuevo(); K.compararRLS(c, rls(true,true), rls(true,true)); ok(v(c).estado === "PASS", "enable+force iguales"); }
{ const c = nuevo(); K.compararRLS(c, rls(true,true), rls(true,false));
  const r=v(c); ok(r.estado==="FAIL" && r.diferencias.some(d=>d.ruta.includes("force_rls")), "force distinto -> FAIL"); }
{ const c = nuevo(); K.compararRLS(c, rls(true,true), rls(false,true));
  ok(v(c).estado === "FAIL", "enable distinto -> FAIL"); }

/* --- policies --- */
console.log("\nPOLICIES");
const pol = (u) => [{tabla:"PosSale",nombre:"p",comando:"*",roles:"public",permissive:true,using:u,with_check:u}];
{ const c = nuevo(); K.compararPolicies(c, pol("(a = b)"), pol("(a  =   b)"));
  ok(v(c).estado === "PASS", "solo difiere espaciado entre tokens -> PASS"); }
{ const c = nuevo(); K.compararPolicies(c, pol("(a = 'x  y')"), pol("(a = 'x y')"));
  const r = v(c); ok(r.estado === "FAIL" && r.revision_manual.length === 2,
    "espacios DENTRO de un literal NO se normalizan -> REVISION_MANUAL (using+with_check)"); }
{ const c = nuevo(); K.compararPolicies(c, pol("(a = b)"), pol("(a = c)"));
  const r = v(c); ok(r.estado === "FAIL" && r.revision_manual.length === 2 && r.revision_manual.every(x=>x.clase==="REVISION_MANUAL"),
    "expresion distinta -> REVISION_MANUAL, nunca PASS"); }
{ const c = nuevo(); K.compararPolicies(c, pol("(a=b)"), [{...pol("(a=b)")[0], roles:"admin"}]);
  ok(v(c).estado === "FAIL", "roles distintos -> FAIL"); }

/* --- no clasificable --- */
console.log("\nNO CLASIFICABLE");
{ const c = nuevo(); c.cmp("t.tipo", "DECIMAL(12,3)", "algo::raro<>", K.normalizarTipo);
  const r = v(c); ok(r.estado === "FAIL" && r.no_clasificables.length === 1,
    "representacion no contemplada -> NO_CLASIFICABLE, no se inventa regla"); }

/* --- registro de normalizaciones --- */
console.log("\nAUDITABILIDAD");
{ const c = nuevo(); c.cmp("t.tipo", "DECIMAL(12,3)", "numeric(12,3)", K.normalizarTipo);
  const r = v(c);
  ok(r.normalizaciones_aplicadas.length === 1 && r.normalizaciones_aplicadas[0].reglas.includes("N1"),
    "cada normalizacion queda registrada con su regla"); }
ok(K.NORMALIZACIONES.length === 7, `lista cerrada de normalizaciones: ${K.NORMALIZACIONES.length} reglas`);
ok(K.NORMALIZACIONES.some((n) => n.id === "N7"), "N7 (tipo de usuario / array de enum) documentada");
{ const c = nuevo(); c.cmp("t", '"UserRole"[]', '"UserRole"[]', K.normalizarTipo);
  ok(v(c).estado === "PASS", 'array de enum "UserRole"[] identico -> PASS  [N7]'); }
{ const c = nuevo(); c.cmp("t", '"UserRole"[]', '"UserRole"', K.normalizarTipo);
  ok(v(c).estado === "FAIL", 'array vs escalar -> FAIL (el sufijo [] no se descarta)'); }

console.log(`\n${"=".repeat(56)}\n${fallos===0?"COMPARADOR: TODAS LAS PRUEBAS PASAN":fallos+" FALLOS"}\n${"=".repeat(56)}`);
process.exit(fallos ? 1 : 0);
