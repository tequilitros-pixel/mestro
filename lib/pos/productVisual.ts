/**
 * Un producto de POS se identifica visualmente con una imagen subida
 * (URL de Vercel Blob) o, si no hay imagen, un color de fondo plano.
 * Todo se guarda en el mismo campo `icon` (string) del producto:
 * - Empieza con "http" → es una URL de imagen subida.
 * - Empieza con "#" → es un color hexadecimal.
 * - Vacío/null → sin imagen ni color asignado (se usa un gris neutro).
 */

export const PRODUCT_COLORS = [
  "#EF4444", // rojo
  "#F97316", // naranja
  "#F59E0B", // ámbar
  "#EAB308", // amarillo
  "#84CC16", // lima
  "#22C55E", // verde
  "#14B8A6", // verde azulado
  "#06B6D4", // cian
  "#3B82F6", // azul
  "#8B5CF6", // violeta
  "#EC4899", // rosa
  "#78716C", // gris cálido
] as const;

export const DEFAULT_PRODUCT_COLOR = "#78716C";

export type ProductVisual =
  | { type: "image"; url: string }
  | { type: "color"; hex: string };

export function getProductVisual(icon: string | null | undefined): ProductVisual {
  const value = (icon ?? "").trim();

  if (value.startsWith("http")) {
    return { type: "image", url: value };
  }

  if (/^#[0-9a-fA-F]{6}$/.test(value)) {
    return { type: "color", hex: value };
  }

  return { type: "color", hex: DEFAULT_PRODUCT_COLOR };
}
