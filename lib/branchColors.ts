/**
 * ==========================================================
 * MAESTRO
 * ----------------------------------------------------------
 * Paleta compartida para identificar sucursales visualmente
 * (cuadrícula de Horario, selector de color en Sucursales).
 *
 * Si una sucursal no tiene `color` asignado todavía, se le
 * asigna uno de esta paleta de forma determinística (mismo
 * color siempre para la misma sucursal) para que la cuadrícula
 * se vea diferenciada sin obligar a configurar nada antes.
 * ==========================================================
 */

export const BRANCH_COLOR_PALETTE = [
  "#6C5CE7", "#00B894", "#0984E3", "#E17055",
  "#E1B12C", "#E84393", "#00A8A8", "#636E72",
];

export function fallbackBranchColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return BRANCH_COLOR_PALETTE[hash % BRANCH_COLOR_PALETTE.length];
}
