/**
 * Paleta de colores consistente por puesto/rol estilo Connecteam.
 * Permite identificar de un vistazo el rol de cada persona en la planilla.
 */

const KNOWN_POSITION_COLORS: Record<string, string> = {
  // Barra / Bebidas
  bartender: "#8b5cf6", // Violeta
  barra: "#8b5cf6",
  barman: "#8b5cf6",
  barista: "#a855f7",
  cocteleria: "#7c3aed",

  // Cocina / Alimentos
  cocina: "#f97316", // Naranja brillante
  cocinero: "#f97316",
  chef: "#ea580c",
  parrilla: "#fb923c",
  ayudante_cocina: "#fdba74",
  planchero: "#f97316",

  // Sala / Piso / Servicio
  mesero: "#06b6d4", // Cyan
  mesera: "#06b6d4",
  piso: "#0891b2",
  servicio: "#0284c7",
  garrotero: "#38bdf8",
  runner: "#38bdf8",

  // Cobro / Administración
  caja: "#10b981", // Verde esmeralda
  cajero: "#10b981",
  cajera: "#10b981",
  admon: "#059669",

  // Supervisión / Mando
  capitan: "#eab308", // Dorado / Ámbar
  gerente: "#ca8a04",
  encargado: "#d97706",
  supervisor: "#b45309",

  // Seguridad / Puerta
  seguridad: "#64748b", // Pizarra / Gris
  cadenero: "#64748b",
  puerta: "#475569",

  // Operaciones / Mantenimiento
  limpieza: "#0ea5e9", // Azul cielo
  steward: "#0ea5e9",
  lavalozas: "#0284c7",
};

/** Paleta de reserva para puestos no mapeados directamente */
const FALLBACK_PALETTE = [
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#10b981",
  "#ec4899",
  "#3b82f6",
  "#f43f5e",
  "#14b8a6",
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

export function getPositionColor(position: string | null | undefined): string {
  if (!position || !position.trim()) {
    return "#94a3b8"; // Slate neutro si no tiene puesto
  }

  const normalized = normalize(position);

  // Coincidencia directa
  if (KNOWN_POSITION_COLORS[normalized]) {
    return KNOWN_POSITION_COLORS[normalized];
  }

  // Búsqueda por palabra clave contenida
  for (const [key, color] of Object.entries(KNOWN_POSITION_COLORS)) {
    if (normalized.includes(key)) {
      return color;
    }
  }

  // Hash determinista para puestos personalizados
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % FALLBACK_PALETTE.length;
  return FALLBACK_PALETTE[index];
}
