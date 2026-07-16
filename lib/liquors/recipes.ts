export type LiquorRecipeIngredientDefinition = {
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
  optional?: boolean;
};

export type LiquorRecipeDefinition = {
  productSlug: string;
  name: string;
  version: number;
  targetLiters: number;
  targetAlcohol?: number;
  instructions: string[];
  masterTips?: string[];
  notes?: string;
  ingredients: LiquorRecipeIngredientDefinition[];
};

export const LIQUOR_RECIPES: LiquorRecipeDefinition[] = [
  {
    productSlug: "zarzamora",
    name: "Receta oficial de Zarzamora",
    version: 1,

    /*
     * La receta indica un rendimiento estimado de 105 a 110 L.
     * Usamos 107.5 L como base para calcular proporciones.
     */
    targetLiters: 107.5,
    targetAlcohol: 16,
ingredients: [
  { name: "Agua", quantity: 35, unit: "L" },
  { name: "Azúcar", quantity: 50, unit: "kg" },
  { name: "Ácido cítrico", quantity: 4, unit: "kg" },
  {
    name: "Concentrado de zarzamora",
    quantity: 400,
    unit: "ml",
  },
  {
    name: "Tequila 36° Alc.",
    quantity: 46,
    unit: "L",
  },
],

    instructions: [
      "En un tanque limpio, agregar los 35 litros de agua.",
      "Incorporar el azúcar poco a poco hasta su total disolución.",
      "Agregar el ácido cítrico y mezclar hasta homogeneizar.",
      "Añadir el concentrado de zarzamora y mezclar perfectamente.",
      "Incorporar el tequila de forma gradual.",
      "Mezclar durante al menos 15 minutos hasta obtener una solución uniforme.",
      "Dejar reposar entre 48 y 72 horas antes del envasado.",
    ],

    masterTips: [
      "No agregar el tequila antes de que el azúcar esté completamente disuelta.",
      "Mantener el producto en recipientes cerrados.",
      "Almacenar en un lugar fresco y sin exposición directa al sol.",
      "Agitar suavemente antes de envasar.",
    ],

    notes:
      "Perfil dulce, ácido e intenso, con notas marcadas de zarzamora.",
  },

  {
    productSlug: "sangria",
    name: "Sangría del Norte · Concentrado",
    version: 1,
    targetLiters: 45,

    ingredients: [
      {
        name: "Jugo de Tampico",
        quantity: 22.5,
        unit: "L",
      },
      {
        name: "Agua natural",
        quantity: 22.5,
        unit: "L",
      },
      {
        name: "Azúcar",
        quantity: 27,
        unit: "kg",
      },
      {
        name: "Ácido cítrico",
        quantity: 6,
        unit: "kg",
      },
      {
        name: "Chamoy",
        quantity: 300,
        unit: "ml",
      },
      {
        name: "Picor (Salsa Inigualable)",
        quantity: 3,
        unit: "gotas",
      },
      {
        name: "Sorbato de potasio",
        quantity: 30,
        unit: "g",
      },
    ],

    instructions: [
      "En un tanque limpio, agregar el jugo de Tampico y el agua natural.",
      "Incorporar el azúcar poco a poco, mezclando hasta su completa disolución.",
      "Agregar el ácido cítrico gradualmente, asegurando una mezcla homogénea.",
      "Añadir el chamoy y mezclar hasta integrar.",
      "Agregar la salsa picante mediante microdosificación.",
      "Disolver el sorbato de potasio en una pequeña cantidad de agua tibia y agregar al lote.",
      "Mezclar durante 10 a 15 minutos.",
      "Dejar reposar entre 12 y 24 horas antes de envasar.",
    ],

    masterTips: [
      "El producto es un concentrado y no está diseñado para beberse directamente.",
      "Mantener el producto en un recipiente cerrado.",
      "Agregar la salsa picante mediante microdosificación.",
    ],

    notes:
      "Concentrado ácido-dulce con picor, diseñado para dilución en punto de venta.",
  },
];