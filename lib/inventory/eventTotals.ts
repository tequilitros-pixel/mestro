import "server-only";

/*
 * ============================================================
 * Consolidacion de existencia y consumo de un evento
 * ------------------------------------------------------------
 * Un mismo producto puede llegar al evento por dos caminos:
 *   1. La salida original (ServiceEventItem)
 *   2. Lo conseguido durante el evento (EventAddedProduct)
 *
 * El Reconteo necesita el TOTAL consolidado, no dos renglones
 * separados que el usuario tenga que sumar de cabeza.
 *
 * Funciones puras: no tocan Prisma ni la red, para poder
 * probarlas sin base de datos.
 * ============================================================
 */

/** Cantidades ya normalizadas a la unidad interna (ml, g o piezas). */
export type OrigenSalida = {
  /** Confirmado en la salida. Si aun no se confirma, lo planeado. */
  cantidad: number;
  /** Costo unitario del inventario que salio. */
  costoUnitario: number | null;
};

export type OrigenAnadido = {
  cantidad: number;
  /** Costo TOTAL de esa partida, no unitario. */
  costoTotal: number | null;
  tipo: "COMPRA_EVENTO" | "ENVIO_SUCURSAL" | "ENVIO_ALMACEN" | "PRESTAMO" | "OTRO";
  cancelado: boolean;
};

export type TotalesProducto = {
  salidaOriginal: number;
  anadido: number;
  disponibleTotal: number;
  regresado: number;
  consumo: number;
  /** Costo del inventario que salio de sucursal. */
  costoSalida: number;
  /** Costo de lo conseguido durante el evento. */
  costoAnadido: number;
  /** Costo unitario promedio ponderado entre ambos origenes. */
  costoUnitarioPromedio: number | null;
  costoConsumido: number;
  valorRegresado: number;
};

const redondear = (n: number) => Math.round(n * 1000) / 1000;
const dinero = (n: number) => Math.round(n * 100) / 100;

/**
 * Consolida un producto. Las cantidades entran normalizadas.
 *
 * Los cancelados se ignoran por completo: no suman existencia ni
 * costo, pero siguen existiendo en la base para la bitacora.
 */
export function consolidarProducto(
  salida: OrigenSalida | null,
  anadidos: OrigenAnadido[],
  regresado: number,
): TotalesProducto {
  const vigentes = anadidos.filter((a) => !a.cancelado);

  const salidaOriginal = redondear(salida?.cantidad ?? 0);
  const anadido = redondear(vigentes.reduce((s, a) => s + a.cantidad, 0));
  const disponibleTotal = redondear(salidaOriginal + anadido);

  // El regreso no puede exceder lo disponible: si excede, algo se
  // capturo mal y es mejor topar que reportar consumo negativo.
  const regresadoReal = redondear(Math.min(Math.max(regresado, 0), disponibleTotal));
  const consumo = redondear(disponibleTotal - regresadoReal);

  const costoSalida = dinero(salidaOriginal * (salida?.costoUnitario ?? 0));
  const costoAnadido = dinero(vigentes.reduce((s, a) => s + (a.costoTotal ?? 0), 0));

  const costoUnitarioPromedio =
    disponibleTotal > 0 ? (costoSalida + costoAnadido) / disponibleTotal : null;

  return {
    salidaOriginal,
    anadido,
    disponibleTotal,
    regresado: regresadoReal,
    consumo,
    costoSalida,
    costoAnadido,
    costoUnitarioPromedio:
      costoUnitarioPromedio === null ? null : Math.round(costoUnitarioPromedio * 10000) / 10000,
    costoConsumido: dinero(consumo * (costoUnitarioPromedio ?? 0)),
    valorRegresado: dinero(regresadoReal * (costoUnitarioPromedio ?? 0)),
  };
}

/**
 * Convierte cantidad en unidad de manejo a la unidad interna.
 * 4 botellas de 1.8 L -> 7200 ml
 */
export function normalizar(
  cantidad: number,
  contenidoPorUnidad: number | null,
  unidadContenido: string | null,
): number {
  if (contenidoPorUnidad === null || contenidoPorUnidad <= 0) return redondear(cantidad);

  const aBase: Record<string, number> = { L: 1000, KG: 1000, ML: 1, G: 1, PIEZAS: 1 };
  const factor = aBase[unidadContenido ?? "PIEZAS"] ?? 1;

  return redondear(cantidad * contenidoPorUnidad * factor);
}

/** Vuelve de la unidad interna a unidades de manejo, para mostrar. */
export function desnormalizar(
  normalizada: number,
  contenidoPorUnidad: number | null,
  unidadContenido: string | null,
): { unidades: number; remanente: number } {
  if (contenidoPorUnidad === null || contenidoPorUnidad <= 0) {
    return { unidades: redondear(normalizada), remanente: 0 };
  }
  const aBase: Record<string, number> = { L: 1000, KG: 1000, ML: 1, G: 1, PIEZAS: 1 };
  const porUnidad = contenidoPorUnidad * (aBase[unidadContenido ?? "PIEZAS"] ?? 1);

  return {
    unidades: Math.floor(normalizada / porUnidad),
    remanente: redondear(normalizada % porUnidad),
  };
}
