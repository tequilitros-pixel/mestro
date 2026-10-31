/**
 * Un producto de POS se identifica visualmente con una imagen subida
 * (URL de Vercel Blob o ruta local en /public) o un color de fondo plano.
 * Todo se guarda en el mismo campo `icon` (string) del producto:
 * - Empieza con "http", "/" o "data:image/" → es una URL de imagen.
 * - Empieza con "#" → es un color hexadecimal.
 * - Vacío/null → sin imagen ni color asignado (se usa fallback inteligente o color por defecto).
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

// Catálogo oficial de fotografías locales en alta definición para bebidas de Tequilitros
export const DEFAULT_PRODUCT_IMAGES: Record<string, string> = {
  vampiro: "/tequilitros/productos/vampiro.png",
  paloma: "/tequilitros/productos/paloma.png",
  cantarito: "/tequilitros/productos/cantarito.png",
  tequimiche: "/tequilitros/productos/tequimiche.png",
  tequimojito: "/tequilitros/productos/tequimojito.png",
  tequimora: "/tequilitros/productos/tequimora.png",
  coscorron: "/tequilitros/cantarito.jpg",
  coscorrón: "/tequilitros/cantarito.jpg",
  tequimango: "/tequilitros/tequimango.jpg",
  mango: "/tequilitros/tequimango.jpg",
  blanco: "/tequilitros/blanco.jpg",
  reposado: "/tequilitros/reposado.jpg",
  zarzamora: "/tequilitros/zarzamora.jpg",
};

export type ProductVisual =
  | { type: "image"; url: string }
  | { type: "color"; hex: string };

export function getProductVisual(
  icon: string | null | undefined,
  productName?: string,
): ProductVisual {
  const value = (icon ?? "").trim();

  // 1. Imagen explícita (URL completa o ruta local en /public)
  if (value.startsWith("http") || value.startsWith("/") || value.startsWith("data:image/")) {
    return { type: "image", url: value };
  }

  // 2. Fallback inteligente por nombre de producto si coincide con el catálogo oficial
  if (productName) {
    const key = productName.toLowerCase().trim();
    if (DEFAULT_PRODUCT_IMAGES[key]) {
      return { type: "image", url: DEFAULT_PRODUCT_IMAGES[key] };
    }
  }

  // 3. Color hexadecimal
  if (/^#[0-9a-fA-F]{6}$/.test(value)) {
    return { type: "color", hex: value };
  }

  return { type: "color", hex: DEFAULT_PRODUCT_COLOR };
}
