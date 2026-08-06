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
  { code: "POS-ING-SAL", name: "Sal (escarchar)", unit: "pizca", category: "Insumos Bar" },
  { code: "POS-ING-LIMON", name: "Limón (jugo)", unit: "ml", category: "Insumos Bar" },
  { code: "POS-ING-SANGRIA", name: "Sangría", unit: "ml", category: "Insumos Bar" },
  { code: "POS-ING-JNARANJA", name: "Jugo de naranja", unit: "ml", category: "Insumos Bar" },
  {
    code: "POS-ING-TEQUILA",
    name: "Tequila Blanco (Destiladora del Norte)",
    unit: "ml",
    category: "Tequila",
  },
  { code: "POS-ING-TORONJA-REF", name: "Refresco de toronja", unit: "ml", category: "Insumos Bar" },
  { code: "POS-ING-TAJIN", name: "Tajín (decorar)", unit: "g", category: "Insumos Bar" },
  { code: "POS-ING-JTORONJA", name: "Jugo de toronja", unit: "ml", category: "Insumos Bar" },
  { code: "POS-ING-SALSAS", name: "Salsas de la casa", unit: "ml", category: "Insumos Bar" },
  { code: "POS-ING-CLAMATO", name: "Clamato", unit: "ml", category: "Insumos Bar" },
  { code: "POS-ING-AGUAMINERAL", name: "Agua mineral", unit: "ml", category: "Extras" },
  { code: "POS-ING-MADRILENA", name: "Madrileña (granadina)", unit: "ml", category: "Insumos Bar" },
  { code: "POS-ING-ZARZAMORA", name: "Licor de Zarzamora", unit: "ml", category: "Licores" },
  { code: "POS-ING-MOJITO", name: "Licor para mojito", unit: "ml", category: "Insumos Bar" },
  {
    code: "TEQ-REPOSADO",
    name: "Tequila Reposado (Destiladora del Norte)",
    unit: "ml",
    category: "Tequila",
  },
  {
    code: "TEQ-ANEJO",
    name: "Tequila Añejo (Destiladora del Norte)",
    unit: "ml",
    category: "Tequila",
  },
  { code: "LIC-MANGO", name: "Licor de Mango", unit: "ml", category: "Licores" },
  { code: "LIC-JAMAICA", name: "Licor de Jamaica", unit: "ml", category: "Licores" },
  { code: "EXTRA-HIELO", name: "Hielo", unit: "bolsa", category: "Extras" },
  { code: "EXTRA-PENAFIEL", name: "Peñafiel", unit: "botella", category: "Extras" },

  // --- Faltantes detectados en el "Formato de Inventario para Eventos" ---
  { code: "LIC-MENTA", name: "Licor de Menta", unit: "ml", category: "Licores" },
  { code: "POS-ING-TAMPICO", name: "Jugo Tampico", unit: "ml", category: "Insumos Bar" },
  { code: "POS-ING-KERMATO", name: "Kermato", unit: "ml", category: "Insumos Bar" },
  { code: "POS-ING-RC", name: "Refresco RC", unit: "ml", category: "Insumos Bar" },
  { code: "EXTRA-AGUANATURAL", name: "Agua Natural", unit: "ml", category: "Extras" },

  // --- Vasos: se descuentan 1:1 por venta según la medida servida ---
  { code: "POS-ING-VASO-MED", name: "Vaso mediano", unit: "Pza", category: "Vasos" },
  { code: "POS-ING-VASO-GDE", name: "Vaso grande", unit: "Pza", category: "Vasos" },
] as const;

/**
 * Equipo/insumos de logística detectados en los formatos de "Trastes /
 * Equipo de barra" y "Equipo general / Logística" que se usan para
 * armar y regresar el material de cada evento. No son ingredientes de
 * receta (no se venden en Punto de Venta): se siembran directo a
 * Inventario para poder armarlos en Paquetes de Evento y llevar su
 * control de existencias/retorno.
 */
export type SeedEquipmentItem = {
  code: string;
  name: string;
  unit: string;
  category: string;
  itemType: "EQUIPMENT" | "CONSUMABLE";
  mustReturn: boolean;
};

export const EQUIPMENT_ITEMS: SeedEquipmentItem[] = [
  // Trastes / Equipo de barra
  { code: "EQ-HIELERA", name: "Hieleras", unit: "Pza", category: "Equipo de Barra", itemType: "EQUIPMENT", mustReturn: true },
  { code: "EQ-CUCHARON-HIELO", name: "Cucharón para hielo", unit: "Pza", category: "Equipo de Barra", itemType: "EQUIPMENT", mustReturn: true },
  { code: "EQ-JIGGER", name: "Jiggers", unit: "Pza", category: "Equipo de Barra", itemType: "EQUIPMENT", mustReturn: true },
  { code: "EQ-EXPRIMIDOR", name: "Exprimidor", unit: "Pza", category: "Equipo de Barra", itemType: "EQUIPMENT", mustReturn: true },
  { code: "EQ-JARRA", name: "Jarras", unit: "Pza", category: "Equipo de Barra", itemType: "EQUIPMENT", mustReturn: true },
  { code: "EQ-AGITADOR", name: "Agitadores", unit: "Pza", category: "Equipo de Barra", itemType: "EQUIPMENT", mustReturn: true },
  { code: "EQ-PORTAAGITADOR", name: "Porta agitador", unit: "Pza", category: "Equipo de Barra", itemType: "EQUIPMENT", mustReturn: true },
  { code: "EQ-ESCARCHADOR", name: "Escarchador", unit: "Pza", category: "Equipo de Barra", itemType: "EQUIPMENT", mustReturn: true },
  { code: "EQ-MAMILA", name: "Mamilas", unit: "Pza", category: "Equipo de Barra", itemType: "EQUIPMENT", mustReturn: true },
  { code: "EQ-SALERO", name: "Saleros", unit: "Pza", category: "Equipo de Barra", itemType: "EQUIPMENT", mustReturn: true },
  { code: "EQ-CABALLITO", name: "Caballitos", unit: "Pza", category: "Equipo de Barra", itemType: "EQUIPMENT", mustReturn: true },
  { code: "EQ-SERVILLETERO", name: "Servilleteros", unit: "Pza", category: "Equipo de Barra", itemType: "EQUIPMENT", mustReturn: true },
  { code: "EQ-POPOTERO", name: "Popoteros", unit: "Pza", category: "Equipo de Barra", itemType: "EQUIPMENT", mustReturn: true },
  { code: "EQ-MENU", name: "Menús", unit: "Pza", category: "Equipo de Barra", itemType: "EQUIPMENT", mustReturn: true },
  { code: "EQ-CHAROLA", name: "Charolas", unit: "Pza", category: "Equipo de Barra", itemType: "EQUIPMENT", mustReturn: true },
  { code: "EQ-CUBETA", name: "Cubetas", unit: "Pza", category: "Equipo de Barra", itemType: "EQUIPMENT", mustReturn: true },
  { code: "EQ-CUCHILLO", name: "Cuchillos", unit: "Pza", category: "Equipo de Barra", itemType: "EQUIPMENT", mustReturn: true },
  { code: "EQ-TABLA-CORTAR", name: "Tablas para cortar", unit: "Pza", category: "Equipo de Barra", itemType: "EQUIPMENT", mustReturn: true },

  // Equipo general / Logística
  { code: "EQ-MESA", name: "Mesas", unit: "Pza", category: "Equipo General", itemType: "EQUIPMENT", mustReturn: true },
  { code: "EQ-HIELERA-GRANDE", name: "Hieleras grandes", unit: "Pza", category: "Equipo General", itemType: "EQUIPMENT", mustReturn: true },
  { code: "EQ-LONA", name: "Lonas", unit: "Pza", category: "Equipo General", itemType: "EQUIPMENT", mustReturn: true },
  { code: "EQ-EXTENSION", name: "Extensiones", unit: "Pza", category: "Equipo General", itemType: "EQUIPMENT", mustReturn: true },
  { code: "EQ-MULTICONTACTO", name: "Multicontacto", unit: "Pza", category: "Equipo General", itemType: "EQUIPMENT", mustReturn: true },
  { code: "EQ-ILUMINACION", name: "Iluminación", unit: "Pza", category: "Equipo General", itemType: "EQUIPMENT", mustReturn: true },
  { code: "SUP-BOLSABASURA", name: "Bolsas de basura", unit: "Paq", category: "Equipo General", itemType: "CONSUMABLE", mustReturn: false },
  { code: "EQ-TRAPO", name: "Trapos / Franela", unit: "Pza", category: "Equipo General", itemType: "EQUIPMENT", mustReturn: true },
  { code: "SUP-CINTA", name: "Cinta", unit: "Pza", category: "Equipo General", itemType: "CONSUMABLE", mustReturn: false },
  { code: "EQ-ENCENDEDOR", name: "Encendedor", unit: "Pza", category: "Equipo General", itemType: "EQUIPMENT", mustReturn: true },
  { code: "EQ-CAJA-EFECTIVO", name: "Caja de efectivo", unit: "Pza", category: "Equipo General", itemType: "EQUIPMENT", mustReturn: true },
  { code: "EQ-TABLETA", name: "Tableta", unit: "Pza", category: "Equipo General", itemType: "EQUIPMENT", mustReturn: true },
  { code: "EQ-CARGADOR", name: "Cargador", unit: "Pza", category: "Equipo General", itemType: "EQUIPMENT", mustReturn: true },
];

export const PRODUCTS: SeedProduct[] = [
  {
    categoryName: "Tequilitros",
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
          { ingredientCode: "POS-ING-VASO-MED", quantity: 1 },
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
          { ingredientCode: "POS-ING-VASO-GDE", quantity: 1 },
        ],
      },
      {
        name: "Mediano sin tequila",
        price: 35,
        ingredients: [
          { ingredientCode: "POS-ING-SAL", quantity: 1.5 },
          { ingredientCode: "POS-ING-LIMON", quantity: 15 },
          { ingredientCode: "POS-ING-SANGRIA", quantity: 60 },
          { ingredientCode: "POS-ING-JNARANJA", quantity: 90 },
          { ingredientCode: "POS-ING-TORONJA-REF", quantity: 120 },
          { ingredientCode: "POS-ING-TAJIN", quantity: 1 },
          { ingredientCode: "POS-ING-VASO-MED", quantity: 1 },
        ],
      },
      {
        name: "Grande sin tequila",
        price: 50,
        ingredients: [
          { ingredientCode: "POS-ING-SAL", quantity: 3 },
          { ingredientCode: "POS-ING-LIMON", quantity: 30 },
          { ingredientCode: "POS-ING-SANGRIA", quantity: 120 },
          { ingredientCode: "POS-ING-JNARANJA", quantity: 180 },
          { ingredientCode: "POS-ING-TORONJA-REF", quantity: 240 },
          { ingredientCode: "POS-ING-TAJIN", quantity: 1.5 },
          { ingredientCode: "POS-ING-VASO-GDE", quantity: 1 },
        ],
      },
    ],
  },
  {
    categoryName: "Tequilitros",
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
          { ingredientCode: "POS-ING-VASO-MED", quantity: 1 },
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
          { ingredientCode: "POS-ING-VASO-GDE", quantity: 1 },
        ],
      },
      {
        name: "Mediano sin tequila",
        price: 35,
        ingredients: [
          { ingredientCode: "POS-ING-SAL", quantity: 1.5 },
          { ingredientCode: "POS-ING-LIMON", quantity: 30 },
          { ingredientCode: "POS-ING-JTORONJA", quantity: 7.5 },
          { ingredientCode: "POS-ING-JNARANJA", quantity: 150 },
          { ingredientCode: "POS-ING-TORONJA-REF", quantity: 120 },
          { ingredientCode: "POS-ING-TAJIN", quantity: 1 },
          { ingredientCode: "POS-ING-VASO-MED", quantity: 1 },
        ],
      },
      {
        name: "Grande sin tequila",
        price: 50,
        ingredients: [
          { ingredientCode: "POS-ING-SAL", quantity: 3 },
          { ingredientCode: "POS-ING-LIMON", quantity: 60 },
          { ingredientCode: "POS-ING-JTORONJA", quantity: 15 },
          { ingredientCode: "POS-ING-JNARANJA", quantity: 150 },
          { ingredientCode: "POS-ING-TORONJA-REF", quantity: 240 },
          { ingredientCode: "POS-ING-TAJIN", quantity: 1.5 },
          { ingredientCode: "POS-ING-VASO-GDE", quantity: 1 },
        ],
      },
    ],
  },
  {
    categoryName: "Tequilitros",
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
          { ingredientCode: "POS-ING-VASO-MED", quantity: 1 },
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
          { ingredientCode: "POS-ING-VASO-GDE", quantity: 1 },
        ],
      },
      {
        name: "Mediano sin tequila",
        price: 35,
        ingredients: [
          { ingredientCode: "POS-ING-SAL", quantity: 1.5 },
          { ingredientCode: "POS-ING-LIMON", quantity: 30 },
          { ingredientCode: "POS-ING-TORONJA-REF", quantity: 180 },
          { ingredientCode: "POS-ING-VASO-MED", quantity: 1 },
        ],
      },
      {
        name: "Grande sin tequila",
        price: 50,
        ingredients: [
          { ingredientCode: "POS-ING-SAL", quantity: 3 },
          { ingredientCode: "POS-ING-LIMON", quantity: 60 },
          { ingredientCode: "POS-ING-TORONJA-REF", quantity: 360 },
          { ingredientCode: "POS-ING-VASO-GDE", quantity: 1 },
        ],
      },
    ],
  },
  {
    categoryName: "Tequilitros",
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
          { ingredientCode: "POS-ING-VASO-MED", quantity: 1 },
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
          { ingredientCode: "POS-ING-VASO-GDE", quantity: 1 },
        ],
      },
      {
        name: "Mediano sin tequila",
        price: 35,
        ingredients: [
          { ingredientCode: "POS-ING-SAL", quantity: 1.5 },
          { ingredientCode: "POS-ING-LIMON", quantity: 15 },
          { ingredientCode: "POS-ING-SALSAS", quantity: 7.5 },
          { ingredientCode: "POS-ING-CLAMATO", quantity: 60 },
          { ingredientCode: "POS-ING-AGUAMINERAL", quantity: 120 },
          { ingredientCode: "POS-ING-VASO-MED", quantity: 1 },
        ],
      },
      {
        name: "Grande sin tequila",
        price: 50,
        ingredients: [
          { ingredientCode: "POS-ING-SAL", quantity: 3 },
          { ingredientCode: "POS-ING-LIMON", quantity: 30 },
          { ingredientCode: "POS-ING-SALSAS", quantity: 15 },
          { ingredientCode: "POS-ING-CLAMATO", quantity: 120 },
          { ingredientCode: "POS-ING-AGUAMINERAL", quantity: 240 },
          { ingredientCode: "POS-ING-VASO-GDE", quantity: 1 },
        ],
      },
    ],
  },
  {
    categoryName: "Tequilitros",
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
          { ingredientCode: "POS-ING-VASO-MED", quantity: 1 },
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
          { ingredientCode: "POS-ING-VASO-GDE", quantity: 1 },
        ],
      },
      {
        name: "Mediano sin tequila",
        price: 35,
        ingredients: [
          { ingredientCode: "POS-ING-SAL", quantity: 1.5 },
          { ingredientCode: "POS-ING-LIMON", quantity: 15 },
          { ingredientCode: "POS-ING-MADRILENA", quantity: 7.5 },
          { ingredientCode: "POS-ING-ZARZAMORA", quantity: 45 },
          { ingredientCode: "POS-ING-TORONJA-REF", quantity: 120 },
          { ingredientCode: "POS-ING-VASO-MED", quantity: 1 },
        ],
      },
      {
        name: "Grande sin tequila",
        price: 50,
        ingredients: [
          { ingredientCode: "POS-ING-SAL", quantity: 3 },
          { ingredientCode: "POS-ING-LIMON", quantity: 30 },
          { ingredientCode: "POS-ING-MADRILENA", quantity: 15 },
          { ingredientCode: "POS-ING-ZARZAMORA", quantity: 90 },
          { ingredientCode: "POS-ING-TORONJA-REF", quantity: 240 },
          { ingredientCode: "POS-ING-VASO-GDE", quantity: 1 },
        ],
      },
    ],
  },
  {
    categoryName: "Tequilitros",
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
          { ingredientCode: "POS-ING-VASO-MED", quantity: 1 },
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
          { ingredientCode: "POS-ING-VASO-GDE", quantity: 1 },
        ],
      },
      {
        name: "Mediano sin tequila",
        price: 35,
        ingredients: [
          { ingredientCode: "POS-ING-SAL", quantity: 1.5 },
          { ingredientCode: "POS-ING-LIMON", quantity: 30 },
          { ingredientCode: "POS-ING-MADRILENA", quantity: 7.5 },
          { ingredientCode: "POS-ING-MOJITO", quantity: 30 },
          { ingredientCode: "POS-ING-TORONJA-REF", quantity: 120 },
          { ingredientCode: "POS-ING-VASO-MED", quantity: 1 },
        ],
      },
      {
        name: "Grande sin tequila",
        price: 50,
        ingredients: [
          { ingredientCode: "POS-ING-SAL", quantity: 3 },
          { ingredientCode: "POS-ING-LIMON", quantity: 60 },
          { ingredientCode: "POS-ING-MADRILENA", quantity: 15 },
          { ingredientCode: "POS-ING-MOJITO", quantity: 60 },
          { ingredientCode: "POS-ING-TORONJA-REF", quantity: 240 },
          { ingredientCode: "POS-ING-VASO-GDE", quantity: 1 },
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

  // --- Menú "Destiladora del Norte": tequilas y licores por botella ---
  // "1 L" y "Servicio" son la MISMA botella completa (1000 ml): la
  // diferencia es el contexto de venta (para llevar vs. servicio en
  // mesa), no la cantidad — por eso ambas variantes descuentan 1 L.
  {
    categoryName: "Tequilas",
    name: "Blanco",
    color: "#78716C",
    variants: [
      {
        name: "1 L",
        price: 420,
        ingredients: [{ ingredientCode: "POS-ING-TEQUILA", quantity: 1000 }],
      },
      {
        name: "Servicio",
        price: 500,
        ingredients: [{ ingredientCode: "POS-ING-TEQUILA", quantity: 1000 }],
      },
    ],
  },
  {
    categoryName: "Tequilas",
    name: "Reposado",
    color: "#F59E0B",
    variants: [
      {
        name: "1 L",
        price: 480,
        ingredients: [{ ingredientCode: "TEQ-REPOSADO", quantity: 1000 }],
      },
      {
        name: "Servicio",
        price: 550,
        ingredients: [{ ingredientCode: "TEQ-REPOSADO", quantity: 1000 }],
      },
    ],
  },
  {
    categoryName: "Tequilas",
    name: "Añejo",
    color: "#B45309",
    variants: [
      {
        name: "1 L",
        price: 580,
        ingredients: [{ ingredientCode: "TEQ-ANEJO", quantity: 1000 }],
      },
      {
        name: "Servicio",
        price: 650,
        ingredients: [{ ingredientCode: "TEQ-ANEJO", quantity: 1000 }],
      },
    ],
  },
  {
    categoryName: "Licores",
    name: "Mango",
    color: "#F97316",
    variants: [
      {
        name: "1 L",
        price: 200,
        ingredients: [{ ingredientCode: "LIC-MANGO", quantity: 1000 }],
      },
      {
        name: "Servicio",
        price: 250,
        ingredients: [{ ingredientCode: "LIC-MANGO", quantity: 1000 }],
      },
    ],
  },
  {
    categoryName: "Licores",
    name: "Jamaica",
    color: "#EF4444",
    variants: [
      {
        name: "1 L",
        price: 200,
        ingredients: [{ ingredientCode: "LIC-JAMAICA", quantity: 1000 }],
      },
      {
        name: "Servicio",
        price: 250,
        ingredients: [{ ingredientCode: "LIC-JAMAICA", quantity: 1000 }],
      },
    ],
  },
  {
    categoryName: "Licores",
    name: "Zarzamora",
    color: "#8B5CF6",
    variants: [
      {
        name: "1 L",
        price: 200,
        ingredients: [{ ingredientCode: "POS-ING-ZARZAMORA", quantity: 1000 }],
      },
      {
        name: "Servicio",
        price: 250,
        ingredients: [{ ingredientCode: "POS-ING-ZARZAMORA", quantity: 1000 }],
      },
    ],
  },
  {
    categoryName: "Licores",
    name: "Menta",
    color: "#10B981",
    variants: [
      {
        name: "1 L",
        price: 200,
        ingredients: [{ ingredientCode: "LIC-MENTA", quantity: 1000 }],
      },
      {
        name: "Servicio",
        price: 250,
        ingredients: [{ ingredientCode: "LIC-MENTA", quantity: 1000 }],
      },
    ],
  },
  {
    categoryName: "Refrescos",
    name: "Peñafiel",
    color: "#3B82F6",
    variants: [
      {
        name: "Único",
        price: 50,
        ingredients: [{ ingredientCode: "EXTRA-PENAFIEL", quantity: 1 }],
      },
    ],
  },
  {
    categoryName: "Refrescos",
    name: "Agua mineral",
    color: "#0EA5E9",
    variants: [
      {
        name: "Único",
        price: 50,
        ingredients: [{ ingredientCode: "POS-ING-AGUAMINERAL", quantity: 600 }],
      },
    ],
  },
  {
    categoryName: "Refrescos",
    name: "Agua Natural",
    color: "#38BDF8",
    variants: [
      {
        name: "Único",
        price: 50,
        ingredients: [{ ingredientCode: "EXTRA-AGUANATURAL", quantity: 600 }],
      },
    ],
  },
  {
    categoryName: "Extras",
    name: "Hielo",
    color: "#06B6D4",
    variants: [
      {
        name: "Único",
        price: 50,
        ingredients: [{ ingredientCode: "EXTRA-HIELO", quantity: 1 }],
      },
    ],
  },
];
