/**
 * ==========================================================
 * MAESTRO
 * ----------------------------------------------------------
 * Origen de una botella.
 *
 * Una botella puede venir de dos lados:
 *  - De una ELABORACIÓN de licor (LiquorBatch), con su receta.
 *  - De una existencia A GRANEL (RawMaterial), como el tequila
 *    blanco, que sale del proceso de agave y no se elabora con
 *    receta.
 *
 * Estas funciones normalizan ambos casos para que las pantallas
 * no tengan que repetir el mismo `if` en cada campo.
 * ==========================================================
 */

type BatchLike = {
  code: string;
  productionDate?: Date | null;
  expirationDate?: Date | null;
  finalAlcohol?: number | null;
  initialAlcohol?: number | null;
  product?: {
    name: string;
    icon?: string | null;
    description?: string | null;
    defaultAlcohol?: number | null;
    slug?: string | null;
  } | null;
  recipe?: { name?: string; version?: number; targetAlcohol?: number | null } | null;
} | null;

type RawMaterialLike = {
  code: string;
  name: string;
  category?: string | null;
  description?: string | null;
} | null;

export type BottleOrigin = {
  /** Nombre comercial que se muestra en etiquetas y pantallas. */
  productName: string;
  productIcon: string | null;
  productDescription: string | null;
  /** Código del lote de elaboración, o del material a granel. */
  sourceCode: string;
  /** Etiqueta legible del tipo de origen. */
  sourceLabel: string;
  /** true cuando la botella salió de una existencia a granel. */
  fromBulk: boolean;
  productionDate: Date | null;
  expirationDate: Date | null;
  alcohol: number | null;
  recipeLabel: string | null;
};

export function resolveBottleOrigin(bottling: {
  batch?: BatchLike;
  rawMaterial?: RawMaterialLike;
}): BottleOrigin {
  const { batch, rawMaterial } = bottling;

  if (batch) {
    return {
      productName: batch.product?.name ?? "Producto sin nombre",
      productIcon: batch.product?.icon ?? null,
      productDescription: batch.product?.description ?? null,
      sourceCode: batch.code,
      sourceLabel: "Lote de elaboración",
      fromBulk: false,
      productionDate: batch.productionDate ?? null,
      expirationDate: batch.expirationDate ?? null,
      alcohol:
        batch.finalAlcohol ??
        batch.initialAlcohol ??
        batch.recipe?.targetAlcohol ??
        batch.product?.defaultAlcohol ??
        null,
      recipeLabel:
        batch.recipe?.name != null
          ? `${batch.recipe.name}${batch.recipe.version != null ? ` V${batch.recipe.version}` : ""}`
          : null,
    };
  }

  if (rawMaterial) {
    return {
      productName: rawMaterial.name,
      productIcon: null,
      productDescription: rawMaterial.description ?? null,
      sourceCode: rawMaterial.code,
      sourceLabel: "Producción propia a granel",
      fromBulk: true,
      productionDate: null,
      expirationDate: null,
      alcohol: null,
      recipeLabel: null,
    };
  }

  // No debería ocurrir: toda botella tiene uno u otro origen. Se
  // devuelve algo legible en vez de reventar la pantalla.
  return {
    productName: "Origen no identificado",
    productIcon: null,
    productDescription: null,
    sourceCode: "—",
    sourceLabel: "Sin origen registrado",
    fromBulk: false,
    productionDate: null,
    expirationDate: null,
    alcohol: null,
    recipeLabel: null,
  };
}

/** Selección de Prisma reutilizable para traer ambos orígenes. */
export const BOTTLE_ORIGIN_SELECT = {
  batch: {
    select: {
      id: true,
      code: true,
      productionDate: true,
      expirationDate: true,
      finalAlcohol: true,
      initialAlcohol: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          icon: true,
          description: true,
          defaultAlcohol: true,
          active: true,
        },
      },
      recipe: { select: { id: true, name: true, version: true, targetAlcohol: true } },
    },
  },
  rawMaterial: {
    select: { id: true, code: true, name: true, category: true, description: true },
  },
} as const;
