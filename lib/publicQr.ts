export type PublicQrPayload = {
  product: {
    commercialName: string;
    type: string;
    className: string;
    presentation: string;
    alcoholPercent: string;
  };
  identification: {
    lotCode: string;
    elaborationDate: string;
    bottlingDate: string;
    bottleNumber: string;
    totalBottles: string;
  };
  origin: {
    place: string;
    producer: string;
    agaveOrigin: string;
    region: string;
    agaveVariety: string;
    harvestYear: string;
  };
  process: {
    cookingMethod: string;
    cookingDate: string;
    milling: string;
    fermentation: string;
    fermentationDuration: string;
    distillations: string;
    distillationDate: string;
    obtainedAlcohol: string;
    adjustmentWater: string;
    barrelType: string;
    barrelMaterial: string;
    barrelOrigin: string;
    maturationTime: string;
    barrelEntryDate: string;
    barrelExitDate: string;
  };
  consumer: {
    introduction: string;
    description: string;
    aroma: string;
    flavor: string;
    body: string;
    finish: string;
    tastingNotes: string;
    recommendation: string;
    temperature: string;
    pairing: string;
  };
  traceability: {
    nom: string;
    authorizedProducer: string;
    certificateNumber: string;
    certificationReference: string;
    internalCode: string;
    contact: string;
    website: string;
  };
};

export type PublicQrVisibility = Record<string, boolean>;

export type PublicQrRecord = {
  id: string;
  publicId: string;
  batchId: string | null;
  lotId: string | null;
  productName: string;
  lotCode: string | null;
  payload: PublicQrPayload;
  visibility: PublicQrVisibility;
  status: "BORRADOR" | "PUBLICADO" | "ARCHIVADO";
  createdAt: string;
  publishedAt: string | null;
  updatedAt: string;
};

export const DEFAULT_INTRO =
  "Tequila elaborado por Casa Destiladora del Norte en Colotlán, Jalisco.";

/** Ubicación exacta de la planta, usada sólo para enlazar el mapa público. */
export const DESTILLERY_MAP_URL =
  "https://www.google.com/maps/place/Planta+de+destilacion,+destiladora+del+norte/data=!4m2!3m1!1s0x0:0x655db339a1ebb40b?sa=X&ved=1t:2428&ictx=111";

export function publicMapUrl(place: string | null | undefined) {
  const value = place?.trim() ?? "";
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (
    !normalized ||
    normalized === "colotlan, jalisco" ||
    normalized === "casa destiladora del norte, colotlan, jalisco"
  ) {
    return DESTILLERY_MAP_URL;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${value}, México`)}`;
}

export const VISIBILITY_LABELS: Record<string, string> = {
  productType: "Tipo de tequila",
  productClass: "Clase",
  presentation: "Presentación",
  lotCode: "Lote",
  elaborationDate: "Fecha de elaboración",
  bottlingDate: "Fecha de envasado",
  alcoholPercent: "% Alc. Vol.",
  place: "Lugar de elaboración",
  producer: "Productor",
  agaveOrigin: "Origen del agave",
  region: "Región",
  agaveVariety: "Variedad de agave",
  harvestYear: "Año/cosecha del agave",
  process: "Proceso",
  barrel: "Barrica",
  cookingMethod: "Método de cocción",
  cookingDate: "Fecha de cocción",
  milling: "Molienda",
  fermentation: "Fermentación",
  fermentationDuration: "Duración de fermentación",
  distillations: "Número de destilaciones",
  distillationDate: "Fecha de destilación",
  obtainedAlcohol: "Graduación obtenida",
  adjustmentWater: "Agua de ajuste",
  barrelType: "Tipo de barrica",
  barrelMaterial: "Material de barrica",
  barrelOrigin: "Procedencia de barrica",
  maturationTime: "Tiempo de maduración",
  barrelEntryDate: "Entrada a barrica",
  barrelExitDate: "Salida de barrica",
  introduction: "Introducción",
  description: "Descripción",
  aroma: "Aroma",
  flavor: "Sabor",
  body: "Cuerpo",
  finish: "Final",
  tastingNotes: "Notas de cata",
  recommendation: "Recomendación de consumo",
  temperature: "Temperatura recomendada",
  pairing: "Maridaje",
  nom: "NOM",
  authorizedProducer: "Productor autorizado",
  certificateNumber: "Número de certificado",
  certificationReference: "Referencia de certificación",
  internalCode: "Código interno",
  contact: "Contacto",
  website: "Página web",
};

export const DEFAULT_VISIBILITY: PublicQrVisibility = Object.fromEntries(
  Object.keys(VISIBILITY_LABELS).map((key) => [key, !["certificateNumber", "internalCode"].includes(key)]),
);

export function emptyPayload(): PublicQrPayload {
  return {
    product: { commercialName: "", type: "Tequila", className: "Blanco", presentation: "1 L", alcoholPercent: "" },
    identification: { lotCode: "", elaborationDate: "", bottlingDate: "", bottleNumber: "", totalBottles: "" },
    origin: { place: "Colotlán, Jalisco", producer: "Casa Destiladora del Norte", agaveOrigin: "Agave tequilana Weber variedad azul", region: "Colotlán, Jalisco", agaveVariety: "Agave tequilana Weber variedad azul", harvestYear: "" },
    process: { cookingMethod: "", cookingDate: "", milling: "", fermentation: "", fermentationDuration: "", distillations: "", distillationDate: "", obtainedAlcohol: "", adjustmentWater: "", barrelType: "", barrelMaterial: "", barrelOrigin: "", maturationTime: "", barrelEntryDate: "", barrelExitDate: "" },
    consumer: { introduction: DEFAULT_INTRO, description: "", aroma: "", flavor: "", body: "", finish: "", tastingNotes: "", recommendation: "", temperature: "", pairing: "" },
    traceability: { nom: "", authorizedProducer: "", certificateNumber: "", certificationReference: "", internalCode: "", contact: "", website: "" },
  };
}

export function parseBatchCodeDate(code: string | null | undefined) {
  const match = code?.match(/^[^-]+-(\d{2})-(\d{2})-(\d{4})-/);
  if (!match) return "";
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

export function formatIsoDate(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(`${value}T00:00:00Z`) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function dateForDisplay(value: string | null | undefined) {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

export function isVisible(visibility: PublicQrVisibility, key: string) {
  return visibility[key] !== false;
}
