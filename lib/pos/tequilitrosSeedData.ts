/**
 * Datos extraídos del "Manual Oficial de Preparación de Bebidas —
 * Tequilitros" (recetario-junio-2026). Cada bebida trae su receta
 * exacta para Mediano y Grande tal como aparece en el manual.
 *
 * Notas sobre estimaciones (donde el manual no da un mililitraje
 * exacto):
 * - Los ingredientes marcados como "completar hasta llenar el vaso"
 *   (refresco de toronja, agua mineral) no traen una cantidad fija en
 *   el manual: se estimó un mililitraje razonable para poder
 *   descontarlo del inventario. Ajusta la cantidad en Punto de Venta >
 *   Productos si no coincide con lo que realmente se sirve.
 * - "Tajín para decorar" (Sí/No en el manual) se tradujo a una
 *   cantidad nominal en gramos.
 */

export type SeedIngredient = {
  /** Debe coincidir con el `code` de un InventoryProduct sembrado por este script. */
  ingredientCode: string;
  quantity: number;
};

export type SeedVariant = {
  name: string;
  price: number;
  ingredients: SeedIngredient[];
};

export type SeedProduct = {
  categoryName: string;
  name: string;
  /**
   * Color por defecto del producto (hex). El admin puede reemplazarlo
   * por una foto real subida desde Punto de Venta > Productos.
   */
  color: string;
  variants: SeedVariant[];
};

export const INGREDIENTS = [
  { code: "POS-ING-SAL", name: "Sal (escarchar)", unit: "pizca" },
  { code: "POS-ING-LIMON", name: "Limón (jugo)", unit: "ml" },
  { code: "POS-ING-SANGRIA", name: "Sangría", unit: "ml" },
  { code: "POS-ING-JNARANJA", name: "Jugo de naranja", unit: "ml" },
  { code: "POS-ING-TEQUILA", name: "Tequila (insumo barra)", unit: "ml" },
  { code: "POS-ING-TORONJA-REF", name: "Refresco de toronja", unit: "ml" },
  { code: "POS-ING-TAJIN", name: "Tajín (decorar)", unit: "g" },
  { code: "POS-ING-JTORONJA", name: "Jugo de toronja", unit: "ml" },
  { code: "POS-ING-SALSAS", name: "Salsas de la casa", unit: "ml" },
  { code: "POS-ING-CLAMATO", name: "Clamato", unit: "ml" },
  { code: "POS-ING-AGUAMINERAL", name: "Agua mineral", unit: "ml" },
  { code: "POS-ING-MADRILENA", name: "Madrileña (granadina)", unit: "ml" },
  { code: "POS-ING-ZARZAMORA", name: "Licor de zarzamora", unit: "ml" },
  { code: "POS-ING-MOJITO", name: "Licor para mojito", unit: "ml" },
] as const;

export const PRODUCTS: SeedProduct[] = [
  {
    categoryName: "Cócteles",
    name: "Vampiro",
    color: "#EF4444",
    variants: [
      {
        name: "Mediano",
        price: 70,
        ingredients: [
          { ingredientCode: "POS-ING-SAL", quantity: 1.5 },
          { ingredientCode: "POS-ING-LIMON", quantity: 15 },
          { ingredientCode: "POS-ING-SANGRIA", quantity: 60 },
          { ingredientCode: "POS-ING-JNARANJA", quantity: 90 },
          { ingredientCode: "POS-ING-TEQUILA", quantity: 30 },
          { ingredientCode: "POS-ING-TORONJA-REF", quantity: 120 },
          { ingredientCode: "POS-ING-TAJIN", quantity: 1 },
        ],
      },
      {
        name: "Grande",
        price: 99,
        ingredients: [
          { ingredientCode: "POS-ING-SAL", quantity: 3 },
          { ingredientCode: "POS-ING-LIMON", quantity: 30 },
          { ingredientCode: "POS-ING-SANGRIA", quantity: 120 },
          { ingredientCode: "POS-ING-JNARANJA", quantity: 180 },
          { ingredientCode: "POS-ING-TEQUILA", quantity: 60 },
          { ingredientCode: "POS-ING-TORONJA-REF", quantity: 240 },
          { ingredientCode: "POS-ING-TAJIN", quantity: 1.5 },
        ],
      },
    ],
  },
  {
    categoryName: "Cócteles",
    name: "Cantarito",
    color: "#F97316",
    variants: [
      {
        name: "Mediano",
        price: 70,
        ingredients: [
          { ingredientCode: "POS-ING-SAL", quantity: 1.5 },
          { ingredientCode: "POS-ING-LIMON", quantity: 30 },
          { ingredientCode: "POS-ING-JTORONJA", quantity: 7.5 },
          { ingredientCode: "POS-ING-JNARANJA", quantity: 150 },
          { ingredientCode: "POS-ING-TEQUILA", quantity: 30 },
          { ingredientCode: "POS-ING-TORONJA-REF", quantity: 120 },
          { ingredientCode: "POS-ING-TAJIN", quantity: 1 },
        ],
      },
      {
        name: "Grande",
        price: 99,
        ingredients: [
          { ingredientCode: "POS-ING-SAL", quantity: 3 },
          { ingredientCode: "POS-ING-LIMON", quantity: 60 },
          { ingredientCode: "POS-ING-JTORONJA", quantity: 15 },
          { ingredientCode: "POS-ING-JNARANJA", quantity: 150 },
          { ingredientCode: "POS-ING-TEQUILA", quantity: 60 },
          { ingredientCode: "POS-ING-TORONJA-REF", quantity: 240 },
          { ingredientCode: "POS-ING-TAJIN", quantity: 1.5 },
        ],
      },
    ],
  },
  {
    categoryName: "Cócteles",
    name: "Paloma",
    color: "#EC4899",
    variants: [
      {
        name: "Mediano",
        price: 70,
        ingredients: [
          { ingredientCode: "POS-ING-SAL", quantity: 1.5 },
          { ingredientCode: "POS-ING-LIMON", quantity: 30 },
          { ingredientCode: "POS-ING-TEQUILA", quantity: 30 },
          { ingredientCode: "POS-ING-TORONJA-REF", quantity: 180 },
        ],
      },
      {
        name: "Grande",
        price: 99,
        ingredients: [
          { ingredientCode: "POS-ING-SAL", quantity: 3 },
          { ingredientCode: "POS-ING-LIMON", quantity: 60 },
          { ingredientCode: "POS-ING-TEQUILA", quantity: 60 },
          { ingredientCode: "POS-ING-TORONJA-REF", quantity: 360 },
        ],
      },
    ],
  },
  {
    categoryName: "Cócteles",
    name: "Tequimiche",
    color: "#3B82F6",
    variants: [
      {
        name: "Mediano",
        price: 70,
        ingredients: [
          { ingredientCode: "POS-ING-SAL", quantity: 1.5 },
          { ingredientCode: "POS-ING-LIMON", quantity: 15 },
          { ingredientCode: "POS-ING-SALSAS", quantity: 7.5 },
          { ingredientCode: "POS-ING-CLAMATO", quantity: 60 },
          { ingredientCode: "POS-ING-TEQUILA", quantity: 30 },
          { ingredientCode: "POS-ING-AGUAMINERAL", quantity: 120 },
        ],
      },
      {
        name: "Grande",
        price: 99,
        ingredients: [
          { ingredientCode: "POS-ING-SAL", quantity: 3 },
          { ingredientCode: "POS-ING-LIMON", quantity: 30 },
          { ingredientCode: "POS-ING-SALSAS", quantity: 15 },
          { ingredientCode: "POS-ING-CLAMATO", quantity: 120 },
          { ingredientCode: "POS-ING-TEQUILA", quantity: 60 },
          { ingredientCode: "POS-ING-AGUAMINERAL", quantity: 240 },
        ],
      },
    ],
  },
  {
    categoryName: "Cócteles",
    name: "Tequimora",
    color: "#8B5CF6",
    variants: [
      {
        name: "Mediano",
        price: 70,
        ingredients: [
          { ingredientCode: "POS-ING-SAL", quantity: 1.5 },
          { ingredientCode: "POS-ING-LIMON", quantity: 15 },
          { ingredientCode: "POS-ING-MADRILENA", quantity: 7.5 },
          { ingredientCode: "POS-ING-ZARZAMORA", quantity: 45 },
          { ingredientCode: "POS-ING-TEQUILA", quantity: 30 },
          { ingredientCode: "POS-ING-TORONJA-REF", quantity: 120 },
        ],
      },
      {
        name: "Grande",
        price: 99,
        ingredients: [
          { ingredientCode: "POS-ING-SAL", quantity: 3 },
          { ingredientCode: "POS-ING-LIMON", quantity: 30 },
          { ingredientCode: "POS-ING-MADRILENA", quantity: 15 },
          { ingredientCode: "POS-ING-ZARZAMORA", quantity: 90 },
          { ingredientCode: "POS-ING-TEQUILA", quantity: 60 },
          { ingredientCode: "POS-ING-TORONJA-REF", quantity: 240 },
        ],
      },
    ],
  },
  {
    categoryName: "Cócteles",
    name: "Tequimojito",
    color: "#22C55E",
    variants: [
      {
        name: "Mediano",
        price: 70,
        ingredients: [
          { ingredientCode: "POS-ING-SAL", quantity: 1.5 },
          { ingredientCode: "POS-ING-LIMON", quantity: 30 },
          { ingredientCode: "POS-ING-MADRILENA", quantity: 7.5 },
          { ingredientCode: "POS-ING-MOJITO", quantity: 30 },
          { ingredientCode: "POS-ING-TEQUILA", quantity: 30 },
          { ingredientCode: "POS-ING-TORONJA-REF", quantity: 120 },
        ],
      },
      {
        name: "Grande",
        price: 99,
        ingredients: [
          { ingredientCode: "POS-ING-SAL", quantity: 3 },
          { ingredientCode: "POS-ING-LIMON", quantity: 60 },
          { ingredientCode: "POS-ING-MADRILENA", quantity: 15 },
          { ingredientCode: "POS-ING-MOJITO", quantity: 60 },
          { ingredientCode: "POS-ING-TEQUILA", quantity: 60 },
          { ingredientCode: "POS-ING-TORONJA-REF", quantity: 240 },
        ],
      },
    ],
  },
  {
    categoryName: "Shots",
    name: "Coscorrón",
    color: "#F59E0B",
    variants: [
      {
        // Presentación única: caballito de 60 ml, no tiene Mediano/Grande.
        name: "Único",
        price: 35,
        ingredients: [
          { ingredientCode: "POS-ING-TORONJA-REF", quantity: 30 },
          { ingredientCode: "POS-ING-TEQUILA", quantity: 15 },
          { ingredientCode: "POS-ING-LIMON", quantity: 15 },
        ],
      },
    ],
  },
];
